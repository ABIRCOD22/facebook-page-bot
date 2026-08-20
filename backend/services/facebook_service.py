import hashlib
import hmac
import logging

import aiohttp

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

BASE_URL = settings.GRAPH_API_BASE


class FacebookService:
    """Thin wrapper over the Messenger Platform Send API (Graph API v26)."""

    @staticmethod
    async def send_text_message(recipient_id: str, text: str, page_access_token: str = None):
        token = page_access_token or settings.FB_PAGE_ACCESS_TOKEN
        url = f"{BASE_URL}/me/messages?access_token={token}"
        payload = {
            "recipient": {"id": recipient_id},
            "message": {"text": text},
        }
        return await _call_send_api(url, payload)

    @staticmethod
    async def send_quick_replies(
        recipient_id: str, text: str, quick_replies: list, page_access_token: str = None
    ):
        token = page_access_token or settings.FB_PAGE_ACCESS_TOKEN
        url = f"{BASE_URL}/me/messages?access_token={token}"

        quick_reply_payloads = [
            {"content_type": "text", "title": reply[:20], "payload": reply[:1000]}
            for reply in quick_replies[:3]
        ]

        payload = {
            "recipient": {"id": recipient_id},
            "message": {
                "text": text,
                "quick_replies": quick_reply_payloads,
            },
        }
        return await _call_send_api(url, payload)

    @staticmethod
    async def set_typing_indicator(
        recipient_id: str, is_typing: bool = True, page_access_token: str = None
    ):
        token = page_access_token or settings.FB_PAGE_ACCESS_TOKEN
        url = f"{BASE_URL}/me/messages?access_token={token}"
        payload = {
            "recipient": {"id": recipient_id},
            "sender_action": "typing_on" if is_typing else "typing_off",
        }
        return await _call_send_api(url, payload)

    @staticmethod
    async def mark_seen(recipient_id: str, page_access_token: str = None):
        token = page_access_token or settings.FB_PAGE_ACCESS_TOKEN
        url = f"{BASE_URL}/me/messages?access_token={token}"
        payload = {"recipient": {"id": recipient_id}, "sender_action": "mark_seen"}
        return await _call_send_api(url, payload)

    @staticmethod
    async def get_user_profile(user_id: str, page_access_token: str = None):
        token = page_access_token or settings.FB_PAGE_ACCESS_TOKEN
        url = f"{BASE_URL}/{user_id}?fields=first_name,last_name,profile_pic&access_token={token}"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    logger.error("Profile fetch failed: %s", resp.status)
        except Exception as e:
            logger.error("Profile fetch error: %s", e)
        return None

    # ============================================
    # Product scanning — pull products from Page feed/albums/shop
    # ============================================

    @staticmethod
    async def scan_page_feed(page_fb_id: str, page_access_token: str, limit: int = 50) -> list:
        """Fetch Page posts with attached photos that look like product listings.

        Returns a list of dicts: [{name, description, image_url, category}, ...]
        """
        token = page_access_token
        url = (
            f"{BASE_URL}/{page_fb_id}/feed"
            f"?fields=id,message,created_time,full_picture,attachments"
            f"&access_token={token}&limit={limit}"
        )
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                    if resp.status != 200:
                        logger.warning("Feed fetch failed: %s %s", resp.status, await resp.text())
                        return []
                    data = await resp.json()
                    return _parse_feed_products(data)
        except Exception as e:
            logger.error("Feed scan error: %s", e)
            return []

    @staticmethod
    async def scan_page_photos(page_fb_id: str, page_access_token: str, limit: int = 50) -> list:
        """Fetch Page photos (album photos are often product images).

        Returns a list of dicts: [{name, description, image_url, category}, ...]
        """
        token = page_access_token
        url = (
            f"{BASE_URL}/{page_fb_id}/photos"
            f"?fields=id,name,link,images"
            f"&type=uploaded"
            f"&access_token={token}&limit={limit}"
        )
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                    if resp.status != 200:
                        logger.warning("Photos fetch failed: %s %s", resp.status, await resp.text())
                        return []
                    data = await resp.json()
                    return _parse_photo_products(data)
        except Exception as e:
            logger.error("Photos scan error: %s", e)
            return []

    @staticmethod
    async def scan_page_shop(page_fb_id: str, page_access_token: str, limit: int = 100) -> list:
        """Fetch products from Facebook Shop / Commerce catalog.

        Returns a list of dicts: [{name, description, image_url, price, currency, category}, ...]
        """
        token = page_access_token
        url = (
            f"{BASE_URL}/{page_fb_id}/products"
            f"?fields=id,name,description,image_link,price,category,availability,retailer_id"
            f"&access_token={token}&limit={limit}"
        )
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                    if resp.status != 200:
                        # Page doesn't have a Shop enabled — not an error
                        logger.info("Shop endpoint not available for page %s (status %s)", page_fb_id, resp.status)
                        return []
                    data = await resp.json()
                    return _parse_shop_products(data)
        except Exception as e:
            logger.info("Shop scan skipped for page %s: %s", page_fb_id, e)
            return []


