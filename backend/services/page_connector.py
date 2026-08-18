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
