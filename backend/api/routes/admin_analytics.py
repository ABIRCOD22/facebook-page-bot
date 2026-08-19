"""Platform analytics aggregates for charts."""

from collections import defaultdict
from datetime import datetime, timedelta
from sqlalchemy import select, text
from fastapi import APIRouter, Depends

from api.dependencies import require_admin
from database.connection import get_db
from models.database_models import Conversation, Message, Subscription, User

router = APIRouter(prefix="/api/admin/analytics", tags=["admin-analytics"])

TIER_PRICE = {"free_trial": 0, "starter": 500, "professional": 1500, "enterprise": 4000}

_TOTALS_SQL = text(
    """
    SELECT
      (SELECT count(*) FROM messages) AS messages,
      (SELECT count(*) FROM conversations) AS conversations
    """
)


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

    # Top users by messages used — one IN query instead of N lookups
    top = sorted(subs, key=lambda s: s.messages_used or 0, reverse=True)[:10]
    top_user_ids = [s.user_id for s in top]
    emails = {}
    if top_user_ids:
        found = (
            await db.execute(select(User.id, User.email).where(User.id.in_(top_user_ids)))
        ).all()
        emails = {uid: email for uid, email in found}
    top_users = [
        {"user_id": s.user_id, "email": emails.get(s.user_id, "?"), "messages_used": s.messages_used or 0}
        for s in top
    ]

    totals = (await db.execute(_TOTALS_SQL)).mappings().one()

    return {
        "messages_trend": messages_trend,
        "users_trend": users_trend,
        "revenue_by_tier": revenue_by_tier,
        "top_users": top_users,
        "totals": {"messages": totals["messages"], "conversations": totals["conversations"]},
    }
