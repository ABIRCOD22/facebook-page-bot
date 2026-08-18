"""Phase 2C: Bot settings API — GET/PUT/PREVIEW."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from api.dependencies import get_current_user
from core.prompt_builder import build_prompt
from database.connection import get_db
from models.database_models import FacebookPage, User

router = APIRouter(prefix="/api/client", tags=["client-bot"])

VALID_TONES = ["professional_friendly", "casual", "formal", "witty"]
VALID_LANGUAGES = ["auto", "en_only", "bn_only", "bilingual"]


class BotSettingsUpdate(BaseModel):
    bot_name: str | None = None
    bot_tone: str | None = None
    language_mode: str | None = None
    system_prompt: str | None = None
    welcome_message: str | None = None
    fallback_message: str | None = None
    handover_message: str | None = None
    auto_handover_after: int | None = None
    quick_replies_enabled: bool | None = None
    typing_indicator_enabled: bool | None = None
    fetch_customer_name: bool | None = None


class PreviewRequest(BaseModel):
    sample_message: str = "What is the price of the laptop bag?"
    page_id: str | None = None


@router.get("/bot")
async def get_bot_settings(user: User = Depends(get_current_user), db=Depends(get_db)):
    """Return bot settings for the user's first active page."""
    result = await db.execute(
        select(FacebookPage).where(FacebookPage.user_id == user.id, FacebookPage.is_active == True)  # noqa: E712
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="No connected page found")

    return {
        "page_id": page.page_id,
        "page_name": page.page_name,
        "bot_name": page.bot_name,
        "bot_tone": page.bot_tone,
        "language_mode": page.language_mode or "auto",
        "system_prompt": page.system_prompt or "",
        "welcome_message": page.welcome_message,
        "fallback_message": page.fallback_message,
        "handover_message": page.handover_message or "Let me connect you with a human agent.",
        "auto_handover_after": page.auto_handover_after or 0,
        "quick_replies_enabled": page.quick_replies_enabled if page.quick_replies_enabled is not None else True,
        "typing_indicator_enabled": page.typing_indicator_enabled if page.typing_indicator_enabled is not None else True,
        "fetch_customer_name": page.fetch_customer_name if page.fetch_customer_name is not None else True,
    }


@router.put("/bot")
async def update_bot_settings(
    body: BotSettingsUpdate,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update bot settings for the user's first active page."""
    result = await db.execute(
        select(FacebookPage).where(FacebookPage.user_id == user.id, FacebookPage.is_active == True)  # noqa: E712
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="No connected page found")

    # Validation
    if body.bot_tone is not None and body.bot_tone not in VALID_TONES:
        raise HTTPException(status_code=400, detail=f"Invalid tone. Must be one of: {VALID_TONES}")
    if body.language_mode is not None and body.language_mode not in VALID_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Invalid language_mode. Must be one of: {VALID_LANGUAGES}")
    if body.system_prompt is not None and len(body.system_prompt) > 2000:
        raise HTTPException(status_code=400, detail="system_prompt must be 2000 characters or fewer")
    if body.auto_handover_after is not None and body.auto_handover_after < 0:
        raise HTTPException(status_code=400, detail="auto_handover_after must be >= 0")

    # Apply updates
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(page, field, value)

    await db.commit()
    return {"status": "ok", "message": "Bot settings updated"}


@router.post("/bot/preview")
async def preview_prompt(
    body: PreviewRequest,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """Dry-run: build prompt from current settings + a sample message, return prompt text."""
    result = await db.execute(
        select(FacebookPage).where(FacebookPage.user_id == user.id, FacebookPage.is_active == True)  # noqa: E712
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="No connected page found")

    page_config = {
        "bot_name": page.bot_name,
        "page_name": page.page_name,
        "bot_tone": page.bot_tone,
        "language_mode": page.language_mode or "auto",
        "system_prompt": page.system_prompt or "",
        "quick_replies_enabled": page.quick_replies_enabled if page.quick_replies_enabled is not None else True,
        "fetch_customer_name": page.fetch_customer_name if page.fetch_customer_name is not None else True,
    }

    prompt = build_prompt(
        user_message=body.sample_message,
        knowledge_context="[Sample knowledge base entry]\n--- [SHIPPING] Shipping Policy (Relevance: 95%) ---\nWe ship nationwide via Sundarban Courier. Delivery takes 2-4 business days.",
        history_text="",
        page_config=page_config,
    )

    return {"prompt": prompt, "page_config": page_config}
