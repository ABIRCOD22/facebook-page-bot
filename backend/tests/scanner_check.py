"""Runnable self-check for the business scanner's deterministic core.

Run: python tests/scanner_check.py  (from backend/)
Fails via assert if the scanner logic regresses. No frameworks.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.business_scanner import (  # noqa: E402
    build_profile,
    classify_tone,
    extract_product_posts,
    html_to_text,
)

# classify_tone: energetic page -> casual, none casual
posts = [
    "WOW!!! New stock just landed!! Order now!! 😍😍",
    "Amazing deal today!!! Hurry up guys!!",
    "Who's ready for the drop?? 😍",
    "Free delivery this week!!!",
]
assert classify_tone(posts) == "casual", f"tone got {classify_tone(posts)}"

formal = [
    "Our quarterly financial results are published, demonstrating consistent growth across all segments.",
    "The board of directors convened to review operational performance and corporate governance.",
]
assert classify_tone(formal) == "formal"

assert classify_tone([]) == "professional_friendly"

# extract_product_posts: only offer-ish posts pass; limit respected
mixed = [
    "Short post",  # too short even if matched
    "Price 500 BDT, all sizes available, order via WhatsApp for delivery.",
    "Just a friendly hello to all our followers!",
    "Buy 1 get 1 free this Friday! Shipping anywhere in Dhaka.",
    "Thanks for the birthday wishes everyone!",
    "New color options available now, pay on delivery.",
]
hits = extract_product_posts(mixed, limit=2)
assert len(hits) == 2, f"expected 2 hits, got {len(hits)}"
assert "hello" not in " ".join(hits).lower()

# build_profile: stable keys, tone threaded through, website reflected
core = {"name": "Test Bazaar", "category": "Retail", "about": "Dhaka's friendly market corner."}
profile = build_profile(core, posts, "We sell fresh produce with same-day delivery.")
for key in ("page_name", "category", "summary", "tone", "style", "product_terms", "website_url"):
    assert key in profile, f"missing key {key}"
assert profile["tone"] == "casual"
assert profile["page_name"] == "Test Bazaar"
assert profile["website_url"] == ""

# html_to_text: strips tags/script/style
html = "<html><head><title>x</title></head><body><p>Hello <b>world</b>.</p><script>var evil=1</script><style>.a{}</style>shop now</body></html>"
text = html_to_text(html)
assert "Hello" in text and "world" in text and "shop now" in text
assert "evil" not in text and "script" not in text

print("scanner_check: ALL OK")