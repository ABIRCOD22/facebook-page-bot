import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, Header, HTTPException, Query, Request
from sqlalchemy import select, update

from config import get_settings
from core.ai_engine import AIEngine
from core.conversation_manager import ConversationManager
from core.image_analyzer import ImageAnalyzer
from core.safety_layer import SafetyLayer
from database.connection import AsyncSessionFactory
from models.database_models import FacebookPage, Subscription
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
    """Facebook verifies the webhook URL with a GET challenge.

    Phase 2B: accept per-page verify tokens (BYO apps get a random
    token per page), falling back to the global env token.
    """
    if hub_mode == "subscribe" and hub_verify_token:
        if hub_verify_token == settings.FB_VERIFY_TOKEN:
            logger.info("Webhook verified by Facebook (global token)")
            return int(hub_challenge) if hub_challenge.isdigit() else hub_challenge
        async with AsyncSessionFactory() as session:
            page = (
                await session.execute(
                    select(FacebookPage).where(FacebookPage.verify_token == hub_verify_token)
                )
            ).scalar_one_or_none()
            if page:
                # Liveness signal: Meta successfully verified this page's
                # webhook callback URL (the user finished the setup wizard
                # step 4). Used by the final wizard check to prove the bot
                # is actually receiving events.
                page.webhook_verified_at = datetime.utcnow()
                await session.commit()
                logger.info("Webhook verified for tenant page %s", page.page_id)
                return int(hub_challenge) if hub_challenge.isdigit() else hub_challenge

    logger.warning("Webhook verification FAILED")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook")
async def receive_webhook(
    request: Request,
    x_hub_signature_256: str = Header(default=""),
):
    """Handle incoming Messenger events from Facebook.

    Phase 2B: signature is verified against the per-page app_secret,
    not a global secret. Unknown pages are rejected.
    """
    body = await request.body()

    # Phase 2B: parse body first to find which page this is for
    try:
        data = await request.json()
    except Exception:
        logger.error("Invalid JSON payload")
        return {"error": "Invalid payload"}

    if data.get("object") != "page":
        return {"status": "received"}

    # Phase 2B: look up page from entry[].id, verify signature with that page's secret
    page = None
    for entry in data.get("entry", []):
        page_fb_id = str(entry.get("id"))
        if page_fb_id:
            async with AsyncSessionFactory() as session:
                result = await session.execute(
                    select(FacebookPage).where(FacebookPage.page_id == page_fb_id)
                )
                page = result.scalar_one_or_none()
            break

    if not page:
        logger.warning("Rejected webhook: unknown page in payload")
        raise HTTPException(status_code=403, detail="Unknown page")

    # ponytail: verify signature with the page's own app_secret.
    # Fallback to global secret only for legacy pages seeded from env (fb_app_secret=None).
    app_secret = page.fb_app_secret or settings.FB_APP_SECRET
    if not verify_webhook_signature(body, x_hub_signature_256, app_secret):
        logger.warning("Rejected webhook: invalid signature for page %s", page.page_id)
        raise HTTPException(status_code=403, detail="Invalid signature")

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

    # ponytail: suppress consecutive identical bot replies — Meta's spam
    # classifier weights exact-repeat responses heavily. If the model
    # emits the same text twice in a row, fall back to the page's
    # handover-ish fallback instead of echoing. Ceiling: comparison is
    # exact-match only; fuzzy similarity is a later refinement.
    last_bot = None
    for h in reversed(history):
        if h.get("sender_type") == "bot":
            last_bot = h
            break
    if (
        last_bot
        and last_bot.get("content") == ai_response.text
        and not ai_response.quick_replies
    ):
        logger.info("Duplicate bot reply suppressed for page %s", page_fb_id)
        ai_response.text = page.fallback_message or "Noted — I'll make sure the right person gets back to you shortly."

    # Humanize: instant replies of identical shape are a bot signature.
    await asyncio.sleep(SafetyLayer().calculate_typing_delay(ai_response.text))

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

    # ponytail: track usage so trial/quota is real. No hard cap yet — the
    # bot keeps working; the subscription page shows messages_used. A hard
    # ceiling (block replies past max_messages_per_month) is a later refinement.
    try:
        async with AsyncSessionFactory() as s:
            await s.execute(
                update(Subscription)
                .where(Subscription.id == subscription.id)
                .values(messages_used=(Subscription.messages_used or 0) + 1)
            )
            await s.commit()
    except Exception as e:  # noqa
        logger.error("Usage increment failed: %s", e)

    if ai_response.should_handover:
        await manager.set_status(conversation.id, "handed_over")
