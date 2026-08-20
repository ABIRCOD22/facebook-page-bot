"""Client conversations inbox — list threads and read/send messages.

Messages are written by the webhook into the DB; this router exposes them to
the page owner (tenant-scoped by the user's active pages) and lets a human
agent reply inline.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, select, update

from api.dependencies import get_current_user
from core.conversation_manager import ConversationManager
from database.connection import get_db
from models.database_models import Conversation, FacebookPage, Message, User
from services.facebook_service import FacebookService

router = APIRouter(prefix="/api/client/conversations", tags=["client-conversations"])


async def _user_page_ids(user_id: str, db) -> set:
    rows = (
        await db.execute(
            select(FacebookPage.id).where(
                FacebookPage.user_id == user_id, FacebookPage.is_active == True  # noqa: E712
            )
        )
    ).scalars().all()
    return set(rows)


@router.get("")
async def list_conversations(user: User = Depends(get_current_user), db=Depends(get_db)):
    page_ids = await _user_page_ids(user.id, db)
    if not page_ids:
        return {"conversations": []}
    result = await db.execute(
        select(Conversation)
        .where(Conversation.page_id.in_(page_ids))
        .order_by(desc(Conversation.last_message_at))
    )
    convs = result.scalars().all()
    out = []
    for c in convs:
        last = (
            await db.execute(
                select(Message)
                .where(Message.conversation_id == c.id)
                .order_by(desc(Message.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()
        out.append(
            {
                "id": c.id,
                "customer_name": c.customer_name,
                "status": c.status,
                "taken_over_at": c.taken_over_at,
                "message_count": c.message_count,
                "last_message_at": c.last_message_at,
                "preview": last.content if last else "",
                "preview_sender": last.sender_type if last else None,
            }
        )
    return {"conversations": out}


@router.get("/{conversation_id}")
async def get_conversation(conversation_id: str, user: User = Depends(get_current_user), db=Depends(get_db)):
    conv = (
        await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    ).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if conv.page_id not in await _user_page_ids(user.id, db):
        raise HTTPException(status_code=403, detail="Forbidden.")

    msgs = (
        await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.timestamp)
        )
    ).scalars().all()
    return {
        "id": conv.id,
        "customer_name": conv.customer_name,
        "status": conv.status,
        "taken_over_at": conv.taken_over_at,
        "messages": [
            {
                "id": m.id,
                "sender_type": m.sender_type,
                "content": m.content,
                "message_type": m.message_type,
                "timestamp": m.timestamp,
            }
            for m in msgs
        ],
    }


class SendBody(BaseModel):
    content: str


@router.post("/{conversation_id}/send")
async def send_message(
    conversation_id: str,
    body: SendBody,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    conv = (
        await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    ).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    page_ids = await _user_page_ids(user.id, db)
    if conv.page_id not in page_ids:
        raise HTTPException(status_code=403, detail="Forbidden.")

    page = (
        await db.execute(select(FacebookPage).where(FacebookPage.id == conv.page_id))
    ).scalar_one_or_none()
    ok = await FacebookService.send_text_message(
        conv.customer_fb_id, body.content, page.page_access_token
    )
    if not ok:
        raise HTTPException(status_code=502, detail="Failed to send message to Facebook.")

    await ConversationManager(conv.page_id).add_message(
        conversation_id=conv.id,
        sender_type="human_agent",
        content=body.content,
    )

    # A human reply hands the thread over: the bot goes silent here and a
    # kill timer starts. Each moderator reply refreshes the timer.
    await ConversationManager(conv.page_id).take_over(conv.id)
    return {"status": "sent"}


@router.post("/{conversation_id}/resume")
async def resume_conversation(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """Give a taken-over conversation back to the bot immediately."""
    conv = (
        await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    ).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if conv.page_id not in await _user_page_ids(user.id, db):
        raise HTTPException(status_code=403, detail="Forbidden.")

    await ConversationManager(conv.page_id).resume(conv.id)
    return {"status": "resumed"}


@router.post("/takeover-all")
async def takeover_all(user: User = Depends(get_current_user), db=Depends(get_db)):
    """Moderator takes over every active conversation at once — the bot pauses
    on all of them in one click. Each thread's kill timer starts now, so the
    bot will still re-engage any thread the moderator goes quiet on."""
    from datetime import datetime

    page_ids = await _user_page_ids(user.id, db)
    if not page_ids:
        return {"taken_over": 0}
    result = await db.execute(
        update(Conversation)
        .where(
            Conversation.page_id.in_(page_ids),
            Conversation.status == "active",
        )
        .values(status="handed_over", taken_over_at=datetime.utcnow())
    )
    await db.commit()
    return {"taken_over": result.rowcount or 0}
