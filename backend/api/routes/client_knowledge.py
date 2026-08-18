"""Phase 2D: Knowledge Base CRUD API."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

from api.dependencies import get_current_user
from core.rag_engine import RAGEngine
from database.connection import get_db
from models.database_models import KnowledgeBase, User

router = APIRouter(prefix="/api/client", tags=["client-knowledge"])


class KnowledgeCreate(BaseModel):
    title: str
    content: str
    category: str = "general"


class KnowledgeUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    category: str | None = None


@router.get("/knowledge")
async def list_knowledge(
    user: User = Depends(get_current_user),
    db=Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = "",
):
    query = select(KnowledgeBase).where(
        KnowledgeBase.user_id == user.id, KnowledgeBase.is_active == True  # noqa: E712
    )
    if search:
        query = query.where(KnowledgeBase.title.ilike(f"%{search}%"))
    query = query.order_by(KnowledgeBase.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": [
            {
                "id": item.id,
                "title": item.title,
                "content": item.content,
                "category": item.category,
                "is_active": item.is_active,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in items
        ],
        "page": page,
        "per_page": per_page,
    }


@router.get("/knowledge/{kb_id}")
async def get_knowledge(
    kb_id: str,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == kb_id, KnowledgeBase.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Article not found")

    return {
        "id": item.id,
        "title": item.title,
        "content": item.content,
        "category": item.category,
        "is_active": item.is_active,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


@router.post("/knowledge", status_code=201)
async def create_knowledge(
    body: KnowledgeCreate,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    item = KnowledgeBase(
        user_id=user.id,
        title=body.title,
        content=body.content,
        category=body.category,
    )
    db.add(item)
    await db.flush()

    # Index in Chroma
    rag = RAGEngine(user.id)
    rag.add_document(
        doc_id=item.id,
        title=item.title,
        content=item.content,
        category=item.category,
    )

    await db.commit()
    return {"id": item.id, "status": "created"}


@router.put("/knowledge/{kb_id}")
async def update_knowledge(
    kb_id: str,
    body: KnowledgeUpdate,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == kb_id, KnowledgeBase.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Article not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    # Re-index in Chroma
    rag = RAGEngine(user.id)
    rag.add_document(
        doc_id=item.id,
        title=item.title,
        content=item.content,
        category=item.category,
    )

    await db.commit()
    return {"status": "updated"}


@router.delete("/knowledge/{kb_id}")
async def delete_knowledge(
    kb_id: str,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == kb_id, KnowledgeBase.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Article not found")

    item.is_active = False

    # Remove from Chroma
    rag = RAGEngine(user.id)
    rag.delete_document(item.id)

    await db.commit()
    return {"status": "deleted"}


@router.put("/knowledge/{kb_id}/toggle")
async def toggle_knowledge(
    kb_id: str,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == kb_id, KnowledgeBase.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Article not found")

    item.is_active = not item.is_active

    rag = RAGEngine(user.id)
    if item.is_active:
        rag.add_document(
            doc_id=item.id,
            title=item.title,
            content=item.content,
            category=item.category,
        )
    else:
        rag.delete_document(item.id)

    await db.commit()
    return {"status": "toggled", "is_active": item.is_active}
