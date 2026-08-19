"""Client dashboard stats — real-time metrics for the overview page."""

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func, select, and_

from api.dependencies import get_current_user
from database.connection import get_db
from models.database_models import Conversation, FacebookPage, Message, User

router = APIRouter(prefix="/api/client/stats", tags=["client-stats"])


async def _user_page_ids(user_id: str, db) -> set:
    rows = (
        await db.execute(
            select(FacebookPage.id).where(
                FacebookPage.user_id == user_id, FacebookPage.is_active == True
            )
        )
    ).scalars().all()
    return set(rows)


@router.get("")
async def get_stats(user: User = Depends(get_current_user), db=Depends(get_db)):
    page_ids = await _user_page_ids(str(user.id), db)
    if not page_ids:
        return {
            "conversations_today": 0,
            "messages_today": 0,
            "bot_responses_today": 0,
            "avg_response_time_ms": 0,
            "active_conversations": 0,
            "total_conversations": 0,
            "messages_7d": [],
            "bot_status": "offline",
            "connected_page": None,
        }

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # --- Bot status: is any page active ---
    pages = (await db.execute(
        select(FacebookPage).where(FacebookPage.id.in_(page_ids))
    )).scalars().all()
    bot_status = "online" if any(p.is_active for p in pages) else "offline"
    connected_page = pages[0].page_name if pages else None

    # --- Active conversations (messages in last 24h) ---
    yesterday = now - timedelta(hours=24)
    active_convs = (await db.execute(
        select(func.count(Conversation.id)).where(
            and_(
                Conversation.page_id.in_(page_ids),
                Conversation.last_message_at >= yesterday,
            )
        )
    )).scalar() or 0

    # --- Total conversations ---
    total_convs = (await db.execute(
        select(func.count(Conversation.id)).where(
            Conversation.page_id.in_(page_ids)
        )
    )).scalar() or 0

    # --- Messages today (all senders) ---
    messages_today = (await db.execute(
        select(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            and_(
                Conversation.page_id.in_(page_ids),
                Message.timestamp >= today_start,
            )
        )
    )).scalar() or 0

    # --- Bot responses today ---
    bot_today = (await db.execute(
        select(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            and_(
                Conversation.page_id.in_(page_ids),
                Message.sender_type == "bot",
                Message.timestamp >= today_start,
            )
        )
    )).scalar() or 0

    # --- Avg response time: time between customer msg and next bot reply ---
    # We'll compute this from recent conversations (last 50 bot replies)
    avg_ms = 0
    recent_bot_msgs = (await db.execute(
        select(Message.id, Message.conversation_id, Message.timestamp)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            and_(
                Conversation.page_id.in_(page_ids),
                Message.sender_type == "bot",
            )
        )
        .order_by(Message.timestamp.desc())
        .limit(50)
    )).all()

    if recent_bot_msgs:
        deltas = []
        for msg in recent_bot_msgs:
            prev_customer = (await db.execute(
                select(Message.timestamp)
                .where(
                    and_(
                        Message.conversation_id == msg.conversation_id,
                        Message.sender_type == "customer",
                        Message.timestamp < msg.timestamp,
                    )
                )
                .order_by(Message.timestamp.desc())
                .limit(1)
            )).scalar()
            if prev_customer:
                delta = (msg.timestamp - prev_customer).total_seconds() * 1000
                if 0 < delta < 300000:  # skip if > 5 min (stale)
                    deltas.append(delta)
        if deltas:
            avg_ms = int(sum(deltas) / len(deltas))

    # --- Messages per day for last 7 days ---
    messages_7d = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day + timedelta(days=1)
        count = (await db.execute(
            select(func.count(Message.id))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(
                and_(
                    Conversation.page_id.in_(page_ids),
                    Message.timestamp >= day,
                    Message.timestamp < day_end,
                )
            )
        )).scalar() or 0
        messages_7d.append({
            "date": day.strftime("%b %d"),
            "count": count,
        })

    return {
        "conversations_today": active_convs,
        "messages_today": messages_today,
        "bot_responses_today": bot_today,
        "avg_response_time_ms": avg_ms,
        "active_conversations": active_convs,
        "total_conversations": total_convs,
        "messages_7d": messages_7d,
        "bot_status": bot_status,
        "connected_page": connected_page,
    }
