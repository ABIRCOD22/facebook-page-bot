"""Master overview dashboard aggregates."""

import asyncio
from datetime import datetime, timedelta
from sqlalchemy import select, text
from fastapi import APIRouter, Depends

from api.dependencies import require_admin
from database.connection import AsyncSessionFactory, get_db
from models.database_models import Alert, Subscription, User
from services.alert_service import refresh as refresh_alerts
from services.cache import cached_or_compute

router = APIRouter(prefix="/api/admin/overview", tags=["admin-overview"])

# ponytail: placeholder BDT monthly pricing per tier — replace with a real pricing table later.
TIER_PRICE = {
    "free_trial": 0,
    "starter": 500,
    "professional": 1500,
    "enterprise": 4000,
}

# All dashboard counters in ONE round trip — Supabase is a remote DB, each
# sequential query costs ~300ms of network RTT.
_COUNTERS_SQL = text(
    """
    SELECT
      (SELECT count(*) FROM users) AS total_users,
      (SELECT count(*) FROM users WHERE is_active) AS active_users,
      (SELECT count(*) FROM users WHERE created_at >= :last_30) AS new_signups,
      (SELECT count(*) FROM facebook_pages) AS total_pages,
      (SELECT count(*) FROM facebook_pages WHERE is_active) AS active_bots,
      (SELECT count(*) FROM products) AS total_products,
      (SELECT count(*) FROM conversations) AS total_conversations,
      (SELECT count(*) FROM alerts WHERE is_resolved IS NOT TRUE) AS open_alerts
    """
)


@router.get("")
async def overview(admin=Depends(require_admin), db=Depends(get_db)):
    # ponytail: alert scan runs in the background — alerts simply appear one
    # dashboard load later instead of blocking every request with a full
    # users × pages scan. If alert freshness matters on first paint, promote
    # this to a periodic background task instead.
    asyncio.create_task(refresh_alerts())

    now = datetime.utcnow()
    last_30 = now - timedelta(days=30)

    async def _compute():
        row = (await db.execute(_COUNTERS_SQL, {"last_30": last_30})).mappings().one()

        # Remaining reads are independent — run them concurrently on separate
        # sessions so remote-DB RTTs overlap instead of stacking.
        async def _with_new_session(fn):
            async with AsyncSessionFactory() as s:
                return await fn(s)

        async def _read_subs(s):
            return (await s.execute(select(Subscription))).scalars().all()

        async def _read_recent_users(s):
            return (await s.execute(select(User).order_by(User.created_at.desc()).limit(5))).scalars().all()

        async def _read_recent_alerts(s):
            return (await s.execute(select(Alert).order_by(Alert.created_at.desc()).limit(5))).scalars().all()

        subs, recent_users, recent_alerts = await asyncio.gather(
            _with_new_session(_read_subs),
            _with_new_session(_read_recent_users),
            _with_new_session(_read_recent_alerts),
        )

        total_users = row["total_users"]
        active_users = row["active_users"]
        new_signups = row["new_signups"]
        total_pages = row["total_pages"]
        active_bots = row["active_bots"]
        total_products = row["total_products"]
        total_conversations = row["total_conversations"]
        open_alerts = row["open_alerts"]

        active_subs = [s for s in subs if s.status == "active"]
        suspended_subs = [s for s in subs if s.status == "suspended"]
        mrr = sum(TIER_PRICE.get(s.tier, 0) for s in active_subs)

        messages_used = sum((s.messages_used or 0) for s in subs)
        messages_limit = sum((s.max_messages_per_month or 0) for s in subs)

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

    # 30s TTL — dashboard counters don't need sub-minute freshness.
    return await cached_or_compute("admin:overview", 30, _compute)
