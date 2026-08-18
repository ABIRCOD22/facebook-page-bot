"""Platform analytics aggregates for charts."""

from collections import defaultdict
from datetime import datetime, timedelta
from sqlalchemy import func, select
from fastapi import APIRouter, Depends

from api.dependencies import require_admin
from database.connection import get_db
from models.database_models import Conversation, Message, Subscription, User

router = APIRouter(prefix="/api/admin/analytics", tags=["admin-analytics"])

TIER_PRICE = {"free_trial": 0, "starter": 500, "professional": 1500, "enterprise": 4000}


@router.get("")
async def analytics(admin=Depends(require_admin), db=Depends(get_db)):
    now = datetime.utcnow()
    since = now - timedelta(days=14)

    # Messages per day (last 14 days)
    msgs = (
        await db.execute(select(Message.timestamp).where(Message.timestamp >= since))
    ).scalars().all()
    per_day = defaultdict(int)
    for ts in msgs:
        per_day[ts.date().isoformat()] += 1
    messages_trend = [{"date": (since + timedelta(days=i)).date().isoformat(), "count": per_day[(since + timedelta(days=i)).date().isoformat()]} for i in range(15)]

    # New users per day
    users = (
        await db.execute(select(User.created_at).where(User.created_at >= since))
    ).scalars().all()
    u_per_day = defaultdict(int)
    for ts in users:
        u_per_day[ts.date().isoformat()] += 1
    users_trend = [{"date": (since + timedelta(days=i)).date().isoformat(), "count": u_per_day[(since + timedelta(days=i)).date().isoformat()]} for i in range(15)]

    # Revenue by tier (active subs)
    subs = (await db.execute(select(Subscription))).scalars().all()
    by_tier = defaultdict(lambda: {"count": 0, "mrr": 0})
    for s in subs:
        by_tier[s.tier]["count"] += 1
        if s.status == "active":
            by_tier[s.tier]["mrr"] += TIER_PRICE.get(s.tier, 0)
    revenue_by_tier = [{"tier": k, "count": v["count"], "mrr": v["mrr"]} for k, v in by_tier.items()]

    # Top users by messages used
    top = sorted(subs, key=lambda s: s.messages_used or 0, reverse=True)[:10]
    top_users = []
    for s in top:
        u = (await db.execute(select(User).where(User.id == s.user_id))).scalar_one_or_none()
        top_users.append({"user_id": s.user_id, "email": u.email if u else "?", "messages_used": s.messages_used or 0})

    total_msgs = (await db.execute(select(func.count(Message.id)))).scalar() or 0
    total_convs = (await db.execute(select(func.count(Conversation.id)))).scalar() or 0

    return {
        "messages_trend": messages_trend,
        "users_trend": users_trend,
        "revenue_by_tier": revenue_by_tier,
        "top_users": top_users,
        "totals": {"messages": total_msgs, "conversations": total_convs},
    }
