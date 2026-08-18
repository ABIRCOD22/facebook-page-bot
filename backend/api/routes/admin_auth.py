"""Admin authentication: password login (step 1), TOTP 2FA (step 2), setup, impersonate."""

import pyotp
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select

from api.dependencies import require_admin
from database.connection import get_db
from models.database_models import User
from utils.password import hash_password, verify_password
from utils.token import (
    create_admin_token,
    create_access_token,
    create_temp_token,
    decode_temp_token,
)

router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Verify2faRequest(BaseModel):
    temp_token: str
    code: str


class Setup2faResponse(BaseModel):
    otpauth_uri: str
    secret: str


class ImpersonateResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/login")
async def login(body: LoginRequest, db=Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if user.role != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    # No TOTP enrolled yet → allow first-time login (admin should enroll after).
    if not user.totp_secret:
        token = create_admin_token(user.id, user.role)
        return {
            "requires_2fa": False,
            "access_token": token,
            "user": _user_dict(user),
        }

    temp = create_temp_token(user.id, "2fa", minutes=5)
    return {"requires_2fa": True, "temp_token": temp}


@router.post("/verify-2fa")
async def verify_2fa(body: Verify2faRequest, db=Depends(get_db)):
    payload = decode_temp_token(body.temp_token, "2fa")
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired 2FA session")

    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.totp_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="2FA not configured")

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid 2FA code")

    token = create_admin_token(user.id, user.role)
    return {"access_token": token, "user": _user_dict(user)}


@router.post("/setup-2fa", response_model=Setup2faResponse)
async def setup_2fa(admin: User = Depends(require_admin), db=Depends(get_db)):
    """Generate a TOTP secret + otpauth URI for the logged-in admin to enroll."""
    secret = pyotp.random_base32()
    uri = pyotp.TOTP(secret).provisioning_uri(name=admin.email, issuer_name="ChatriX Admin")
    # Persist the secret; it becomes active once the admin confirms a code elsewhere.
    admin.totp_secret = secret
    await db.commit()
    return Setup2faResponse(otpauth_uri=uri, secret=secret)


@router.get("/me")
async def me(admin: User = Depends(require_admin)):
    return _user_dict(admin)


@router.post("/users/{user_id}/impersonate", response_model=ImpersonateResponse)
async def impersonate(user_id: str, admin: User = Depends(require_admin), db=Depends(get_db)):
    """Issue a CLIENT token for `user_id` so the admin can log in as that user."""
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    token = create_access_token(target.id, target.role)
    return ImpersonateResponse(
        access_token=token,
        user={
            "id": target.id,
            "email": target.email,
            "full_name": target.full_name,
            "role": target.role,
        },
    )


def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "two_factor_enabled": bool(user.totp_secret),
    }
