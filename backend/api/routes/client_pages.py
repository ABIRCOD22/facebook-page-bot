"""Client Facebook page connection (BYOA + BYO app).

Users either paste a Page Access Token (BYOA), or connect their own
Meta Developer app via OAuth code exchange (BYO app). Either way we
validate via Graph API, store the FacebookPage row (tenant-scoped),
best-effort subscribe the webhook, and can run a business scan.
"""

import json
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from api.dependencies import get_current_user
from config import get_settings
from database.connection import get_db
from models.database_models import Conversation, FacebookPage, Message, Subscription, User
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

# business_management is a documented Meta dependency of pages_messaging /
# pages_show_list for apps serving other businesses (App Review submission).
FB_SCOPES = "pages_show_list,pages_messaging,pages_manage_metadata,business_management"
FB_STAGING_TTL = 600  # 10 minutes to finish picking a page after FB login
# ponytail: single-process in-memory OAuth staging (user token exchanged once,
# only per-page tokens cached briefly). Ceiling: Render free = one instance,
# so the dict is correct today; the Redis client in database.connection is the
# upgrade path if the backend ever runs multiple instances.
_fb_staging: dict[str, dict] = {}


def build_oauth_url(app_id: str, redirect_uri: str, state: str, version: str = None) -> str:
    """Facebook Login for Business URL. Pure + deterministic (assertable)."""
    version = version or settings.GRAPH_API_VERSION
    return (
        f"https://www.facebook.com/{version}/dialog/oauth"
        f"?client_id={app_id}&redirect_uri={redirect_uri}&state={state}"
        f"&scope={FB_SCOPES}&response_type=code"
    )


class ConnectRequest(BaseModel):
    page_access_token: str
    fb_app_id: str | None = None
    fb_app_secret: str | None = None
    page_id: str | None = None  # chosen page when the pasted token is a user token


class ConnectByoRequest(BaseModel):
    app_id: str
    app_secret: str
    code: str
    redirect_uri: str


class AvailableRequest(BaseModel):
    access_token: str


class BotToggleRequest(BaseModel):
    bot_enabled: bool


def _pick_chosen_page(pages: list[dict], page_id: str) -> dict | None:
    return next((p for p in pages if p.get("id") == page_id), None)


async def _require_page_info(token: str) -> dict:
    try:
        return await validate_token(token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


async def _enforce_page_limit(db, user: User, connected_page_id: str | None = None):
    """Re-connecting a page the user already owns must not count against the
    plan limit — the funnel re-runs adopt the same page across fresh accounts.
    """
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
    owned = len(active)
    if connected_page_id and any(p.page_id == connected_page_id for p in active):
        owned -= 1  # reconnecting an already-owned page is not a new page
    if owned >= max_pages:
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
    # Ownership follows the token: this user already proved the page is
    # theirs by presenting a valid page access token (validate_token).
    # Re-runs of the funnel/adoption across accounts transfer the page
    # instead of hard-blocking with "already connected".
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


@router.post("/available")
async def available_pages(
    body: AvailableRequest,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """List the pages a pasted token can see — and what kind of token it is.

    - /me/accounts returns data  → user token → all manageable pages listed.
    - /me/accounts errors        → valid user token missing pages_show_list.
    - /me/accounts empty         → page-scoped token → the one page it covers.

    Only ids/names/tasks leave the server; page tokens stay server-side.
    """
    return await available_pages_core(body)


async def available_pages_core(body: AvailableRequest) -> dict:
    """Shared with admin-led provisioning (admin_pages.py): resolve what a
    pasted token can see without any db or auth dependency."""
    try:
        listed = await list_manageable_pages(body.access_token)
    except ValueError:
        listed = None

    if listed:
        return {
            "token_type": "user",
            "pages": [
                {
                    "page_id": p.get("id"),
                    "page_name": p.get("name") or f"Page {p.get('id')}",
                    "tasks": p.get("tasks", []),
                }
                for p in listed
            ],
        }

    info = await _require_page_info(body.access_token)
    if listed is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "This looks like a User Access Token without the pages_show_list permission. "
                "Add pages_show_list (+ pages_messaging, pages_manage_metadata) in the Explorer, "
                "generate the token again, and retry — or paste a Page Access Token to connect a single page."
            ),
        )
    return {
        "token_type": "page",
        "pages": [{"page_id": info["page_id"], "page_name": info["page_name"], "tasks": []}],
    }


