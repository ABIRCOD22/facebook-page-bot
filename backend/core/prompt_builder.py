"""Phase 2C: Builds the full system prompt from page settings.

Extracted from ai_engine.py:_build_prompt() — single source of truth for
how the bot talks. Reads page settings and applies language mode, tone,
custom instructions, and quick reply toggles.
"""


def build_prompt(
    user_message: str,
    knowledge_context: str,
    history_text: str,
    page_config: dict,
    image_context: str = None,
) -> str:
    """Build the Gemini prompt from page settings.

    page_config keys used:
        bot_name, page_name, bot_tone, language_mode, system_prompt,
        quick_replies_enabled, fetch_customer_name
    """
    bot_name = page_config.get("bot_name", "AI Assistant")
    page_name = page_config.get("page_name", "Our Business")
    bot_tone = page_config.get("bot_tone", "professional_friendly")
    language_mode = page_config.get("language_mode", "auto")
    custom_prompt = page_config.get("system_prompt", "")
    quick_replies_enabled = page_config.get("quick_replies_enabled", True)

    # Tone instructions — same as original ai_engine
    tone_instructions = {
        "professional_friendly": "Be professional yet warm and approachable.",
        "casual": "Be casual, friendly, and conversational. Like chatting with a helpful friend.",
        "formal": "Be formal and courteous. No slang.",
        "witty": "Be helpful with a touch of humor. Keep it light but informative.",
    }
    tone_guide = tone_instructions.get(bot_tone, tone_instructions["professional_friendly"])

    # Language mode instructions
    language_instructions = {
        "auto": "Respond in the SAME LANGUAGE the customer uses.",
        "en_only": "ALWAYS respond in English, regardless of the customer's language.",
        "bn_only": "ALWAYS respond in Bangla (বাংলা), regardless of the customer's language.",
        "bilingual": "Respond in BOTH English and Bangla (বাংলা). Provide the English response first, then the Bangla translation.",
    }
    language_guide = language_instructions.get(language_mode, language_instructions["auto"])

    # Custom prompt injection — user's custom instructions go here
    custom_section = ""
    if custom_prompt and custom_prompt.strip():
        custom_section = f"\n=== CUSTOM INSTRUCTIONS ===\n{custom_prompt.strip()}\n"

    # Quick replies section
    qr_instruction = ""
    if not quick_replies_enabled:
        qr_instruction = "\nDo NOT include quick_replies in your response. Set quick_replies to an empty array."

    image_section = (
        f"=== IMAGE CONTEXT ===\nThe customer sent an image. Analysis: {image_context}\n"
        if image_context
        else ""
    )

    return f"""You are "{bot_name}", the AI customer service assistant for "{page_name}" on Facebook Messenger.

=== YOUR PERSONALITY ===
{tone_guide}

=== LANGUAGE ===
{language_guide}
{custom_section}
=== ABSOLUTE RULES ===
1. ONLY answer using information from the KNOWLEDGE BASE below
2. If the answer is NOT in the knowledge base, say "I don't have that specific information, but let me connect you with our team!"
3. NEVER invent prices, product details, or policies
4. NEVER ask for passwords, full card numbers, or sensitive personal data
5. Keep responses SHORT (2-4 sentences max unless detailed explanation is needed)
6. If customer seems angry/frustrated, empathize first then offer human handover
7. If customer asks to speak to a human, immediately agree
8. NEVER badmouth competitors
9. NEVER make promises you can't verify from the knowledge base
10. Respond in the SAME LANGUAGE the customer uses

=== KNOWLEDGE BASE (Your ONLY source of truth) ===
{knowledge_context if knowledge_context else "No knowledge base entries found. Only provide general helpful responses and offer to connect with human."}

=== CONVERSATION HISTORY ===
{history_text if history_text else "This is the start of the conversation."}

{image_section}=== CURRENT CUSTOMER MESSAGE ===
{user_message}

=== RESPOND IN THIS EXACT JSON FORMAT ===
{{
    "response": "Your helpful response here",
    "confidence": 85,
    "quick_replies": ["Suggested Reply 1", "Suggested Reply 2"],
    "should_handover": false
}}{qr_instruction}

CONFIDENCE SCORING GUIDE:
- 90-100: Direct exact match found in knowledge base
- 70-89: Good match, answer is well-supported by knowledge base
- 50-69: Partial match, some inference required
- Below 50: Poor match or no relevant info found -> set should_handover to true

Respond with ONLY the JSON. No other text."""
