"""JWT token creation and verification using PyJWT."""

from datetime import datetime, timedelta, timezone

import jwt

from config import get_settings


def create_access_token(user_id: int, role: str = "user") -> str:
    """Create a JWT access token."""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """Decode and validate a JWT token. Returns payload or None if invalid."""
    settings = get_settings()
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def _admin_secret() -> str:
    settings = get_settings()
    return settings.ADMIN_JWT_SECRET_KEY or settings.JWT_SECRET_KEY


def create_admin_token(user_id: int, role: str = "super_admin") -> str:
    """Create an admin JWT (isolated by its own secret + audience)."""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "role": role,
        "aud": "admin",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, _admin_secret(), algorithm=settings.JWT_ALGORITHM)


def decode_admin_token(token: str) -> dict | None:
    """Decode and validate an admin JWT. Returns payload or None if invalid."""
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            _admin_secret(),
            algorithms=[settings.JWT_ALGORITHM],
            audience="admin",
        )
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, jwt.InvalidAudienceError):
        return None


def create_temp_token(user_id: int, purpose: str = "2fa", minutes: int = 5) -> str:
    """Short-lived token (password proven) exchanged for a real admin token after 2FA."""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    payload = {
        "sub": str(user_id),
        "purpose": purpose,
        "aud": "admin-2fa",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, _admin_secret(), algorithm=settings.JWT_ALGORITHM)


def decode_temp_token(token: str, purpose: str = "2fa") -> dict | None:
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            _admin_secret(),
            algorithms=[settings.JWT_ALGORITHM],
            audience="admin-2fa",
        )
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, jwt.InvalidAudienceError):
        return None