async def _call_send_api(url: str, payload: dict) -> bool:
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url, json=payload, timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                body = await resp.json()
                if resp.status == 200 and body.get("error") is None:
                    return True
                logger.error("Send API error %s: %s", resp.status, body.get("error"))
                return False
    except Exception as e:
        logger.error("Send API request failed: %s", e)
        return False


# ============================================
# Product parsers — extract product-like items from Graph API responses
# ============================================

# Keywords that signal a post is product/sales related
_PRODUCT_SIGNALS = {
    "buy", "price", "order", "shop", "sale", "discount", "offer",
    "taka", "bdt", "tk", "৳", "$", "available", "stock", "order now",
    "free delivery", "cash on delivery", "cod", "product", "collection",
}


def _parse_feed_products(data: dict) -> list:
    """Extract product-like posts from Page feed."""
    products = []
    for post in data.get("data", []):
        message = (post.get("message") or "").lower()
        picture = post.get("full_picture")
        if not picture:
            continue

        # Heuristic: post has an image + looks product-related
        is_product = any(sig in message for sig in _PRODUCT_SIGNALS)
        if not is_product:
            # Also treat posts with price-like patterns as products
            import re
            if re.search(r"[৳$]\s*\d|(\d+)\s*(taka|bdt|tk)", message):
                is_product = True

        if not is_product:
            continue

        # Extract name: first line or first sentence
        name = (post.get("message") or "Untitled Product").split("\n")[0][:200]
        description = post.get("message") or ""

        products.append({
            "name": name.strip(),
            "description": description.strip(),
            "image_url": picture,
            "category": "scanned",
        })

    return products


def _parse_photo_products(data: dict) -> list:
    """Extract products from Page photos."""
    products = []
    for photo in data.get("data", []):
        name = photo.get("name") or "Untitled Product"
        # Get the largest image
        images = photo.get("images", [])
        image_url = None
        if images:
            image_url = images[0].get("source")

        if not image_url:
            continue

        products.append({
            "name": name.strip()[:200],
            "description": name.strip(),
            "image_url": image_url,
            "category": "scanned",
        })

    return products


def _parse_shop_products(data: dict) -> list:
    """Extract products from Facebook Shop / Commerce catalog."""
    products = []
    for item in data.get("data", []):
        products.append({
            "name": (item.get("name") or "Untitled Product")[:200],
            "description": (item.get("description") or "")[:1000],
            "image_url": item.get("image_link") or "",
            "price": item.get("price") or "",
            "currency": "BDT",
            "category": item.get("category") or "scanned",
            "availability": _map_availability(item.get("availability")),
        })

    return products


def _map_availability(fb_status: str | None) -> str:
    """Map Facebook availability strings to our model."""
    if not fb_status:
        return "in_stock"
    mapping = {
        "in stock": "in_stock",
        "out of stock": "out_of_stock",
        "preorder": "pre_order",
        "available for order": "pre_order",
    }
    return mapping.get(fb_status.lower(), "in_stock")


def verify_webhook_signature(payload_body: bytes, signature_header: str, app_secret: str = None) -> bool:
    """X-Hub-Signature-256 validation (HMAC-SHA256 of raw body with app secret).

    ponytail: app_secret param added in Phase 2B for multi-tenant webhook.
    Falls back to settings.FB_APP_SECRET only for the legacy demo page.
    """
    secret = app_secret or settings.FB_APP_SECRET
    if not signature_header:
        return False
    expected = "sha256=" + hmac.new(
        secret.encode(), payload_body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(signature_header, expected):
        logger.warning("Signature mismatch: got=%r expected_prefix=%r", signature_header[:24], expected[:9])
        return False
    return True
