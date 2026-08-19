"""Business scanner: profile a connected page + its website, seed the KB.

Deterministic (no LLM key needed). Every step degrades gracefully —
a missing token, blocked website or empty feed yields a partial
profile, never a raised error into the caller.
"""

import json
import logging
import re
from datetime import datetime
from html.parser import HTMLParser

import aiohttp
from sqlalchemy import select, update

from config import get_settings
from database.connection import AsyncSessionFactory
from models.database_models import FacebookPage, KnowledgeBase

logger = logging.getLogger(__name__)
settings = get_settings()

_EMOJI_RE = re.compile(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]")
_PROD_HINT = re.compile(r"(price|bdt|taka|order|buy|purchase|available|size|color|deliver|shipping|pay|off|discount|\btk\b|whatsapp)", re.I)

MAX_POSTS = 50
MIN_CONTENT = 30


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self._skip = False
        self._depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip = True
            self._depth += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._skip:
            self._depth -= 1
            if self._depth <= 0:
                self._skip = False

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)


def html_to_text(html: str) -> str:
    parser = _TextExtractor()
    try:
        parser.feed(html)
    except Exception:
        return ""
    return "\n".join(p.strip() for p in parser.parts if p.strip())


# ---------- deterministic, testable helpers ----------

def classify_tone(texts: list[str]) -> str:
    """Map a page's writing style to a bot_tone enum. Pure + deterministic."""
    joined = "\n".join(texts or [])
    if not joined.strip():
        return "professional_friendly"
    exclamations = joined.count("!") + len(
        re.findall(r"\b(?:haha|lol|wow|awesome|amazing|guys)\b", joined, re.I)
    )
    questions = joined.count("?")
    emojis = len(_EMOJI_RE.findall(joined))
    sentences = [s for s in re.split(r"[.!?]+", joined) if len(s.strip()) > 2]
    avg_len = sum(len(s) for s in sentences) / max(len(sentences), 1)
    if exclamations > 5 and (emojis >= 3 or questions >= 2):
        return "casual"
    if emojis > 6 and avg_len < 30:
        return "witty"
    if emojis == 0 and avg_len > 60 and questions == 0:
        return "formal"
    return "professional_friendly"


def extract_product_posts(post_texts: list[str], limit: int = 5) -> list[str]:
    """Posts that read like product offers — real RAG fuel for the KB."""
    hits = [t for t in post_texts if len(t.strip()) >= MIN_CONTENT and _PROD_HINT.search(t)]
    return hits[:limit]


def build_profile(core: dict, post_texts: list[str], website_text: str) -> dict:
    """Assemble the business profile JSON. Pure + deterministic."""
    about = (core.get("about") or core.get("description") or "").strip()
    category = (core.get("category") or "").strip()
    name = (core.get("name") or "").strip()
    tone = classify_tone([t for t in post_texts if t] + ([website_text[:500]] if website_text else []))
    product_posts = extract_product_posts([t for t in post_texts if t])

    summary_parts = []
    if name:
        summary_parts.append(f"{name} is a Facebook page")
    if category:
        summary_parts.append(f"categorized as {category}")
    if about:
        summary_parts.append(f"It describes itself as: {about[:300]}")
    if website_text:
        summary_parts.append("The business website highlights: " + website_text[:400])
    summary = " ".join(summary_parts) or "No public business information available yet."

    style = f"Communication style is {tone}: "
    if post_texts:
        style += f"{len(post_texts)} recent posts observed; "
    if any("?" in t for t in post_texts):
        style += "frequently answers customer questions; "
    if product_posts:
        style += f"{len(product_posts)} posts look like product offers."
    else:
        style += "no price/product mentions detected in recent posts."

    return {
        "page_name": name,
        "category": category,
        "summary": summary,
        "tone": tone,
        "style": style,
        "product_terms": [t[:100] for t in product_posts],
        "website_url": (core.get("website") or "").strip(),
    }


def build_moderator_prompt(profile: dict) -> str:
    """Default system prompt for fresh pages: the bot speaks as the page's
    moderator. Pure + deterministic so it can be asserted in a check script."""
    name = profile.get("page_name") or "this page"
    prompt = (
        f'You are the AI moderator of the page "{name}". You represent the page\'s team: '
        "welcome customers, answer their questions from the knowledge base, keep conversations "
        "polite and on-topic, and hand over to a human for anything you cannot answer."
    )
    summary = (profile.get("summary") or "").strip()
    if summary:
        prompt += f" About the business: {summary[:400]}"
    return prompt


# ---------- networked fetchers (never raise) ----------

