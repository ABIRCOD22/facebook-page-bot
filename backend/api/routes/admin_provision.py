"""Admin-led white-glove provisioning: connect + configure + scan + deliver.

The admin does the Meta handshake for a page owner (token paste or the owner's
Facebook Login approved in a popup), configures the bot, runs the business
scan, and hands over generated dashboard credentials. Reuses the client-side
connector cores so connect behavior is identical for both paths.
"""

import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from api.dependencies import require_admin
from api.routes.client_bot import BotSettingsUpdate, VALID_LANGUAGES, VALID_TONES
from api.routes.client_pages import (
    FB_STAGING_TTL,
    AvailableRequest,
    ConnectRequest,
    _enforce_page_limit,
    _pick_chosen_page,
    _save_tenant_page,
    available_pages_core,
    build_oauth_url,
    connect_page_core,
)
from api.routes.client_pages import _fb_staging as _staging  # same dict, prefixed key
from config import get_settings
from database.connection import get_db
from models.database_models import FacebookPage, User
from services.audit_service import log_admin_action
from services.business_scanner import scan_page
from services.page_connector import (
    configure_app_webhook,
    exchange_code,
    list_manageable_pages,
    make_long_lived_user_token,
    subscribe_app,
)

router = APIRouter(prefix="/api/admin", tags=["admin-provision"])
settings = get_settings()


def _staging_key(user_id: str) -> str:
    return f"admin:{user_id}"


async def _get_target_user(user_id: str, db) -> User:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")
    return user


async def _get_page(page_db_id: str, db) -> FacebookPage:
    page = (
        await db.execute(select(FacebookPage).where(FacebookPage.id == page_db_id))
    ).scalar_one_or_none()
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return page


# ---------- connect: pasted token (owner brought app id/token) ----------

@router.post("/users/{user_id}/pages/available")
async def admin_available_pages(
    user_id: str,
    body: AvailableRequest,
    admin: User = Depends(require_admin),
    db=Depends(get_db),
):
    """What the owner's pasted token can see — same resolution as the client
    'Find my page' step, so the admin runs the exact flow the owner would."""
    await _get_target_user(user_id, db)
    return await available_pages_core(body)


@router.post("/users/{user_id}/pages/connect")
async def admin_connect_page(
    user_id: str,
    body: ConnectRequest,
    admin: User = Depends(require_admin),
    db=Depends(get_db),
):
    """Connect the page for the target user: same token resolution, limit
    enforcement, webhook subscribe and auto-scan as the client connect."""
    user = await _get_target_user(user_id, db)
    result = await connect_page_core(db, user, body)
    await log_admin_action(admin.id, "provision_connect", "page", result.get("id"), detail=f"user={user.email}")
    return result


# ---------- connect: owner's Facebook Login (we do it with their permission) ----------

class FbCompleteBody(BaseModel):
    code: str
    state: str


class FbSelectBody(BaseModel):
    page_id: str


@router.post("/users/{user_id}/fb/authorize")
async def admin_fb_authorize(
    user_id: str,
    admin: User = Depends(require_admin),
    db=Depends(get_db),
):
    """Start Facebook Login for the owner's page: the owner approves in
    Facebook's own screen (their credentials never touch our server). The
    redirect lands on the admin panel provisioning page."""
    await _get_target_user(user_id, db)
    state = secrets.token_urlsafe(16)
    _staging[_staging_key(user_id)] = {"state": state, "expires": time.time() + FB_STAGING_TTL}
    return {
        "auth_url": build_oauth_url(settings.FB_APP_ID, settings.FB_ADMIN_REDIRECT_URI, state),
        "state": state,
    }


@router.post("/users/{user_id}/fb/complete")
async def admin_fb_complete(
    user_id: str,
    body: FbCompleteBody,
    admin: User = Depends(require_admin),
    db=Depends(get_db),
):
    """Exchange the owner's OAuth code for the manageable pages list."""
    await _get_target_user(user_id, db)
    staged = _staging.get(_staging_key(user_id))
    if (
        not staged
        or staged.get("state") != body.state
        or staged.get("expires", 0) < time.time()
    ):
        raise HTTPException(status_code=400, detail="This Facebook sign-in link is stale — start again.")
    try:
        short = await exchange_code(
            settings.FB_APP_ID, settings.FB_APP_SECRET, body.code, settings.FB_ADMIN_REDIRECT_URI
        )
        long = await make_long_lived_user_token(settings.FB_APP_ID, settings.FB_APP_SECRET, short)
        pages = await list_manageable_pages(long)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Facebook sign-in failed: {e}")
    if not pages:
        raise HTTPException(
            status_code=400,
            detail="No pages found for this Facebook account. The owner must be admin/analyst on at least one page.",
        )

    _staging[_staging_key(user_id)] = {
        "state": staged["state"],
        "pages": pages,
        "expires": time.time() + FB_STAGING_TTL,
    }
    return {
        "token_type": "user",
        "pages": [
            {"page_id": p.get("id"), "page_name": p.get("name") or f"Page {p.get('id')}", "tasks": p.get("tasks", [])}
            for p in pages
        ],
    }


