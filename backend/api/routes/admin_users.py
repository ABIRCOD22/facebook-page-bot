"""Admin user management: list, inspect, create, suspend/activate, delete, edit subscription, impersonate."""

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from api.dependencies import require_admin
from database.connection import get_db
from models.database_models import (
    Alert,
    AuditLog,
    Conversation,
    FacebookPage,
    KnowledgeBase,
    KbTemplate,
    Message,
    Payment,
    Product,
    Subscription,
    User,
)
from services.audit_service import log_admin_action
from services.email_service import send_email, welcome_credentials_html
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
    password: str | None = None  # omitted → auto-generated (delivery model)
    full_name: str
    role: str = "user"
    tier: str | None = None  # if omitted: free_trial / active / 7 days
    messages_limit: int | None = None


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(body: CreateUserBody, admin: User = Depends(require_admin), db=Depends(get_db)):
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # White-glove delivery: admin provisions the account and hands the creds
    # over — generate a password when none was supplied.
    import secrets
    password = body.password or secrets.token_urlsafe(9)[:12]

    user = User(
        email=body.email,
        password_hash=hash_password(password),
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
    await log_admin_action(admin.id, "user_create", "user", user.id, detail=f"email={body.email}")

    # Welcome email with dashboard credentials. Best-effort; never blocks user creation.
    # ponytail: the plaintext password lives only in the HTTP request and this email —
    # it cannot be recovered later, so this send must not silently fail. Brevo is down
    # (or unconfigured) → logged warning; admin can still share creds manually.
    from config import get_settings
    await send_email(
        body.email,
        "Your Chatrix dashboard is ready",
        welcome_credentials_html(body.full_name, body.email, password, get_settings().CLIENT_PANEL_URL),
        to_name=body.full_name,
    )

    # Generated password returned exactly once for the admin to deliver.
    return {"ok": True, "id": user.id, "email": user.email, "password": password if not body.password else None}


class ResetPasswordBody(BaseModel):
    password: str | None = None  # omitted → auto-generated


@router.post("/{user_id}/reset-password")
async def reset_user_password(user_id: str, body: ResetPasswordBody, admin: User = Depends(require_admin), db=Depends(get_db)):
    """Regenerate a user's dashboard password (temporary creds for delivery)
    and resend the credentials email with the new password."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    import secrets
    password = body.password or secrets.token_urlsafe(9)[:12]
    user.password_hash = hash_password(password)
    await db.commit()
    await log_admin_action(admin.id, "user_reset_password", "user", user_id)

    from config import get_settings
    await send_email(
        user.email,
        "Your Chatrix password was reset",
        welcome_credentials_html(user.full_name or user.email, user.email, password, get_settings().CLIENT_PANEL_URL),
        to_name=user.full_name,
    )

    return {"ok": True, "password": password if not body.password else None}


@router.post("/{user_id}/impersonate")
async def impersonate_user(user_id: str, admin: User = Depends(require_admin), db=Depends(get_db)):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    token = create_access_token(user.id, user.role)
    await log_admin_action(admin.id, "user_impersonate", "user", user.id)
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
    await log_admin_action(admin.id, "user_suspend", "user", user_id, detail=body.reason)
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
    await log_admin_action(admin.id, "user_activate", "user", user_id)
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
    await log_admin_action(admin.id, "subscription_update", "user", user_id, detail=body.model_dump_json(exclude_none=True))
    return {"ok": True, "subscription": {"tier": sub.tier, "status": sub.status, "messages_limit": sub.max_messages_per_month}}


@router.delete("/{user_id}")
async def delete_user(user_id: str, admin: User = Depends(require_admin), db=Depends(get_db)):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # ponytail: hard delete — remove child rows first to satisfy FK constraints (no cascade configured).
    # Conversations/messages hang off pages (page_id), not the user directly.
    pages = (await db.execute(select(FacebookPage).where(FacebookPage.user_id == user_id))).scalars().all()
    for p in pages:
        convs = (await db.execute(select(Conversation).where(Conversation.page_id == p.id))).scalars().all()
        for c in convs:
            msgs = (await db.execute(select(Message).where(Message.conversation_id == c.id))).scalars().all()
            for m in msgs:
                await db.delete(m)
            await db.delete(c)
        await db.delete(p)
    for model in (Product, KnowledgeBase, Subscription, Payment):
        rows = (await db.execute(select(model).where(model.user_id == user_id))).scalars().all()
        for r in rows:
            await db.delete(r)
    for row in (await db.execute(select(KbTemplate).where(KbTemplate.created_by == user_id))).scalars().all():
        await db.delete(row)
    for row in (await db.execute(select(Alert).where(Alert.related_user_id == user_id))).scalars().all():
        await db.delete(row)
    for row in (await db.execute(select(AuditLog).where(AuditLog.admin_user_id == user_id))).scalars().all():
        await db.delete(row)
    await db.delete(user)
    await db.commit()
    await log_admin_action(admin.id, "user_delete", "user", user.id)
    return {"ok": True}
