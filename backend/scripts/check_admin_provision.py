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
from services import page_connector
import api.routes.client_pages as cp
import api.routes.admin_provision as ap

cp.validate_token = lambda *a, **k: asyncio.sleep(0, result={
    "page_id": "PAGE_" + (a[0] if a else k.get("token", "")),
    "page_name": "Page " + str(a[0] if a else k.get("token", ""))[-4:],
})
cp.subscribe_app = lambda *a, **k: asyncio.sleep(0, result=True)
ap.subscribe_app = lambda *a, **k: asyncio.sleep(0, result=True)
ap.configure_app_webhook = lambda *a, **k: True

# available/connect user-token path: list_manageable_pages returns pages
FAKE_PAGES = [
    {"id": "FAKE_PG", "name": "Fake Provision Page", "access_token": "fakepgtok", "tasks": ["MESSAGING"]},
    {"id": "FAKE_PG2", "name": "Second Fake Page", "access_token": "fakepgtok2", "tasks": ["MESSAGING"]},
]
cp.list_manageable_pages = lambda *a, **k: asyncio.sleep(0, result=FAKE_PAGES)
ap.exchange_code = lambda *a, **k: asyncio.sleep(0, result="shorttok")
ap.make_long_lived_user_token = lambda *a, **k: asyncio.sleep(0, result="longtok")

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

        # pages/available with a pasted token -> user-token path lists pages
        r = client.post(f"/api/admin/users/{uid}/pages/available", json={"access_token": "tk_user"}, headers=A)
        check("pages/available -> 200 + pages", r.status_code == 200 and len(r.json().get("pages", [])) >= 1,
              f"({r.status_code})")

        # connect page for that user on behalf
        r = client.post(f"/api/admin/users/{uid}/pages/connect",
                        json={"page_access_token": "tk_user", "page_id": "FAKE_PG"}, headers=A)
        check("connect for user -> 200", r.status_code == 200, f"({r.status_code}): {r.text[:120]}")
        page_db_id = r.json()["id"] if r.status_code == 200 else None

        # fb/authorize -> dialog URL must point at the admin redirect URI
        r = client.post(f"/api/admin/users/{uid}/fb/authorize", headers=A)
        check("fb/authorize -> 200 + admin redirect", r.status_code == 200
              and s.FB_ADMIN_REDIRECT_URI in r.json().get("auth_url", ""), f"({r.status_code})")
        fb_state = r.json().get("state")

        # fb/complete with a fake code + state
        r = client.post(f"/api/admin/users/{uid}/fb/complete", json={"code": "fak", "state": fb_state}, headers=A)
        check("fb/complete -> 200 + pages", r.status_code == 200 and len(r.json().get("pages", [])) >= 1,
              f"({r.status_code})")

        # fb/select -> save the owner page under the target user
        r = client.post(f"/api/admin/users/{uid}/fb/select", json={"page_id": "FAKE_PG"}, headers=A)
        check("fb/select -> 200", r.status_code == 200, f"({r.status_code}): {r.text[:120]}")

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
        r = client.post(f"/api/admin/users/{uid}/pages/connect",
                        json={"page_access_token": "tk2", "page_id": "FAKE_PG2"}, headers=A)
        check("connect 2nd page (free limit) -> 403", r.status_code == 403, f"({r.status_code})")

        # cleanup: delete the throwaway user + pages
        r = client.delete(f"/api/admin/users/{uid}", headers=A)
        check("cleanup delete user -> ok", r.status_code == 200, f"({r.status_code})")


if __name__ == "__main__":
    main()
    print("\n=== " + ("ALL PASS" if not failures else f"FAILURES: {failures}") + " ===")
    sys.exit(1 if failures else 0)