"""Admin conversation oversight: list across all users, inspect messages, delete."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from api.dependencies import require_admin
from database.connection import get_db
from models.database_models import Conversation, FacebookPage, Message, User

router = APIRouter(prefix="/api/admin/conversations", tags=["admin-conversations"])


@router.get("")
async def list_conversations(
    search: str | None = None,
    limit: int = 25,
    offset: int = 0,
    admin: User = Depends(require_admin),
    db=Depends(get_db),
):
    limit = min(max(limit, 1), 100)
    query = (
        select(Conversation)
        .options(selectinload(Conversation.page).selectinload(FacebookPage.user))
        .join(FacebookPage, Conversation.page_id == FacebookPage.id)
        .join(User, FacebookPage.user_id == User.id)
    )
    if search:
        like = f"%{search.lower()}%"
        query = query.where(
            (Conversation.customer_name.ilike(like)) | (Conversation.customer_fb_id.ilike(like))
        )
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    rows = (await db.execute(query.order_by(Conversation.last_message_at.desc()).limit(limit).offset(offset))).scalars().all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "conversations": [
            {
                "id": c.id,
                "customer_name": c.customer_name,
                "customer_fb_id": c.customer_fb_id,
                "status": c.status,
                "message_count": c.message_count,
                "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
                "page_name": c.page.page_name if c.page else None,
                "owner_email": c.page.user.email if c.page and c.page.user else None,
            }
            for c in rows
        ],
    }


@router.get("/{conv_id}")
async def get_conversation(conv_id: str, admin: User = Depends(require_admin), db=Depends(get_db)):
    conv = (await db.execute(select(Conversation).where(Conversation.id == conv_id))).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    msgs = (await db.execute(select(Message).where(Message.conversation_id == conv_id).order_by(Message.timestamp))).scalars().all()
    return {
        "conversation": {
            "id": conv.id,
            "customer_name": conv.customer_name,
            "status": conv.status,
            "started_at": conv.started_at.isoformat() if conv.started_at else None,
        },
        "messages": [
            {
                "id": m.id,
                "sender_type": m.sender_type,
                "content": m.content,
                "message_type": m.message_type,
                "image_url": m.image_url,
                "timestamp": m.timestamp.isoformat() if m.timestamp else None,
            }
            for m in msgs
        ],
    }


@router.delete("/{conv_id}")
async def delete_conversation(conv_id: str, admin: User = Depends(require_admin), db=Depends(get_db)):
    conv = (await db.execute(select(Conversation).where(Conversation.id == conv_id))).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    msgs = (await db.execute(select(Message).where(Message.conversation_id == conv_id))).scalars().all()
    for m in msgs:
        await db.delete(m)
    await db.delete(conv)
    await db.commit()
    return {"ok": True}
