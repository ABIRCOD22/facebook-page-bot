"""Client Facebook page connection (BYOA + BYO app).

Users either paste a Page Access Token (BYOA), or connect their own
Meta Developer app via OAuth code exchange (BYO app). Either way we
validate via Graph API, store the FacebookPage row (tenant-scoped),
best-effort subscribe the webhook, and can run a business scan.
"""

import json
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from api.dependencies import get_current_user
from config import get_settings
from database.connection import get_db
from models.database_models import FacebookPage, Subscription, User
from services.business_scanner import scan_page
from services.page_connector import (
    configure_app_webhook,
    exchange_code,
    list_manageable_pages,
    make_long_lived_user_token,
    subscribe_app,
    validate_token,
)

router = APIRouter(prefix="/api/client/pages", tags=["client-pages"])
settings = get_settings()


class ConnectRequest(BaseModel):
    page_access_token: str
    fb_app_id: str | None = None
    fb_app_secret: str | None = None


class ConnectByoRequest(BaseModel):
    app_id: str
    app_secret: str
    code: str
    redirect_uri: str


async def _enforce_page_limit(db, user: User):
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


async def _save_tenant_page(
    db,
    user: User,
    page_id: str,
    page_name: str,
    access_token: str,
    fb_app_id: str | None,
    fb_app_secret: str | None,
    verify_token: str | None,
):
    page = (
        await db.execute(select(FacebookPage).where(FacebookPage.page_id == page_id))
    ).scalar_one_or_none()
    if page and page.user_id != user.id:
        raise HTTPException(status_code=400, detail="This page is already connected to another account.")

    if page is None:
        page = FacebookPage(page_id=page_id, page_name=page_name)
        db.add(page)
    page.user_id = user.id
    page.page_name = page_name
    page.page_access_token = access_token
    page.fb_app_id = fb_app_id
    page.fb_app_secret = fb_app_secret
    page.verify_token = verify_token or page.verify_token
    page.is_active = True
    await db.commit()
    await db.refresh(page)
    return page


@router.post("/connect")
async def connect_page(
    body: ConnectRequest,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    await _enforce_page_limit(db, user)

    try:
        info = await validate_token(body.page_access_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    page = await _save_tenant_page(
        db,
        user,
        info["page_id"],
        info["page_name"],
        body.page_access_token,
        body.fb_app_id,
        body.fb_app_secret,
        None,
    )

    # Per-page verify token for the user's own app webhook config:
    # Meta will GET our /api/webhook with this token when they save
    # the callback URL in App Dashboard. Only generated when the user
    # brings their own app (their app_secret signs the events).
    if body.fb_app_id and not page.verify_token:
        page.verify_token = secrets.token_urlsafe(24)
        await db.commit()
        await db.refresh(page)

    # Best-effort: subscribe the app to receive webhook events. Non-fatal.
    try:
        await subscribe_app(page.page_id, page.page_access_token)
    except Exception as e:  # noqa
        import logging
        logging.getLogger(__name__).warning("Webhook subscribe failed for page %s: %s", page.page_id, e)

    return {
        "status": "connected",
        "id": page.id,
        "page_id": page.page_id,
        "page_name": page.page_name,
        "verify_token": page.verify_token or None,
    }


@router.post("/connect-byo")
async def connect_byo_app(
    body: ConnectByoRequest,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """Full BYO Meta app onboarding:

    code → short-lived user token → long-lived user token (~60d) →
    /me/accounts (non-expiring page tokens) → select first manageable
    page → configure the user's app webhook (app_id|app_secret token)
    → subscribe the page.
    """
    await _enforce_page_limit(db, user)

    try:
        short_token = await exchange_code(body.app_id, body.app_secret, body.code, body.redirect_uri)
        long_token = await make_long_lived_user_token(body.app_id, body.app_secret, short_token)
        pages = await list_manageable_pages(long_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Meta auth failed: {e}")

    if not pages:
        raise HTTPException(status_code=400, detail="No pages found for this Meta account. You must have an admin/analyst role on a page.")

    candidate = pages[0]
    page_token = candidate.get("access_token")
    if not page_token:
        raise HTTPException(status_code=400, detail="Meta did not return a page token. Re-check your app's permissions (pages_manage_metadata, pages_messaging, pages_read_engagement).")

    page = await _save_tenant_page(
        db,
        user,
        candidate["id"],
        candidate.get("name", f"Page {candidate['id']}"),
        page_token,
        body.app_id,
        body.app_secret,
        secrets.token_urlsafe(24),
    )

    # Configure the user's app to POST events to us, then subscribe the page.
    if page.verify_token and not await configure_app_webhook(
        body.app_id,
        body.app_secret,
        f"{settings.WEBHOOK_PUBLIC_URL}/api/webhook",
        page.verify_token,
    ):
        raise HTTPException(status_code=400, detail="Webhook config failed on your Meta app. Check callback URL + fields in App Dashboard → Webhooks.")

    try:
        await subscribe_app(page.page_id, page.page_access_token)
    except Exception as e:  # noqa
        import logging
        logging.getLogger(__name__).warning("Page subscribe failed: %s", e)

    return {"status": "connected", "id": page.id, "page_id": page.page_id, "page_name": page.page_name}


@router.post("/{page_db_id}/scan")
async def run_scan(
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
    if not page or not page.is_active:
        raise HTTPException(status_code=404, detail="Page not found.")
    result = await scan_page(user.id, page)
    return {"status": "ok", **result}


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
                "scan_status": p.scan_status or "not_scanned",
                "scanned_at": p.scanned_at,
                "business_profile": json.loads(p.business_profile) if p.business_profile else None,
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
