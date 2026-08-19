"""Runnable check: page-pick resolution + moderator prompt builder.

Fails if either new piece of connect-flow logic breaks. No framework.
Run: .venv\Scripts\python.exe backend\scripts\check_page_pick.py
"""

from api.routes.client_pages import _pick_chosen_page
from services.business_scanner import build_moderator_prompt

pages = [
    {"id": "111", "name": "Shop A", "access_token": "tok-a"},
    {"id": "222", "name": "Shop B", "access_token": "tok-b"},
]

assert _pick_chosen_page(pages, "222")["name"] == "Shop B"
assert _pick_chosen_page(pages, "222")["access_token"] == "tok-b"
assert _pick_chosen_page(pages, "999") is None
assert _pick_chosen_page([], "111") is None

prompt = build_moderator_prompt({"page_name": "RM Abir", "summary": "Sells handmade goods."})
assert "moderator" in prompt
assert '"RM Abir"' in prompt
assert "Sells handmade goods." in prompt

prompt_blank = build_moderator_prompt({})
assert "this page" in prompt_blank
assert "About the business" not in prompt_blank

print("OK: page-pick resolution + moderator prompt")