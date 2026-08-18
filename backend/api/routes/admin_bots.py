"""Admin bot (Facebook page) control: list across all users, pause/resume."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from api.dependencies import require_admin
from database.connection import get_db
from models.database_models import FacebookPage, User
from services.audit_service import log_admin_action

router = APIRouter(prefix="/api/admin/bots", tags=["admin-bots"])


@router.get("")
async def list_bots(
    status_filter: str | None = None,  # active | paused
    limit: int = 25,
    offset: int = 0,
    admin: User = Depends(require_admin),
    db=Depends(get_db),
):
    limit = min(max(limit, 1), 100)
    query = select(FacebookPage).options(selectinload(FacebookPage.user)).join(User, FacebookPage.user_id == User.id)
    if status_filter == "active":
        query = query.where(FacebookPage.is_active == True)  # noqa: E712
    elif status_filter == "paused":
        query = query.where(FacebookPage.is_active == False)  # noqa: E712
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    rows = (await db.execute(query.order_by(FacebookPage.connected_at.desc()).limit(limit).offset(offset))).scalars().all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "bots": [
            {
                "page_id": p.id,
                "name": p.page_name,
                "fb_page_id": p.page_id,
                "is_active": p.is_active,
                "owner_email": p.user.email,
                "owner_id": p.user_id,
            }
            for p in rows
        ],
    }


@router.post("/{page_id}/pause")
async def pause_bot(page_id: str, admin: User = Depends(require_admin), db=Depends(get_db)):
    page = (await db.execute(select(FacebookPage).where(FacebookPage.id == page_id))).scalar_one_or_none()
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    page.is_active = False
    await db.commit()
    await log_admin_action(admin.id, "bot_pause", "page", page_id)
    return {"ok": True, "is_active": False}


@router.post("/{page_id}/resume")
async def resume_bot(page_id: str, admin: User = Depends(require_admin), db=Depends(get_db)):
    page = (await db.execute(select(FacebookPage).where(FacebookPage.id == page_id))).scalar_one_or_none()
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    page.is_active = True
    await db.commit()
    await log_admin_action(admin.id, "bot_resume", "page", page_id)
    return {"ok": True, "is_active": True}
