"""Admin user management: list, inspect, create, suspend/activate, delete, edit subscription, impersonate."""

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from api.dependencies import require_admin
from database.connection import get_db
from models.database_models import (
    Conversation,
    FacebookPage,
    KnowledgeBase,
    Product,
    Subscription,
    User,
)
from services.audit_service import log_admin_action
from utils.password import hash_password
from utils.token import create_access_token

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


class SuspendBody(BaseModel):
    reason: str | None = None


class SubscriptionUpdate(BaseModel):
    tier: str | None = None
    status: str | None = None  # active | suspended | cancelled
    messages_limit: int | None = None  # maps to max_messages_per_month
    messages_used: int | None = None
    ends_at: str | None = None  # ISO date, maps to expires_at


class CreateUserBody(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "user"
    tier: str | None = None  # if omitted: free_trial / active / 7 days
    messages_limit: int | None = None


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(body: CreateUserBody, admin: User = Depends(require_admin), db=Depends(get_db)):
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=body.role if body.role in ("user", "admin") else "user",
        is_active=True,
    )
    db.add(user)
    await db.flush()

    sub = Subscription(
        user_id=user.id,
        tier=body.tier or "free_trial",
        status="active",
        expires_at=datetime.utcnow() + timedelta(days=7),
        max_messages_per_month=body.messages_limit,  # None = unlimited
    )
    db.add(sub)
    await db.commit()
    await db.refresh(user)
    await log_admin_action(admin.id, "user_create", f"user={user.id} email={body.email}")
    return {"ok": True, "id": user.id, "email": user.email}


@router.post("/{user_id}/impersonate")
async def impersonate_user(user_id: str, admin: User = Depends(require_admin), db=Depends(get_db)):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    token = create_access_token(user.id, user.role)
    await log_admin_action(admin.id, "user_impersonate", f"user={user.id}")
    return {
        "ok": True,
        "access_token": token,
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role},
    }


@router.get("")
async def list_users(
    search: str | None = None,
    limit: int = 25,
    offset: int = 0,
    admin: User = Depends(require_admin),
    db=Depends(get_db),
):
    limit = min(max(limit, 1), 100)
    query = select(User).options(selectinload(User.subscription))
    if search:
        like = f"%{search.lower()}%"
        query = query.where((User.email.ilike(like)) | (User.full_name.ilike(like)))
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    rows = (await db.execute(query.order_by(User.created_at.desc()).limit(limit).offset(offset))).scalars().all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "subscription_tier": u.subscription.tier if u.subscription else None,
                "subscription_status": u.subscription.status if u.subscription else None,
            }
            for u in rows
        ],
    }


@router.get("/{user_id}")
async def get_user(user_id: str, admin: User = Depends(require_admin), db=Depends(get_db)):
    user = (await db.execute(select(User).where(User.id == user_id).options(selectinload(User.subscription)))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    pages = (await db.execute(select(FacebookPage).where(FacebookPage.user_id == user_id))).scalars().all()
    products = (await db.execute(select(func.count(Product.id)).where(Product.user_id == user_id))).scalar() or 0
    conversations = (await db.execute(select(func.count(Conversation.id)).where(Conversation.user_id == user_id))).scalar() or 0
    kb = (await db.execute(select(func.count(KnowledgeBase.id)).where(KnowledgeBase.user_id == user_id))).scalar() or 0

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "subscription": (
            {
                "tier": user.subscription.tier,
                "status": user.subscription.status,
                "ends_at": user.subscription.expires_at.isoformat() if user.subscription.expires_at else None,
                "messages_limit": user.subscription.max_messages_per_month,
                "messages_used": user.subscription.messages_used,
            }
            if user.subscription
            else None
        ),
        "pages": [
            {"id": p.id, "name": p.page_name, "page_id": p.page_id, "is_active": p.is_active}
            for p in pages
        ],
        "counts": {"products": products, "conversations": conversations, "knowledge_bases": kb},
    }


@router.post("/{user_id}/suspend")
async def suspend_user(user_id: str, body: SuspendBody, admin: User = Depends(require_admin), db=Depends(get_db)):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = False
    if user.subscription:
        user.subscription.status = "suspended"
    await db.commit()
    await log_admin_action(admin.id, "user_suspend", f"user={user_id} reason={body.reason}")
    return {"ok": True}


@router.post("/{user_id}/activate")
async def activate_user(user_id: str, admin: User = Depends(require_admin), db=Depends(get_db)):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = True
    if user.subscription and user.subscription.status == "suspended":
        user.subscription.status = "active"
    await db.commit()
    await log_admin_action(admin.id, "user_activate", f"user={user_id}")
    return {"ok": True}


@router.post("/{user_id}/subscription")
async def update_subscription(user_id: str, body: SubscriptionUpdate, admin: User = Depends(require_admin), db=Depends(get_db)):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    sub = user.subscription
    if sub is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User has no subscription")

    if body.tier is not None:
        sub.tier = body.tier
    if body.status is not None:
        sub.status = body.status
    if body.messages_limit is not None:
        sub.max_messages_per_month = body.messages_limit
    if body.messages_used is not None:
        sub.messages_used = body.messages_used
    if body.ends_at is not None:
        sub.expires_at = datetime.fromisoformat(body.ends_at)

    await db.commit()
    await log_admin_action(admin.id, "subscription_update", f"user={user_id} {body.model_dump(exclude_none=True)}")
    return {"ok": True, "subscription": {"tier": sub.tier, "status": sub.status, "messages_limit": sub.max_messages_per_month}}


@router.delete("/{user_id}")
async def delete_user(user_id: str, admin: User = Depends(require_admin), db=Depends(get_db)):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # ponytail: hard delete — remove child rows first to satisfy FK constraints (no cascade configured).
    await db.execute(select(FacebookPage).where(FacebookPage.user_id == user_id))
    for model in (FacebookPage, Product, KnowledgeBase, Conversation, Subscription):
        rows = (await db.execute(select(model).where(model.user_id == user_id))).scalars().all()
        for r in rows:
            await db.delete(r)
    await db.delete(user)
    await db.commit()
    await log_admin_action(admin.id, "user_delete", f"user={user_id}")
    return {"ok": True}
