"""Admin-led white-glove provisioning: create client, save their Meta app
credentials, hand over the Callback URL + Webhook token, verify the customer
connected the webhook, and deliver dashboard credentials.

The admin pastes the customer's App ID / App Secret / Page Access Token; the
customer finishes the webhook setup in their own Meta App Dashboard; the admin
confirms with /test-connection before handing over credentials. Reuses the
client page-save and validation cores so behavior is identical across paths.
"""

import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from api.dependencies import require_admin
from api.routes.client_bot import BotSettingsUpdate, VALID_LANGUAGES, VALID_TONES
from api.routes.client_pages import (
    _enforce_page_limit,
    _save_tenant_page,
)
from config import get_settings
from database.connection import get_db
from models.database_models import FacebookPage, User
from services.audit_service import log_admin_action
from services.business_scanner import scan_page
from services.page_connector import (
    test_connection,
    validate_token,
)

router = APIRouter(prefix="/api/admin", tags=["admin-provision"])
settings = get_settings()


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


# ---------- connect: admin pastes the customer's app id/secret/token ----------

class AdminAppConnectBody(BaseModel):
    fb_app_id: str
    fb_app_secret: str
    page_access_token: str
    verify_token: str | None = None


@router.post("/users/{user_id}/pages/connect-app")
async def admin_connect_app(
    user_id: str,
    body: AdminAppConnectBody,
    admin: User = Depends(require_admin),
    db=Depends(get_db),
):
    """Save the customer's app credentials + page token and return the
    Callback URL + Webhook verify token the admin hands to the customer.

    The webhook is NOT configured here — the customer does that in their own
    Meta App Dashboard (Messenger → Webhooks) using the returned values. The
    admin uses /test-connection afterwards to confirm the customer finished.
    """
    user = await _get_target_user(user_id, db)
    try:
        info = await validate_token(body.page_access_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await _enforce_page_limit(db, user, connected_page_id=info["page_id"])

    if body.verify_token is not None:
        verify_token = body.verify_token.strip()
        if not (10 <= len(verify_token) <= 256):
            raise HTTPException(status_code=400, detail="verify_token must be between 10 and 256 characters")
    else:
        verify_token = secrets.token_urlsafe(24)

    page = await _save_tenant_page(
        db,
        user,
        info["page_id"],
        info["page_name"],
        body.page_access_token,
        body.fb_app_id,
        body.fb_app_secret,
        verify_token,
    )
    await log_admin_action(admin.id, "provision_connect_app", "page", page.id, detail=f"user={user.email}")
    return {
        "status": "awaiting_webhook",
        "id": page.id,
        "page_id": page.page_id,
        "page_name": page.page_name,
        "callback_url": f"{settings.WEBHOOK_PUBLIC_URL}/api/webhook",
        "verify_token": page.verify_token,
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


# ---------- verify the customer actually connected the webhook ----------

@router.post("/bots/{page_db_id}/test-connection")
async def admin_test_connection(
    page_db_id: str,
    admin: User = Depends(require_admin),
    db=Depends(get_db),
):
    """Confirm the customer really connected the webhook before handing over
    credentials. Proves it by Meta's own liveness signal: the GET challenge
    against our /api/webhook with the page's verify token sets
    webhook_verified_at. Also re-checks the stored page token still works."""
    page = await _get_page(page_db_id, db)

    if not page.webhook_verified_at:
        raise HTTPException(
            status_code=400,
            detail=(
                "Webhook not connected yet. Send the customer the Callback URL and Webhook "
                "verify token, ask them to add them in their Meta App Dashboard (Messenger → "
                "Webhooks), and have them confirm. Then test again."
            ),
        )

    probe = await test_connection(page.page_id, page.page_access_token)
    if not probe.get("valid"):
        raise HTTPException(
            status_code=400,
            detail=f"Stored page token is no longer valid: {probe.get('error', 'unknown error')}. Regenerate it and save the app credentials again.",
        )

    await log_admin_action(admin.id, "provision_test_connection", "page", page_db_id)
    return {
        "status": "connected",
        "page_id": page.page_id,
        "page_name": page.page_name,
        "verified_at": page.webhook_verified_at.isoformat(),
    }