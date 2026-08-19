"""Platform analytics aggregates for charts."""

import asyncio
from collections import defaultdict
from datetime import datetime, timedelta
from sqlalchemy import select, text
from fastapi import APIRouter, Depends

from api.dependencies import require_admin
from database.connection import AsyncSessionFactory
from models.database_models import Message, Subscription, User

router = APIRouter(prefix="/api/admin/analytics", tags=["admin-analytics"])

TIER_PRICE = {"free_trial": 0, "starter": 500, "professional": 1500, "enterprise": 4000}

_TOTALS_SQL = text(
    """
    SELECT
      (SELECT count(*) FROM messages) AS messages,
      (SELECT count(*) FROM conversations) AS conversations
    """
)


async def _with_new_session(fn):
    async with AsyncSessionFactory() as s:
        return await fn(s)


async def _read_msgs(s, since):
    return (
        await s.execute(select(Message.timestamp).where(Message.timestamp >= since))
    ).scalars().all()


async def _read_users(s, since):
    return (
        await s.execute(select(User.created_at).where(User.created_at >= since))
    ).scalars().all()


async def _read_subs(s):
    return (await s.execute(select(Subscription))).scalars().all()


async def _read_totals(s):
    return (await s.execute(_TOTALS_SQL)).mappings().one()


@router.get("")
async def analytics(admin=Depends(require_admin)):
    now = datetime.utcnow()
    since = now - timedelta(days=14)

    # All reads are independent — one concurrent wave of remote-DB round trips.
    reads = await asyncio.gather(
        _with_new_session(lambda s: _read_msgs(s, since)),
        _with_new_session(lambda s: _read_users(s, since)),
        _with_new_session(_read_subs),
        _with_new_session(_read_totals),
    )
    msgs, users, subs, totals = reads

    # Messages per day (last 14 days)
    per_day = defaultdict(int)
    for ts in msgs:
        per_day[ts.date().isoformat()] += 1
    messages_trend = [{"date": (since + timedelta(days=i)).date().isoformat(), "count": per_day[(since + timedelta(days=i)).date().isoformat()]} for i in range(15)]

    # New users per day
    u_per_day = defaultdict(int)
    for ts in users:
        u_per_day[ts.date().isoformat()] += 1
    users_trend = [{"date": (since + timedelta(days=i)).date().isoformat(), "count": u_per_day[(since + timedelta(days=i)).date().isoformat()]} for i in range(15)]

    # Revenue by tier (active subs)
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
        async with AsyncSessionFactory() as s:
            found = (await s.execute(select(User.id, User.email).where(User.id.in_(top_user_ids)))).all()
        emails = {uid: email for uid, email in found}
    top_users = [
        {"user_id": s.user_id, "email": emails.get(s.user_id, "?"), "messages_used": s.messages_used or 0}
        for s in top
    ]

    return {
        "messages_trend": messages_trend,
        "users_trend": users_trend,
        "revenue_by_tier": revenue_by_tier,
        "top_users": top_users,
        "totals": {"messages": totals["messages"], "conversations": totals["conversations"]},
    }