@router.post("/users/{user_id}/fb/select")
async def admin_fb_select(
    user_id: str,
    body: FbSelectBody,
    admin: User = Depends(require_admin),
    db=Depends(get_db),
):
    """Save the chosen owner page under the target user, subscribe our shared
    app's webhook, and auto-scan — identical tail to the client fb/select."""
    user = await _get_target_user(user_id, db)
    staged = _staging.get(_staging_key(user_id))
    if not staged or staged.get("expires", 0) < time.time():
        raise HTTPException(status_code=400, detail="Facebook sign-in expired — start again.")
    pages = staged.get("pages", [])
    chosen = _pick_chosen_page(pages, body.page_id)
    if not chosen:
        raise HTTPException(status_code=404, detail="Selected page not found — start the Facebook sign-in again.")
    page_token = chosen.get("access_token")
    if not page_token:
        raise HTTPException(status_code=400, detail="Meta did not return a page token. Re-check the ChatriX app's permissions.")

    await _enforce_page_limit(db, user, connected_page_id=chosen["id"])

    page = await _save_tenant_page(
        db,
        user,
        chosen["id"],
        chosen.get("name") or f"Page {chosen['id']}",
        page_token,
        settings.FB_APP_ID,
        None,  # fb_app_secret=None → webhook signature uses our global secret
        None,
    )

    # Ensure our shared app's webhook subscription points at us (idempotent).
    try:
        await configure_app_webhook(
            settings.FB_APP_ID,
            settings.FB_APP_SECRET,
            f"{settings.WEBHOOK_PUBLIC_URL}/api/webhook",
            settings.FB_VERIFY_TOKEN,
        )
    except Exception as e:  # noqa
        import logging
        logging.getLogger(__name__).warning("Shared-app webhook configure failed: %s", e)

    try:
        await subscribe_app(page.page_id, page.page_access_token)
    except Exception as e:  # noqa
        import logging
        logging.getLogger(__name__).warning("Webhook subscribe failed for page %s: %s", page.page_id, e)

    scan = None
    try:
        scan = await scan_page(user.id, page)
    except Exception as e:  # noqa
        import logging
        logging.getLogger(__name__).warning("Auto-scan failed for page %s: %s", page.page_id, e)

    _staging.pop(_staging_key(user_id), None)
    await log_admin_action(admin.id, "provision_connect", "page", page.id, detail=f"user={user.email}")
    return {
        "status": "connected",
        "id": page.id,
        "page_id": page.page_id,
        "page_name": page.page_name,
        "verify_token": None,
        "scan": scan,
    }


# ---------- configure + scan the bot ----------

@router.put("/bots/{page_db_id}/config")
async def admin_bot_config(
    page_db_id: str,
    body: BotSettingsUpdate,
    admin: User = Depends(require_admin),
    db=Depends(get_db),
):
    """Bot personality config for any connected page — same validation as the
    client panel, by page id so the admin can provision without impersonating."""
    page = await _get_page(page_db_id, db)

    if body.bot_tone is not None and body.bot_tone not in VALID_TONES:
        raise HTTPException(status_code=400, detail=f"Invalid tone. Must be one of: {VALID_TONES}")
    if body.language_mode is not None and body.language_mode not in VALID_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Invalid language_mode. Must be one of: {VALID_LANGUAGES}")
    if body.system_prompt is not None and len(body.system_prompt) > 2000:
        raise HTTPException(status_code=400, detail="system_prompt must be 2000 characters or fewer")
    if body.auto_handover_after is not None and body.auto_handover_after < 0:
        raise HTTPException(status_code=400, detail="auto_handover_after must be >= 0")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(page, field, value)

    await db.commit()
    await log_admin_action(admin.id, "provision_config", "page", page_db_id)
    return {"status": "ok", "message": "Bot settings updated"}


@router.post("/bots/{page_db_id}/scan")
async def admin_bot_scan(
    page_db_id: str,
    admin: User = Depends(require_admin),
    db=Depends(get_db),
):
    """Re-run the business scan (page info + recent posts + website) — the bot
    trains itself: KB seeded, tone adopted, moderator prompt written."""
    page = await _get_page(page_db_id, db)
    if not page.is_active:
        raise HTTPException(status_code=400, detail="Page is not active.")
    result = await scan_page(page.user_id, page)
    await log_admin_action(admin.id, "provision_scan", "page", page_db_id)
    return {"status": "ok", **result}