@router.post("/fb/authorize")
async def fb_login_url(
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """Kick off Facebook Login with ChatriX's own app — no user app required.

    Returns the Facebook OAuth dialog URL + a state token bound to this
    account. The user grants access in Facebook's own screen; we never see
    their Facebook password. After the redirect we exchange the code
    server-side (our app secret never leaves the backend).
    """
    state = secrets.token_urlsafe(16)
    _fb_staging[user.id] = {"state": state, "expires": time.time() + FB_STAGING_TTL}
    return {
        "auth_url": build_oauth_url(settings.FB_APP_ID, FB_REDIRECT_URI, state),
        "state": state,
    }


FB_REDIRECT_URI = "https://fb-autoreply-website.netlify.app/setup"


class FbCompleteRequest(BaseModel):
    code: str
    state: str


class FbSelectRequest(BaseModel):
    page_id: str


@router.post("/fb/complete")
async def fb_complete(
    body: FbCompleteRequest,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """Exchange the OAuth code from Facebook Login for a list of pages.

    Code → short-lived user token → long-lived (~60d) → /me/accounts.
    The long-lived user token is used once and discarded; only the (already
    non-expiring) per-page tokens are kept, in a short-lived staging entry.

    The redirect_uri used for the exchange is always the server's own
    settings.FB_REDIRECT_URI — the dialog URL was built with it, and Meta
    rejects a mismatched exchange. Never trust a client-supplied one.
    """
    staged = _fb_staging.get(user.id)
    if (
        not staged
        or staged.get("state") != body.state
        or staged.get("expires", 0) < time.time()
    ):
        raise HTTPException(status_code=400, detail="This Facebook sign-in link is stale — start again.")
    try:
        short = await exchange_code(
            settings.FB_APP_ID, settings.FB_APP_SECRET, body.code, settings.FB_REDIRECT_URI
        )
        long = await make_long_lived_user_token(settings.FB_APP_ID, settings.FB_APP_SECRET, short)
        pages = await list_manageable_pages(long)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Facebook sign-in failed: {e}")
    if not pages:
        raise HTTPException(
            status_code=400,
            detail="No pages found for this Facebook account. You must be admin/analyst on at least one page.",
        )

    _fb_staging[user.id] = {
        "state": staged["state"],
        "pages": pages,
        "expires": time.time() + FB_STAGING_TTL,
    }
    return {
        "token_type": "user",
        "pages": [
            {
                "page_id": p.get("id"),
                "page_name": p.get("name") or f"Page {p.get('id')}",
                "tasks": p.get("tasks", []),
            }
            for p in pages
        ],
    }


@router.post("/fb/select")
async def fb_select(
    body: FbSelectRequest,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """Save the chosen page, subscribe our shared app, auto-scan. One shot.

    No per-user app, no verify token: our app's webhook is configured once
    globally (callback URL + FB_VERIFY_TOKEN) and each page just subscribes
    via subscribe_app + our app's global secret (webhook.py falls back to
    settings.FB_APP_SECRET for fb_app_secret=None pages).
    """
    staged = _fb_staging.get(user.id)
    if not staged or staged.get("expires", 0) < time.time():
        raise HTTPException(status_code=400, detail="Facebook sign-in expired — start again.")
    pages = staged.get("pages", [])
    chosen = _pick_chosen_page(pages, body.page_id)
    if not chosen:
        raise HTTPException(status_code=404, detail="Selected page not found — start the Facebook sign-in again.")
    page_token = chosen.get("access_token")
    if not page_token:
        raise HTTPException(
            status_code=400,
            detail="Meta did not return a page token. Re-check the ChatriX app's permissions.",
        )

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

    # Ensure our shared app's webhook subscription points at us (idempotent —
    # same callback URL + verify token every time). Non-fatal if the app
    # dashboard hasn't been configured with the Messenger product yet.
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

    _fb_staging.pop(user.id, None)
    return {
        "status": "connected",
        "id": page.id,
        "page_id": page.page_id,
        "page_name": page.page_name,
        "verify_token": None,  # shared app: webhook verify is configured globally
        "scan": scan,
    }


@router.post("/connect")
async def connect_page(
    body: ConnectRequest,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    return await connect_page_core(db, user, body)


async def connect_page_core(db, user: User, body: ConnectRequest) -> dict:
    """Shared with admin-led provisioning (admin_provision.py): pasted-token
    connect for a given user, including page save, webhook subscribe and scan."""
    # Two token kinds:
    #  - page token (no page_id): /me identifies the one page it covers.
    #  - user token (+ page_id): /me/accounts lists pages; we resolve the
    #    chosen page's own page-scoped token server-side. The broad user
    #    token is used transiently and never persisted (least privilege).
    page_access_token = body.page_access_token
    if body.page_id:
        try:
            pages = await list_manageable_pages(body.page_access_token)
        except ValueError:
            pages = []
        if pages:
            chosen = _pick_chosen_page(pages, body.page_id)
            if not chosen:
                raise HTTPException(
                    status_code=404,
                    detail="Selected page not found on this Meta account — generate the token again.",
                )
            chosen_token = chosen.get("access_token")
            if not chosen_token:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Meta did not return a page token for that page. Re-check the app's "
                        "permissions (pages_manage_metadata, pages_messaging)."
                    ),
                )
            info = {"page_id": chosen["id"], "page_name": chosen.get("name") or f"Page {chosen['id']}"}
            page_access_token = chosen_token
        else:
            info = await _require_page_info(body.page_access_token)
            if info["page_id"] != body.page_id:
                raise HTTPException(
                    status_code=400,
                    detail="This access token belongs to a different page than the one you selected.",
                )
    else:
        info = await _require_page_info(body.page_access_token)
        # A user token must never be stored as a "page": if /me/accounts
        # returns pages, this is a user token → require an explicit pick.
        try:
            probe = await list_manageable_pages(body.page_access_token)
        except ValueError:
            probe = []
        if probe:
            raise HTTPException(
                status_code=400,
                detail="That looks like a User Access Token. Use “Find my page” to choose a page, then connect it.",
            )

    # Enforce the plan limit only after we know which page: re-connecting a
    # page this user already owns is not a new page towards the limit.
    await _enforce_page_limit(db, user, connected_page_id=info["page_id"])

    page = await _save_tenant_page(
        db,
        user,
        info["page_id"],
        info["page_name"],
        page_access_token,
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

    # Auto-scan inline (contract: scan_page never raises — graceful
    # degradation). Profiles the business, seeds the KB, and adopts the
    # moderator voice when the user hasn't customized it.
    scan = None
    try:
        scan = await scan_page(user.id, page)
    except Exception as e:  # noqa
        import logging
        logging.getLogger(__name__).warning("Auto-scan failed for page %s: %s", page.page_id, e)

    return {
        "status": "connected",
        "id": page.id,
        "page_id": page.page_id,
        "page_name": page.page_name,
        "verify_token": page.verify_token or None,
        "scan": scan,
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
        raise HTTPException(status_code=400, detail="Meta did not return a page token. Re-check your app's permissions (pages_manage_metadata, pages_messaging, pages_broadcast, pages_read_engagement).")

    await _enforce_page_limit(db, user, connected_page_id=candidate["id"])

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

    pages = []
    for p in rows:
        # Liveness signal: has the bot ever replied on this page?
        last_bot_reply = (
            await db.execute(
                select(Message.timestamp)
                .join(Conversation, Conversation.id == Message.conversation_id)
                .where(Conversation.page_id == p.id, Message.sender_type == "bot")
                .order_by(Message.timestamp.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        pages.append(
            {
                "id": p.id,
                "page_id": p.page_id,
                "page_name": p.page_name,
                "bot_name": p.bot_name,
                "bot_enabled": p.bot_enabled if p.bot_enabled is not None else True,
                "is_active": p.is_active,
                "connected_at": p.connected_at,
                "webhook_verified_at": p.webhook_verified_at,
                "last_bot_reply_at": last_bot_reply,
                "scan_status": p.scan_status or "not_scanned",
                "scanned_at": p.scanned_at,
                "business_profile": json.loads(p.business_profile) if p.business_profile else None,
            }
        )
    return {"pages": pages}


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


@router.put("/{page_db_id}/bot")
async def toggle_bot(
    page_db_id: str,
    body: BotToggleRequest,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """User-facing service on/off switch. When OFF the webhook still logs
    incoming messages and marks them seen, but the bot never replies."""
    page = (
        await db.execute(
            select(FacebookPage).where(
                FacebookPage.id == page_db_id, FacebookPage.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if not page or not page.is_active:
        raise HTTPException(status_code=404, detail="Page not found.")
    page.bot_enabled = body.bot_enabled
    await db.commit()
    return {"status": "ok", "bot_enabled": page.bot_enabled}
