"""Integration tests for client page-connection, conversations, and quota.

Run (from backend/): python scripts/test_client_features.py
Uses FastAPI TestClient (not a live server). Facebook Graph calls are
monkeypatched so no network is hit.

Note: DB writes happen only through the app's own event loop (webhook
reply / API endpoints). The sync engine is used only for read-only
assertions, because asyncpg's pool is bound to the TestClient loop.
"""

import asyncio
import os
import sys
import time
import types

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

failures = []


def check(name, cond, extra=""):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name} {extra}")
    if not cond:
        failures.append(name)


# ---- monkeypatches (set before any request) ----
from services import page_connector
from services import facebook_service
import api.routes.client_pages as cp
import api.routes.webhook as wh

cp.validate_token = lambda *a, **k: asyncio.sleep(0, result={
    "page_id": "PAGE_" + (a[0] if a else k.get("token", "")),
    "page_name": "Page " + str(a[0] if a else k.get("token", ""))[-4:],
})
cp.subscribe_app = lambda *a, **k: asyncio.sleep(0, result=True)

wh.verify_webhook_signature = lambda *a, **k: True


class FakeAI:
    def __init__(self, *a, **k):
        pass

    async def generate_response(self, **kwargs):
        return types.SimpleNamespace(text="Hello from bot", confidence=90, quick_replies=[], should_handover=False)


wh.AIEngine = FakeAI

async def _ok(*a, **k):
    return True


for _m in ("send_text_message", "send_quick_replies", "set_typing_indicator", "mark_seen"):
    setattr(facebook_service.FacebookService, _m, _ok)


# ---- DB read-only helper via API (keeps everything in the app's event loop) ----
def main():
    from fastapi.testclient import TestClient
    from main import app

    with TestClient(app) as client:
        # register
        email = "feat_" + os.urandom(3).hex() + "@example.com"
        r = client.post("/api/client/auth/register",
                        json={"email": email, "password": "Secret123", "full_name": "Feat User"})
        if r.status_code != 201:
            print("REGISTER FAIL", r.status_code, r.text)
        reg = r.json()
        token = reg.get("access_token")
        uid = (reg.get("user") or {}).get("id")
        if not uid and token:
            uid = client.get("/api/client/auth/me", headers={"Authorization": "Bearer " + token}).json()["id"]
        H = {"Authorization": "Bearer " + token}

        tok1 = "ptk_" + os.urandom(4).hex()
        tok2 = "ptk_" + os.urandom(4).hex()

        # connect first page
        r = client.post("/api/client/pages/connect", json={"page_access_token": tok1}, headers=H)
        check("connect page 1 -> 200", r.status_code == 200, f"({r.status_code})")
        check("connect returns page_name", str(r.json().get("page_name", "")).startswith("Page "))
        page_db_id = r.json()["id"]
        fb_page_id = r.json()["page_id"]

        # capacity: free_trial max_pages=1 -> second page rejected
        r = client.post("/api/client/pages/connect", json={"page_access_token": tok2}, headers=H)
        check("connect 2nd page -> 403 (limit)", r.status_code == 403, f"({r.status_code})")

        # list
        r = client.get("/api/client/pages", headers=H)
        check("list pages -> 1", r.status_code == 200 and len(r.json()["pages"]) == 1,
              f"(count={len(r.json().get('pages', []))})")

        # quota baseline
        used_before = client.get("/api/client/subscription", headers=H).json().get("messages_used") or 0

        # fire a webhook message -> backend creates a conversation + bot reply
        payload = {
            "object": "page",
            "entry": [{"id": fb_page_id, "messaging": [
                {"sender": {"id": "CUST_X"}, "recipient": {"id": fb_page_id},
                 "message": {"text": "any question"}}]}],
        }
        r = client.post("/api/webhook", json=payload)
        check("webhook POST -> 200", r.status_code == 200, f"({r.status_code})")

        # poll until the conversation exists
        conv_id = None
        for _ in range(50):
            time.sleep(0.2)
            r = client.get("/api/client/conversations", headers=H)
            if r.status_code == 200 and r.json().get("conversations"):
                conv_id = r.json()["conversations"][0]["id"]
                break
        check("conversation auto-created from webhook", conv_id is not None)

        # poll until the bot reply has been appended (fire-and-forget task)
        r = None
        for _ in range(50):
            time.sleep(0.2)
            r = client.get(f"/api/client/conversations/{conv_id}", headers=H)
            if r.status_code == 200 and len(r.json().get("messages", [])) >= 2:
                break
        check("conversation detail -> >=2 msgs", r is not None and r.status_code == 200
              and len(r.json()["messages"]) >= 2,
              f"(msgs={len(r.json().get('messages', [])) if r else 0})")

        before = len(r.json()["messages"])
        r = client.post(f"/api/client/conversations/{conv_id}/send",
                        json={"content": "Talk to a human"}, headers=H)
        check("send message -> 200", r.status_code == 200, f"({r.status_code})")
        r = client.get(f"/api/client/conversations/{conv_id}", headers=H)
        check("send added human_agent msg", len(r.json()["messages"]) == before + 1
              and r.json()["messages"][-1]["sender_type"] == "human_agent")

        # quota: messages_used incremented by the bot reply
        used_after = None
        for _ in range(30):
            time.sleep(0.2)
            used_after = client.get("/api/client/subscription", headers=H).json().get("messages_used")
            if used_after is not None and used_after > used_before:
                break
        check("webhook incremented messages_used", used_after is not None and used_after == used_before + 1,
              f"(before={used_before}, after={used_after})")

        # disconnect
        r = client.delete(f"/api/client/pages/{page_db_id}", headers=H)
        check("disconnect -> 200", r.status_code == 200, f"({r.status_code})")
        r = client.get("/api/client/pages", headers=H)
        check("after disconnect -> 0 pages", len(r.json()["pages"]) == 0)
        r = client.get("/api/client/bot", params={"page_id": fb_page_id}, headers=H)
        check("bot 404 after disconnect", r.status_code == 404, f"({r.status_code})")


if __name__ == "__main__":
    main()
    print("\n=== " + ("ALL PASS" if not failures else f"FAILURES: {failures}") + " ===")
    sys.exit(1 if failures else 0)
