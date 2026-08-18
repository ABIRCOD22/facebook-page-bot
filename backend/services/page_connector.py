"""Phase 2B: Connect and validate Facebook pages for BYOA (Bring Your Own App)."""

import logging

import aiohttp

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def validate_token(token: str) -> dict:
    """Validate a Facebook page access token via Graph API.

    Returns {"page_id": str, "page_name": str} or raises ValueError.
    """
    url = f"{settings.GRAPH_API_BASE}/me?fields=id,name&access_token={token}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                body = await resp.json()
                raise ValueError(f"Invalid token: {body.get('error', {}).get('message', 'unknown')}")
            data = await resp.json()
            return {"page_id": data["id"], "page_name": data["name"]}


async def subscribe_app(page_id: str, token: str) -> bool:
    """Subscribe the app to a page so it receives webhook events."""
    url = f"{settings.GRAPH_API_BASE}/{page_id}/subscribed_apps"
    payload = {"access_token": token, "subscribed_fields": "messages,messaging_postbacks"}
    async with aiohttp.ClientSession() as session:
        async with session.post(url, data=payload, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            data = await resp.json()
            if resp.status == 200 and data.get("success"):
                logger.info("Subscribed app to page %s", page_id)
                return True
            logger.error("Subscribe failed: %s", data)
            return False


async def test_connection(page_id: str, token: str) -> dict:
    """Test if a page token is still valid and the page is reachable."""
    url = f"{settings.GRAPH_API_BASE}/{page_id}?fields=id,name,access_token&access_token={token}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            data = await resp.json()
            if resp.status == 200:
                return {"valid": True, "page_name": data.get("name")}
            return {"valid": False, "error": data.get("error", {}).get("message", "unknown")}


async def _graph_get(url: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            data = await resp.json()
            if resp.status != 200:
                raise ValueError(data.get("error", {}).get("message", f"Graph error {resp.status}"))
            return data


async def exchange_code(app_id: str, app_secret: str, code: str, redirect_uri: str) -> str:
    """Exchange an OAuth code (from FB Login against the user's app) for a short-lived user token."""
    url = (
        f"{settings.GRAPH_API_BASE}/oauth/access_token"
        f"?client_id={app_id}&client_secret={app_secret}&code={code}&redirect_uri={redirect_uri}"
    )
    data = await _graph_get(url)
    if "access_token" not in data:
        raise ValueError("Token exchange failed — no access_token in response")
    return data["access_token"]


async def make_long_lived_user_token(app_id: str, app_secret: str, short_token: str) -> str:
    """Short-lived user token → long-lived (~60 days). Required before /me/accounts."""
    url = (
        f"{settings.GRAPH_API_BASE}/oauth/access_token"
        f"?grant_type=fb_exchange_token&client_id={app_id}&client_secret={app_secret}"
        f"&fb_exchange_token={short_token}"
    )
    data = await _graph_get(url)
    return data.get("access_token", short_token)


async def list_manageable_pages(long_lived_user_token: str) -> list[dict]:
    """List pages the user can manage. Page tokens obtained via a long-lived
    user token are long-lived (effectively non-expiring) themselves."""
    data = await _graph_get(
        f"{settings.GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,tasks&access_token={long_lived_user_token}"
    )
    return data.get("data", [])


async def configure_app_webhook(app_id: str, app_secret: str, callback_url: str, verify_token: str) -> bool:
    """Auto-configure the user's Meta app to POST page events to our webhook.

    Uses an app access token (app_id|app_secret) — works even though the
    app secret cannot be read back from Meta's dashboard.
    """
    url = f"{settings.GRAPH_API_BASE}/{app_id}/subscriptions"
    payload = {
        "access_token": f"{app_id}|{app_secret}",
        "object": "page",
        "callback_url": callback_url,
        "fields": "messages,messaging_postbacks",
        "verify_token": verify_token,
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, data=payload, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            data = await resp.json()
            if resp.status == 200 and data.get("success"):
                logger.info("Webhook subscription configured for app %s", app_id)
                return True
            logger.error("Webhook configure failed: %s", data)
            return False
