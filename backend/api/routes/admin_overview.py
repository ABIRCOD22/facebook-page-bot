"""Master overview dashboard aggregates."""

from datetime import datetime, timedelta
from sqlalchemy import func, select
from fastapi import APIRouter, Depends

from api.dependencies import require_admin
from database.connection import get_db
from models.database_models import (
    Alert,
    Conversation,
    FacebookPage,
    Product,
    Subscription,
    User,
)
from services.alert_service import refresh as refresh_alerts

router = APIRouter(prefix="/api/admin/overview", tags=["admin-overview"])

# ponytail: placeholder BDT monthly pricing per tier — replace with a real pricing table later.
TIER_PRICE = {
    "free_trial": 0,
    "starter": 500,
    "professional": 1500,
    "enterprise": 4000,
}


@router.get("")
async def overview(admin=Depends(require_admin), db=Depends(get_db)):
    await refresh_alerts()

    now = datetime.utcnow()
    last_30 = now - timedelta(days=30)

    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (
        await db.execute(select(func.count(User.id)).where(User.is_active == True))  # noqa: E712
    ).scalar() or 0
    new_signups = (
        await db.execute(select(func.count(User.id)).where(User.created_at >= last_30))
    ).scalar() or 0

    total_pages = (await db.execute(select(func.count(FacebookPage.id)))).scalar() or 0
    active_bots = (
        await db.execute(
            select(func.count(FacebookPage.id)).where(FacebookPage.is_active == True)  # noqa: E712
        )
    ).scalar() or 0

    subs = (await db.execute(select(Subscription))).scalars().all()
    active_subs = [s for s in subs if s.status == "active"]
    suspended_subs = [s for s in subs if s.status == "suspended"]
    mrr = sum(TIER_PRICE.get(s.tier, 0) for s in active_subs)

    messages_used = sum((s.messages_used or 0) for s in subs)
    messages_limit = sum((s.max_messages_per_month or 0) for s in subs)
    total_products = (await db.execute(select(func.count(Product.id)))).scalar() or 0
    total_conversations = (await db.execute(select(func.count(Conversation.id)))).scalar() or 0

    open_alerts = (
        await db.execute(select(func.count(Alert.id)).where(Alert.is_resolved == False))  # noqa: E712
    ).scalar() or 0

    recent_users = (
        await db.execute(select(User).order_by(User.created_at.desc()).limit(5))
    ).scalars().all()
    recent_alerts = (
        await db.execute(select(Alert).order_by(Alert.created_at.desc()).limit(5))
    ).scalars().all()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "new_signups_30d": new_signups,
        "total_pages": total_pages,
        "active_bots": active_bots,
        "paused_bots": total_pages - active_bots,
        "total_subscriptions": len(subs),
        "active_subscriptions": len(active_subs),
        "suspended_subscriptions": len(suspended_subs),
        "mrr": mrr,
        "messages_used": messages_used,
        "messages_limit": messages_limit,
        "total_products": total_products,
        "total_conversations": total_conversations,
        "open_alerts": open_alerts,
        "recent_users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "is_active": u.is_active,
            }
            for u in recent_users
        ],
        "recent_alerts": [
            {
                "id": a.id,
                "severity": a.severity,
                "type": a.type,
                "message": a.message,
                "is_resolved": a.is_resolved,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in recent_alerts
        ],
    }
