import json
import logging
import re
from dataclasses import dataclass, field

from google import genai
from google.genai import types

from config import get_settings
from core.conversation_manager import ConversationManager
from core.prompt_builder import build_prompt
from core.rag_engine import RAGEngine
from core.safety_layer import SafetyLayer

logger = logging.getLogger(__name__)
settings = get_settings()

_client = None
_aio_client = None


def get_genai_client():
    """Shared sync client (google-genai 1.x API)."""
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def get_genai_aio_client():
    """Shared async client - use in async paths so the event loop is never blocked."""
    global _aio_client
    if _aio_client is None:
        _aio_client = get_genai_client().aio
    return _aio_client


def _generation_config(**overrides):
    base = {
        "temperature": 0.7,
        "top_p": 0.8,
        "top_k": 40,
        "max_output_tokens": 2048,
        "safety_settings": [
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
            ),
        ],
    }
    base.update(overrides)
    return types.GenerateContentConfig(**base)


@dataclass
class AIResponse:
    text: str
    confidence: int = 70
    quick_replies: list = field(default_factory=list)
    should_handover: bool = False


class AIEngine:
    """The brain: Gemini (free) + RAG (ChromaDB, free)."""

    def __init__(self, user_id: str, page_config: dict):
        self.user_id = user_id
        self.page_config = page_config
        self.rag = RAGEngine(user_id)
        self.safety = SafetyLayer()
        self.model = settings.GEMINI_MODEL

    async def generate_response(
        self,
        conversation_id: str,
        user_message: str,
        history: list = None,
        image_context: str = None,
    ) -> AIResponse:
        search_results = self.rag.search(query=user_message, top_k=5)
        knowledge_context = self._format_knowledge(search_results)
        history_text = self._format_history(history or [])

        prompt = build_prompt(
            user_message=user_message,
            knowledge_context=knowledge_context,
            history_text=history_text,
            page_config=self.page_config,
            image_context=image_context,
        )

        try:
            response = await get_genai_aio_client().models.generate_content(
                model=self.model,
                contents=prompt,
                config=_generation_config(response_mime_type="application/json"),
            )
            ai_response = self._parse_response(response.text)
            ai_response.text = self.safety.sanitize_response(ai_response.text)
            return ai_response
        except Exception as e:
            logger.error("AI Engine error: %s", e)
            return AIResponse(
                text=self.page_config.get(
                    "fallback_message",
                    "I'd love to help! Let me connect you with our team for the best assistance.",
                ),
                confidence=0,
                should_handover=True,
            )

    def _parse_response(self, raw_text: str) -> AIResponse:
        try:
            text = raw_text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            parsed = json.loads(text)
            return AIResponse(
                text=parsed.get("response", "How can I help you?"),
                confidence=min(100, max(0, parsed.get("confidence", 70))),
                quick_replies=parsed.get("quick_replies", [])[:3],
                should_handover=parsed.get("should_handover", False),
            )
        except json.JSONDecodeError:
            # ponytail: Gemini sometimes returns truncated JSON — try regex
            # to salvage the "response" value from partial output instead of
            # forwarding raw JSON to the user on Facebook.
            logger.warning("AI returned non-JSON response, attempting extraction")
            match = re.search(r'"response"\s*:\s*"((?:[^"\\]|\\.)*)', raw_text)
            if match:
                extracted = match.group(1).replace('\\"', '"').replace("\\n", "\n")
                return AIResponse(text=extracted.strip()[:1900], confidence=50, quick_replies=[])
            return AIResponse(text=raw_text.strip()[:1900], confidence=50, quick_replies=[])

    def _format_knowledge(self, results) -> str:
        if not results:
            return ""
        formatted = ""
        for i, result in enumerate(results, 1):
            formatted += (
                f"\n--- [{result.category.upper()}] {result.title} "
                f"(Relevance: {result.score:.0%}) ---\n{result.content}\n"
            )
        return formatted

    def _format_history(self, messages) -> str:
        if not messages:
            return ""
        formatted = ""
        for msg in messages[-10:]:  # Last 10 messages only
            role = "Customer" if msg.sender_type == "customer" else "Assistant"
            formatted += f"{role}: {msg.content}\n"
        return formatted
