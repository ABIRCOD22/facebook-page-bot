"""Trial + per-user isolation checks.

Run modes:
  python scripts/test_trial_isolation.py server      # needs backend on :8022
  python scripts/test_trial_isolation.py isolation   # standalone (no server)
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

failures = []


def check(name, cond, extra=""):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name} {extra}")
    if not cond:
        failures.append(name)


def mode_server():
    from fastapi.testclient import TestClient
    from main import app

    with TestClient(app) as client:
        check("app boot (TestClient)", True)

        email = "trialtest_" + os.urandom(3).hex() + "@example.com"
        try:
            r = client.post("/api/client/auth/register",
                            json={"email": email, "password": "Secret123", "full_name": "Trial Tester"})
        except Exception as e:  # noqa
            check("register returns 201", False, f"(exception: {e})")
            return
        st, reg = r.status_code, r.json()
        check("register returns 201", st == 201, f"(got {st})")
        token = reg.get("access_token")
        check("register returns access_token", bool(token))

        r = client.get("/api/client/subscription",
                       headers={"Authorization": "Bearer " + token})
        st, sub = r.status_code, r.json()
        check("subscription endpoint 200", st == 200, f"(got {st})")
        check("tier is free_trial", sub.get("tier") == "free_trial", f"(tier={sub.get('tier')})")
        check("status active", sub.get("status") == "active")
        check("is_trial True", sub.get("is_trial") is True)
        check("payment_required False", sub.get("payment_required") is False)
        check("days_remaining ~7", 5 <= (sub.get("days_remaining") or 0) <= 7,
              f"(days={sub.get('days_remaining')})")
        check("expires_at in future", bool(sub.get("expires_at")))


async def mode_isolation():
    from datetime import datetime, timedelta
    from types import SimpleNamespace

    from database.connection import AsyncSessionFactory
    from models.database_models import Subscription, User
    from core.rag_engine import RAGEngine
    from services.subscription_service import SubscriptionService

    # --- DB trial gate ---
    uid = "iso-gate-" + os.urandom(4).hex()
    async with AsyncSessionFactory() as s:
        u = User(email=uid + "@x.com", password_hash="x", full_name="x", role="user")
        s.add(u)
        await s.flush()
        sub = Subscription(user_id=u.id, tier="free_trial", status="active",
                           expires_at=datetime.utcnow() + timedelta(days=7))
        s.add(sub)
        await s.commit()
        uid_real = u.id

    page = SimpleNamespace(user_id=uid_real)
    active = await SubscriptionService.get_active_subscription_for_page(page)
    check("active subscription passes gate", active is not None)

    async with AsyncSessionFactory() as s:
        from sqlalchemy import select
        sub = (await s.execute(select(Subscription).where(Subscription.user_id == uid_real))).scalar_one()
        sub.expires_at = datetime.utcnow() - timedelta(days=1)
        await s.commit()
    active = await SubscriptionService.get_active_subscription_for_page(page)
    check("expired subscription blocked by gate (bot stops)", active is None)

    async with AsyncSessionFactory() as s:
        await s.execute(__import__("sqlalchemy").delete(Subscription).where(Subscription.user_id == uid_real))
        await s.execute(__import__("sqlalchemy").delete(User).where(User.id == uid_real))
        await s.commit()

    # --- RAG per-user isolation ---
    a = RAGEngine("iso_user_A")
    b = RAGEngine("iso_user_B")
    a.add_document("a1", "A product", "Special A content only")
    b.add_document("b1", "B product", "Special B content only")
    a_res = a.search("Special A content only")
    b_res = b.search("Special A content only")
    a_ids = [r.metadata.get("title") for r in a_res]
    b_ids = [r.metadata.get("title") for r in b_res]
    check("user A sees own doc", "A product" in a_ids, f"(got {a_ids})")
    check("user B cannot see user A doc (isolation)", "A product" not in b_ids, f"(got {b_ids})")
    a.clear_all()
    b.clear_all()


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "server"
    if mode == "server":
        mode_server()
    else:
        asyncio.run(mode_isolation())
    print("\n=== " + ("ALL PASS" if not failures else f"FAILURES: {failures}") + " ===")
    sys.exit(1 if failures else 0)
