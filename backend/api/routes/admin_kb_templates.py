"""Global KB templates: CRUD + push to users' knowledge bases."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from api.dependencies import require_admin
from database.connection import get_db
from models.database_models import KnowledgeBase, KbTemplate, User

router = APIRouter(prefix="/api/admin/kb-templates", tags=["admin-kb-templates"])


class TemplateBody(BaseModel):
    title: str
    content: str
    category: str = "general"


@router.get("")
async def list_templates(search: str | None = None, admin=Depends(require_admin), db=Depends(get_db)):
    query = select(KbTemplate)
    if search:
        query = query.where(KbTemplate.title.ilike(f"%{search}%"))
    rows = (await db.execute(query.order_by(KbTemplate.created_at.desc()))).scalars().all()
    return {
        "templates": [
            {
                "id": t.id,
                "title": t.title,
                "content": t.content,
                "category": t.category,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in rows
        ]
    }


@router.post("")
async def create_template(body: TemplateBody, admin=Depends(require_admin), db=Depends(get_db)):
    t = KbTemplate(title=body.title, content=body.content, category=body.category, created_by=admin.id)
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return {"id": t.id}


@router.put("/{template_id}")
async def update_template(template_id: str, body: TemplateBody, admin=Depends(require_admin), db=Depends(get_db)):
    t = (await db.execute(select(KbTemplate).where(KbTemplate.id == template_id))).scalar_one_or_none()
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    t.title = body.title
    t.content = body.content
    t.category = body.category
    await db.commit()
    return {"ok": True}


@router.delete("/{template_id}")
async def delete_template(template_id: str, admin=Depends(require_admin), db=Depends(get_db)):
    t = (await db.execute(select(KbTemplate).where(KbTemplate.id == template_id))).scalar_one_or_none()
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    await db.delete(t)
    await db.commit()
    return {"ok": True}


@router.post("/{template_id}/apply")
async def apply_template(template_id: str, admin=Depends(require_admin), db=Depends(get_db)):
    t = (await db.execute(select(KbTemplate).where(KbTemplate.id == template_id))).scalar_one_or_none()
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    users = (await db.execute(select(User))).scalars().all()
    pushed = 0
    for u in users:
        db.add(
            KnowledgeBase(
                user_id=u.id,
                title=t.title,
                content=t.content,
                category=t.category,
            )
        )
        pushed += 1
    await db.commit()
    return {"ok": True, "pushed": pushed}
