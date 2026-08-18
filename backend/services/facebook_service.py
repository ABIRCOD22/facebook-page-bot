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
