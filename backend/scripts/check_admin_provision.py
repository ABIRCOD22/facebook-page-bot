"""Check script for admin white-glove provisioning endpoints.

Run (from backend/): python scripts/check_admin_provision.py
Uses FastAPI TestClient (not a live server); Graph calls monkeypatched so no
network is hit. DB workers: creates one throwaway user + page row, deletes
them afterwards (admin delete endpoint) so the live DB stays clean.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

failures = []


def check(name, cond, extra=""):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name} {extra}")
    if not cond:
        failures.append(name)


# ---- monkeypatches (set before any request) ----
import api.routes.admin_provision as ap

ap.validate_token = lambda *a, **k: asyncio.sleep(0, result={
    "page_id": "PAGE_" + (a[0] if a else k.get("token", "")),
    "page_name": "Page " + str(a[0] if a else k.get("token", ""))[-4:],
})
ap.test_connection = lambda *a, **k: asyncio.sleep(0, result={"valid": True})

ap.scan_page = lambda *a, **k: asyncio.sleep(0, result={
    "profile": {"page_name": "Fake Provision Page", "tone": "professional_friendly"},
    "kb_added": 1,
    "posts_scanned": 5,
    "website_scanned": False,
    "auto_voice": True,
})


def main():
    from fastapi.testclient import TestClient
    from main import app
    from config import get_settings
    import api.routes.admin_users as au

    au.send_email = lambda *a, **k: asyncio.sleep(0, result=None)

    with TestClient(app) as client:
        # admin login (super-admin bootstrapped from env at startup)
        s = get_settings()
        r = client.post("/api/admin/auth/login", json={"email": s.ADMIN_EMAIL, "password": s.ADMIN_PASSWORD})
        check("admin login -> 200", r.status_code == 200, f"({r.status_code})")
        if r.status_code != 200:
            print("  (set ADMIN_EMAIL/ADMIN_PASSWORD in backend/.env)")
            return
        atok = r.json()["access_token"]
        A = {"Authorization": "Bearer " + atok}

        # create user with auto-generated password (white-glove delivery)
        email = "prov_" + os.urandom(3).hex() + "@example.com"
        r = client.post("/api/admin/users", json={"email": email, "full_name": "Provision Tester", "tier": "free_trial"}, headers=A)
        check("create user (generated password) -> 201", r.status_code == 201, f"({r.status_code})")
        check("generated password returned", bool(r.json().get("password")), f"({len(r.json().get('password') or '')} chars)")
        uid = r.json()["id"]

        # connect-app: save the customer's app id/secret/token -> awaiting_webhook
        r = client.post(f"/api/admin/users/{uid}/pages/connect-app",
                        json={"fb_app_id": "APP1", "fb_app_secret": "SEC1", "page_access_token": "tk_user"}, headers=A)
        check("connect-app -> 200 + awaiting_webhook", r.status_code == 200
              and r.json().get("status") == "awaiting_webhook", f"({r.status_code}): {r.text[:120]}")
        check("connect-app returns callback_url + verify_token",
              r.status_code == 200 and r.json().get("callback_url") and r.json().get("verify_token"),
              f"({r.status_code})")
        page_db_id = r.json()["id"] if r.status_code == 200 else None
        verify_token = r.json().get("verify_token")

        # test-connection before the customer confirmed the webhook -> 400
        r = client.post(f"/api/admin/bots/{page_db_id}/test-connection", headers=A)
        check("test-connection (webhook not connected) -> 400", r.status_code == 400, f"({r.status_code})")

        # customer connects the webhook in their Meta App Dashboard: Meta's GET
        # challenge against our /api/webhook with the page verify token
        r = client.get("/api/webhook", params={"hub.mode": "subscribe", "hub.verify_token": verify_token, "hub.challenge": "1234"})
        check("webhook GET challenge (page token) -> 200 + echo", r.status_code == 200 and r.text == "1234",
              f"({r.status_code}): {r.text[:80]}")

        # test-connection after confirmation -> 200
        r = client.post(f"/api/admin/bots/{page_db_id}/test-connection", headers=A)
        check("test-connection (webhook connected) -> 200", r.status_code == 200, f"({r.status_code}): {r.text[:120]}")

        # config the bot: invalid tone -> 400, valid -> 200
        r = client.put(f"/api/admin/bots/{page_db_id}/config",
                       json={"bot_tone": "not_a_tone"}, headers=A)
        check("config invalid tone -> 400", r.status_code == 400, f"({r.status_code})")
        r = client.put(f"/api/admin/bots/{page_db_id}/config",
                       json={"bot_name": "Provision Bot", "bot_tone": "casual", "language_mode": "bilingual"},
                       headers=A)
        check("config valid -> 200", r.status_code == 200, f"({r.status_code})")

        # scan: bot trains itself (profile + KB)
        r = client.post(f"/api/admin/bots/{page_db_id}/scan", headers=A)
        check("scan -> 200 + kb", r.status_code == 200 and r.json().get("kb_added", 0) >= 0,
              f"({r.status_code})")

        # reset-password: new generated creds returned + user can log in
        r = client.post(f"/api/admin/users/{uid}/reset-password", json={}, headers=A)
        check("reset-password -> 200 + new password", r.status_code == 200 and bool(r.json().get("password")),
              f"({r.status_code})")
        new_pw = r.json().get("password")
        r = client.post("/api/client/auth/login", json={"email": email, "password": new_pw})
        check("new password logs in as user", r.status_code == 200, f"({r.status_code})")

        # page limit: free-tier user connecting 2nd page -> 403
        r = client.post(f"/api/admin/users/{uid}/pages/connect-app",
                        json={"fb_app_id": "APP2", "fb_app_secret": "SEC2", "page_access_token": "tk2"}, headers=A)
        check("connect-app 2nd page (free limit) -> 403", r.status_code == 403, f"({r.status_code})")

        # cleanup: delete the throwaway user + pages
        r = client.delete(f"/api/admin/users/{uid}", headers=A)
        check("cleanup delete user -> ok", r.status_code == 200, f"({r.status_code})")


if __name__ == "__main__":
    main()
    print("\n=== " + ("ALL PASS" if not failures else f"FAILURES: {failures}") + " ===")
    sys.exit(1 if failures else 0)