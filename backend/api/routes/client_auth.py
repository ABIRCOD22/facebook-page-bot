"""Client authentication routes: register, login, me."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, update

from api.dependencies import get_current_user
from database.connection import get_db
from models.database_models import Conversation, FacebookPage, Payment, Subscription, User
from utils.password import hash_password, verify_password
from utils.token import create_access_token

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/client/auth", tags=["client-auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db=Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    existing_user = existing.scalar_one_or_none()

    if existing_user:
        # ponytail: a "shell" account (registered but never connected a page,
        # never paid, no conversations) is reclaimed by re-registering with
        # the same email — the funnel's register retry must not be blocked by
        # an account the previous attempt half-created (e.g. cold-start timeout
        # after the row was committed). Real accounts are never reclaimed.
        # Ceiling: email is the only identity check; a real email+ownership
        # verification flow would close the impersonation gap this leaves.
        pages = (
            await db.execute(select(FacebookPage.id).where(FacebookPage.user_id == existing_user.id))
        ).scalars().all()
        payments = (
            await db.execute(select(Payment.id).where(Payment.user_id == existing_user.id))
        ).scalars().all()
        conversations = (
            await db.execute(
                select(Conversation.id)
                .join(FacebookPage, Conversation.page_id == FacebookPage.id)
                .where(FacebookPage.user_id == existing_user.id)
            )
        ).scalars().all()
        if pages or payments or conversations:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        logger.info("Reclaiming shell account %s", body.email)
        existing_user.password_hash = hash_password(body.password)
        existing_user.full_name = body.full_name
        existing_user.is_active = True
        # Reset usage counters so a fresh trial restarts clean.
        await db.execute(
            update(Subscription)
            .where(Subscription.user_id == existing_user.id)
            .values(messages_used=0, started_at=datetime.utcnow(), expires_at=datetime.utcnow() + timedelta(days=7))
        )
        await db.commit()

        token = create_access_token(existing_user.id, existing_user.role)
        return AuthResponse(
            access_token=token,
            user={
                "id": existing_user.id,
                "email": existing_user.email,
                "full_name": existing_user.full_name,
                "role": existing_user.role,
            },
        )

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role="user",
        is_active=True,
    )
    db.add(user)
    await db.flush()

    sub = Subscription(
        user_id=user.id,
        tier="free_trial",
        status="active",
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(sub)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, user.role)
    return AuthResponse(
        access_token=token,
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        },
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db=Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    token = create_access_token(user.id, user.role)
    return AuthResponse(
        access_token=token,
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        },
    )


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
    }
