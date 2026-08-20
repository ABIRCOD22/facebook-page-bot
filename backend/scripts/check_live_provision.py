"""Live smoke test of the deployed white-glove provisioning flow.

Hits the deployed Render backend (admin panel create-user -> client login ->
bot config validation -> reset-password) with no monkeypatching. The
Meta-dependent steps (fb/complete, fb/select, scan) need real tokens and are
probed only for sane error responses. Cleans up the test user at the end.

Run: python scripts/check_live_provision.py
"""
import json
import os
import sys
import urllib.request
import urllib.error

BASE = os.environ.get("LIVE_BASE", "https://facebook-page-bot-rdkt.onrender.com")

admin_email = os.environ.get("ADMIN_EMAIL")
admin_password = os.environ.get("ADMIN_PASSWORD")
if not admin_email or not admin_password:
    sys.exit("set ADMIN_EMAIL/ADMIN_PASSWORD in env (values from backend/.env)")


def call(method, path, body=None, headers=None, expect=None):
    req = urllib.request.Request(
        BASE + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", **(headers or {})},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            status, payload = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        status, payload = e.code, e.read().decode()
    except Exception as e:
        return f"NETERR {e}"
    ok = expect is None or status == expect
    print(f"{'PASS' if ok else 'FAIL'} {method} {path} -> {status} {payload[:220]}")
    return (status, payload)


print(f"target: {BASE}\n")

s1, _ = call("GET", "/health", expect=200)
if s1 != 200:
    sys.exit("health failed, aborting")

A = {}
s, p = call("POST", "/api/admin/auth/login",
            {"email": admin_email, "password": admin_password}, expect=200)
if s == 200:
    A = {"Authorization": "Bearer " + json.loads(p)["access_token"]}
else:
    sys.exit("admin login failed, aborting")

email = "liveprov_" + os.urandom(3).hex() + "@example.com"
s, p = call("POST", "/api/admin/users",
            {"email": email, "full_name": "Live Provision Tester", "tier": "free_trial"},
            headers=A, expect=201)
uid = json.loads(p).get("id") if s == 201 else None
gen_pw = json.loads(p).get("password") if s == 201 else None
print(f"  (user {uid} password={gen_pw!r})\n")
if not uid or not gen_pw:
    sys.exit("create user failed, aborting")

C = {}
s, p = call("POST", "/api/client/auth/login",
            {"email": email, "password": gen_pw}, expect=200)
if s == 200:
    C = {"Authorization": "Bearer " + json.loads(p)["access_token"]}
else:
    sys.exit("client login with generated password failed, aborting")

call("GET", "/api/client/dashboard", headers=C)  # authed session works

s, p = call("POST", f"/api/admin/users/{uid}/reset-password", {},
            headers=A, expect=200)
new_pw = json.loads(p).get("password") if s == 200 else None
if new_pw:
    call("POST", "/api/client/auth/login",
         {"email": email, "password": new_pw}, expect=200)
    call("POST", "/api/client/auth/login",
         {"email": email, "password": gen_pw})  # old pw must fail (401)

call("DELETE", f"/api/admin/users/{uid}", headers=A, expect=200)
print("\ncleanup: user deleted (webhook rows cascade)")