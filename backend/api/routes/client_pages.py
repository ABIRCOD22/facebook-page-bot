"""Client Facebook page connection (BYOA — Bring Your Own App).

Users paste a Page Access Token; we validate it via Graph API, store the
FacebookPage row (tenant-scoped to the user), and best-effort subscribe the
webhook. Without this, a real user's bot never answers (webhook rejects
unknown pages and the bot endpoint 404s on missing page).
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from api.dependencies import get_current_user
from database.connection import get_db
from models.database_models import FacebookPage, Subscription, User
from services.page_connector import subscribe_app, validate_token

router = APIRouter(prefix="/api/client/pages", tags=["client-pages"])


class ConnectRequest(BaseModel):
    page_access_token: str
    fb_app_id: str | None = None
    fb_app_secret: str | None = None


@router.post("/connect")
async def connect_page(
    body: ConnectRequest,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    # Capacity: respect the plan's max_pages (free_trial = 1).
    sub = (
        await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    ).scalar_one_or_none()
    max_pages = sub.max_pages if sub else 1
    active = (
        await db.execute(
            select(FacebookPage).where(
                FacebookPage.user_id == user.id, FacebookPage.is_active == True  # noqa: E712
            )
        )
    ).scalars().all()
    if len(active) >= max_pages:
        raise HTTPException(
            status_code=403,
            detail=f"Page limit reached for your plan (max {max_pages}).",
        )

    try:
        info = await validate_token(body.page_access_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    page_id = info["page_id"]
    page = (
        await db.execute(select(FacebookPage).where(FacebookPage.page_id == page_id))
    ).scalar_one_or_none()
    if page and page.user_id != user.id:
        raise HTTPException(status_code=400, detail="This page is already connected to another account.")

    if page is None:
        page = FacebookPage(page_id=page_id, page_name=info["page_name"])
        db.add(page)
    page.user_id = user.id
    page.page_name = info["page_name"]
    page.page_access_token = body.page_access_token
    page.fb_app_id = body.fb_app_id
    page.fb_app_secret = body.fb_app_secret
    page.is_active = True
    await db.commit()
    await db.refresh(page)

    # Best-effort: subscribe the app to receive webhook events. Non-fatal.
    try:
        await subscribe_app(page_id, body.page_access_token)
    except Exception as e:  # noqa
        import logging
        logging.getLogger(__name__).warning("Webhook subscribe failed for page %s: %s", page_id, e)

    return {"status": "connected", "id": page.id, "page_id": page_id, "page_name": info["page_name"]}


@router.get("")
async def list_pages(user: User = Depends(get_current_user), db=Depends(get_db)):
    rows = (
        await db.execute(
            select(FacebookPage).where(
                FacebookPage.user_id == user.id, FacebookPage.is_active == True  # noqa: E712
            )
        )
    ).scalars().all()
    return {
        "pages": [
            {
                "id": p.id,
                "page_id": p.page_id,
                "page_name": p.page_name,
                "bot_name": p.bot_name,
                "is_active": p.is_active,
                "connected_at": p.connected_at,
            }
            for p in rows
        ]
    }


@router.delete("/{page_db_id}")
async def disconnect_page(
    page_db_id: str,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    page = (
        await db.execute(
            select(FacebookPage).where(
                FacebookPage.id == page_db_id, FacebookPage.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found.")
    page.is_active = False
    await db.commit()
    return {"status": "disconnected"}
