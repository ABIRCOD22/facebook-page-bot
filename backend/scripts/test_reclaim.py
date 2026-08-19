"""Verify register-reclaim: re-registering a shell account must return 201,
not 409. Run (from backend/): python scripts/test_reclaim.py

Uses FastAPI TestClient against the local code (same Supabase DB as prod via
.env). Creates one throwaway user and removes it afterwards.
"""

import asyncio
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx

from main import app
from database.connection import AsyncSessionFactory
from models.database_models import Subscription, User
from sqlalchemy import delete, select

email = f"reclaim-probe-{datetime.utcnow().timestamp():.0f}@test.dev"
pw = "Probe12345!"


async def cleanup():
    async with AsyncSessionFactory() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user:
            await db.execute(delete(Subscription).where(Subscription.user_id == user.id))
            await db.execute(delete(User).where(User.id == user.id))
            await db.commit()


async def main():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        r1 = await c.post("/api/client/auth/register", json={"email": email, "password": pw, "full_name": "First Try"})
        print("1st register:", r1.status_code)
        assert r1.status_code == 201, r1.text

        r2 = await c.post("/api/client/auth/register", json={"email": email, "password": pw, "full_name": "Second Try"})
        print("2nd register (same email):", r2.status_code)
        assert r2.status_code == 201, f"expected 201 reclaim, got {r2.status_code}: {r2.text}"
        assert r2.json()["user"]["full_name"] == "Second Try", r2.text

        r3 = await c.post("/api/client/auth/login", json={"email": email, "password": pw})
        assert r3.status_code == 200, f"login with reclaimed creds failed: {r3.status_code}"
        print("login after reclaim: OK")

    print("ALL PASS")
    await cleanup()


if __name__ == "__main__":
    asyncio.run(main())