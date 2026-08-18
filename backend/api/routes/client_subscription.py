"""Client subscription status API.

Returns the caller's current plan state, including whether the trial has
expired and payment is now required. The actual payment collection (Gini Pay)
is wired later — `payment_url` is reserved for that integration.
"""

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select

from api.dependencies import get_current_user
from database.connection import get_db
from models.database_models import Subscription, User

router = APIRouter(prefix="/api/client", tags=["client-subscription"])


@router.get("/subscription")
async def get_subscription(user: User = Depends(get_current_user), db=Depends(get_db)):
    sub = (
        await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    ).scalar_one_or_none()

    if not sub:
        return _status(None, active=False, expired=True)

    now = datetime.utcnow()
    expired = sub.expires_at is None or sub.expires_at < now or sub.status != "active"
    return _status(sub, active=sub.status == "active", expired=expired)


def _status(sub: Subscription | None, active: bool, expired: bool) -> dict:
    if sub is None:
        return {
            "tier": None,
            "status": "none",
            "is_trial": False,
            "payment_required": True,
            "days_remaining": 0,
            "expires_at": None,
            "started_at": None,
            "max_messages_per_month": 0,
            "messages_used": 0,
            "payment_url": None,
        }

    now = datetime.utcnow()
    days_remaining = 0
    if sub.expires_at is not None and sub.expires_at >= now:
        days_remaining = (sub.expires_at - now).days

    return {
        "tier": sub.tier,
        "status": sub.status,
        "is_trial": sub.tier == "free_trial",
        "payment_required": expired,
        "days_remaining": days_remaining,
        "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
        "started_at": sub.started_at.isoformat() if sub.started_at else None,
        "max_messages_per_month": sub.max_messages_per_month,
        "messages_used": sub.messages_used,
        "payment_url": None,  # Gini Pay wired later
    }
