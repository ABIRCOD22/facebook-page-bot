"""Admin subscription oversight: list all subscriptions with owner email."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from api.dependencies import require_admin
from database.connection import get_db
from models.database_models import Subscription, User

router = APIRouter(prefix="/api/admin/subscriptions", tags=["admin-subscriptions"])


@router.get("")
async def list_subscriptions(
    status_filter: str | None = None,
    tier: str | None = None,
    limit: int = 25,
    offset: int = 0,
    admin: User = Depends(require_admin),
    db=Depends(get_db),
):
    limit = min(max(limit, 1), 100)
    query = select(Subscription).options(selectinload(Subscription.user)).join(User, Subscription.user_id == User.id)
    if status_filter:
        query = query.where(Subscription.status == status_filter)
    if tier:
        query = query.where(Subscription.tier == tier)
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    rows = (await db.execute(query.order_by(Subscription.expires_at.desc()).limit(limit).offset(offset))).scalars().all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "subscriptions": [
            {
                "user_id": s.user_id,
                "user_email": s.user.email,
                "user_name": s.user.full_name,
                "tier": s.tier,
                "status": s.status,
                "messages_limit": s.max_messages_per_month,
                "messages_used": s.messages_used,
                "ends_at": s.expires_at.isoformat() if s.expires_at else None,
                "is_active": s.user.is_active,
            }
            for s in rows
        ],
    }
