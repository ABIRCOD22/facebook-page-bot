import asyncio
import logging

from fastapi import APIRouter, Header, Query, Request

from config import get_settings
from core.ai_engine import AIEngine
from core.conversation_manager import ConversationManager
from core.image_analyzer import ImageAnalyzer
from core.safety_layer import SafetyLayer
from services.facebook_service import (
    FacebookService,
    verify_webhook_signature,
)
from services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["webhook"])
settings = get_settings()


@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Facebook verifies the webhook URL with a GET challenge."""
    if hub_mode == "subscribe" and hub_verify_token == settings.FB_VERIFY_TOKEN:
        logger.info("Webhook verified by Facebook")
        return int(hub_challenge) if hub_challenge.isdigit() else hub_challenge

    logger.warning("Webhook verification FAILED")
    return {"error": "Verification failed"}


@router.post("/webhook")
async def receive_webhook(
    request: Request,
    x_hub_signature_256: str = Header(default=""),
):
    """Handle incoming Messenger events from Facebook."""
    body = await request.body()

    if not verify_webhook_signature(body, x_hub_signature_256):
        logger.warning("Rejected webhook: invalid signature")
        return {"error": "Invalid signature"}

    try:
        data = await request.json()
    except Exception:
        logger.error("Invalid JSON payload")
        return {"error": "Invalid payload"}

    if data.get("object") == "page":
        for entry in data.get("entry", []):
            for event in entry.get("messaging", []):
                if "message" in event or "postback" in event:
                    # Fire-and-forget: Facebook expects 200 fast; reply later.
                    asyncio.create_task(_process_message_safely(entry, event))

    return {"status": "received"}


async def _process_message_safely(entry: dict, event: dict):
    """Never crash the webhook: wrap processing in try/except."""
    try:
        await _process_message(entry, event)
    except Exception as e:
        logger.error("Message processing error: %s", e, exc_info=True)


async def _process_message(entry: dict, event: dict):
    page_fb_id = str(entry.get("id"))
    sender_fb_id = str(event.get("sender", {}).get("id"))
    if not page_fb_id or not sender_fb_id:
        return

    # Phase 1: only serve pages with an active subscription
    page = await ConversationManager.get_page_by_fb_id(page_fb_id)
    if not page:
        logger.warning("Unknown page %s, ignoring", page_fb_id)
        return

    subscription = await SubscriptionService.get_active_subscription_for_page(page)
    if not subscription:
        logger.info("No active subscription for page %s, skipping", page_fb_id)
        return

    message = event.get("message") or {}
    postback = event.get("postback") or {}
    user_text = message.get("text", "") or postback.get("payload", "") or ""

    safety = SafetyLayer()
    if not safety.is_safe_input(user_text):
        return

    rate = await safety.check_rate_limit(page_fb_id, sender_fb_id)
    if not rate["allowed"]:
        return

    manager = ConversationManager(page_db_id=page.id)
    conversation = await manager.get_or_create_conversation(
        customer_fb_id=sender_fb_id,
        customer_name=f"Customer {sender_fb_id[:6]}",
    )

    image_context = None
    attachments = message.get("attachments", [])
    for attachment in attachments:
        if attachment.get("type") == "image" and attachment.get("payload", {}).get("url"):
            image_analyzer = ImageAnalyzer()
            image_context = await image_analyzer.analyze_image(attachment["payload"]["url"])
            break

    await manager.add_message(
        conversation_id=conversation.id,
        sender_type="customer",
        content=user_text,
        message_type="image" if image_context else "text",
        image_url=image_context,
    )

    await FacebookService.mark_seen(sender_fb_id, page.page_access_token)
    await FacebookService.set_typing_indicator(sender_fb_id, True, page.page_access_token)

    history = await manager.get_history(conversation.id, limit=10)
    page_config = {
        "bot_name": page.bot_name,
        "page_name": page.page_name,
        "bot_tone": page.bot_tone,
        "fallback_message": page.fallback_message,
    }

    ai_engine = AIEngine(user_id=page.user_id, page_config=page_config)
    ai_response = await ai_engine.generate_response(
        conversation_id=conversation.id,
        user_message=user_text,
        history=history,
        image_context=image_context,
    )

    await manager.add_message(
        conversation_id=conversation.id,
        sender_type="bot",
        content=ai_response.text,
        confidence_score=ai_response.confidence / 100.0 if ai_response.confidence else None,
    )

    if ai_response.quick_replies:
        await FacebookService.send_quick_replies(
            sender_fb_id, ai_response.text, ai_response.quick_replies, page.page_access_token
        )
    else:
        await FacebookService.send_text_message(
            sender_fb_id, ai_response.text, page.page_access_token
        )

    await FacebookService.set_typing_indicator(sender_fb_id, False, page.page_access_token)

    if ai_response.should_handover:
        await manager.set_status(conversation.id, "handed_over")