async def _graph_get(url: str) -> dict:
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                return await resp.json()
    except Exception as e:  # noqa: BLE001
        logger.warning("Graph fetch failed: %s", e)
        return {}


async def fetch_page_core(page) -> dict:
    data = await _graph_get(
        f"{settings.GRAPH_API_BASE}/{page.page_id}?fields=name,about,description,website,category,phone,link&access_token={page.page_access_token}"
    )
    return data if isinstance(data, dict) else {}


async def fetch_recent_posts(page) -> list[str]:
    data = await _graph_get(
        f"{settings.GRAPH_API_BASE}/{page.page_id}/posts?fields=message,created_time&limit={MAX_POSTS}&access_token={page.page_access_token}"
    )
    return [p.get("message", "") for p in data.get("data", []) if p.get("message")]


async def fetch_website_text(website_url: str, max_chars: int = 4000) -> str:
    """Fetch homepage, convert to plain text. Single-origin, no link chasing."""
    if not website_url:
        return ""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                website_url,
                timeout=aiohttp.ClientTimeout(total=12),
                headers={"User-Agent": "Mozilla/5.0"},
            ) as resp:
                if resp.status != 200:
                    return ""
                homepage = await resp.text(errors="ignore") or ""
        return html_to_text(homepage)[:max_chars]
    except Exception as e:  # noqa: BLE001
        logger.warning("Website fetch failed (%s): %s", website_url, e)
        return ""


# ---------- orchestration ----------

async def seed_knowledge(user_id: str, profile: dict, post_texts: list[str]) -> int:
    """Seed KB rows from the scan. Idempotent: skips if the user has
    'scanned'-category rows already."""
    added = 0
    try:
        async with AsyncSessionFactory() as session:
            existing = (
                await session.execute(
                    select(KnowledgeBase).where(
                        KnowledgeBase.user_id == user_id, KnowledgeBase.category == "scanned"
                    )
                )
            ).scalars().all()
            if existing:
                return 0

            rows = []
            about_text = profile.get("summary", "")
            if about_text:
                rows.append(
                    KnowledgeBase(
                        user_id=user_id,
                        title=f"About {profile.get('page_name') or 'this business'}",
                        content=about_text,
                        category="scanned",
                    )
                )
            if profile.get("style"):
                rows.append(
                    KnowledgeBase(
                        user_id=user_id,
                        title="Business style & tone",
                        content=profile["style"],
                        category="scanned",
                    )
                )
            for i, snippet in enumerate(profile.get("product_terms", [])[:5]):
                rows.append(
                    KnowledgeBase(
                        user_id=user_id,
                        title=f"Scanned offering {i + 1}",
                        content=snippet,
                        category="scanned",
                    )
                )
            if not rows and post_texts:
                rows.append(
                    KnowledgeBase(
                        user_id=user_id,
                        title="Recent posts reference",
                        content="\n\n".join(post_texts[:5]),
                        category="scanned",
                    )
                )
            for r in rows:
                session.add(r)
            await session.commit()
            added = len(rows)
    except Exception as e:  # noqa: BLE001
        logger.warning("KB seeding failed: %s", e)
    return added


async def scan_page(user_id: str, page) -> dict:
    """Full scan: page info + posts + website → profile → KB seed. Never raises.
    Adopts the moderator voice when the user hasn't customized tone/prompt."""
    core = await fetch_page_core(page)
    posts = await fetch_recent_posts(page)
    website = await fetch_website_text((core.get("website") or "").strip())
    profile = build_profile(core, posts, website)

    # Only fill defaults a user hasn't touched: scaffold tone is
    # "professional_friendly", custom prompts start blank.
    mods: dict = {}
    if page.bot_tone == "professional_friendly":
        mods["bot_tone"] = profile["tone"]
    if not (page.system_prompt or "").strip():
        mods["system_prompt"] = build_moderator_prompt(profile)

    try:
        async with AsyncSessionFactory() as session:
            await session.execute(
                update(FacebookPage)
                .where(FacebookPage.id == page.id)
                .values(
                    business_profile=json.dumps(profile),
                    scan_status="done",
                    scanned_at=datetime.utcnow(),
                    **mods,
                )
            )
            await session.commit()
    except Exception as e:  # noqa: BLE001
        logger.warning("Persisting scan profile failed: %s", e)
    added = await seed_knowledge(user_id, profile, posts)
    return {
        "profile": profile,
        "kb_added": added,
        "posts_scanned": len(posts),
        "website_scanned": bool(website),
        "auto_voice": bool(mods),
    }