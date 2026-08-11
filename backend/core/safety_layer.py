import logging
import re

from database.connection import get_redis

logger = logging.getLogger(__name__)


class SafetyLayer:
    """Protects the page from policy violations, abuse, injection, and flooding."""

    # Words the BOT should never use in responses (Facebook policy risk)
    BANNED_BOT_PHRASES = [
        "guaranteed results",
        "100% guaranteed",
        "act now",
        "limited time only",
        "buy immediately",
        "send me your password",
        "credit card number",
        "social security",
        "wire transfer",
        "click this link immediately",
    ]

    # Detect potential prompt injection from customers
    INJECTION_PATTERNS = [
        r"ignore (all |your |previous )?(instructions|rules|prompts)",
        r"you are now",
        r"pretend (to be|you are)",
        r"system prompt",
        r"reveal your (instructions|prompt|rules)",
        r"jailbreak",
        r"DAN mode",
    ]

    def is_safe_input(self, text: str) -> bool:
        """Check if user message is safe to process."""
        if not text or not text.strip():
            return False
        if len(text) > 5000:
            return False

        text_lower = text.lower()
        for pattern in self.INJECTION_PATTERNS:
            if re.search(pattern, text_lower):
                logger.warning("Prompt injection detected: %s", text[:100])
                # ponytail: detection is log-only (blocking would tip off the user);
                # the prompt itself forbids following user instructions. Ceiling:
                # flagged conversations are not quarantined. Upgrade path: write
                # injection hits to a flag on Conversation and auto-handover.
                return True
        return True

    def sanitize_response(self, response: str) -> str:
        """Clean bot response before sending to customer."""
        if not response:
            return "I'm here to help! Could you tell me more about what you need?"

        response_lower = response.lower()
        for phrase in self.BANNED_BOT_PHRASES:
            if phrase in response_lower:
                response = re.sub(
                    re.escape(phrase), "[removed]", response, flags=re.IGNORECASE
                )

        if len(response) > 1900:
            response = response[:1900] + "..."

        emoji_pattern = re.compile(
            "[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF"
            "\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF"
            "\U00002702-\U000027B0\U000024C2-\U0001F251]+",
            flags=re.UNICODE,
        )
        emojis = emoji_pattern.findall(response)
        if len(emojis) > 3:
            count = 0

            def limit_emoji(match):
                nonlocal count
                count += 1
                return match.group() if count <= 3 else ""

            response = emoji_pattern.sub(limit_emoji, response)

        return response.strip()

    async def check_rate_limit(self, page_id: str, customer_id: str) -> dict:
        """Returns {"allowed": bool, "reason": str}."""
        r = get_redis()

        customer_key = f"rate:customer:{page_id}:{customer_id}"
        customer_count = await r.incr(customer_key)
        if customer_count == 1:
            await r.expire(customer_key, 60)
        if customer_count > 8:
            logger.warning("Rate limit hit for customer %s", customer_id[:10])
            return {"allowed": False, "reason": "customer_flood"}

        page_key = f"rate:page:{page_id}:hourly"
        page_count = await r.incr(page_key)
        if page_count == 1:
            await r.expire(page_key, 3600)
        if page_count > 200:
            logger.warning("Page rate limit hit for %s", page_id)
            return {"allowed": False, "reason": "page_limit"}

        return {"allowed": True, "reason": None}

    def calculate_typing_delay(self, response_text: str) -> float:
        """Natural-feeling delay: instant replies look bot-like to Facebook."""
        words = len(response_text.split())
        return min(max(words * 0.08, 1.0), 4.0)
