"""Self-check for the backend. Stdlib only. Run: python scripts/selfcheck.py"""

import asyncio
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))


def check_config():
    from config import get_settings

    s = get_settings()
    assert s.GRAPH_API_VERSION == "v26.0", s.GRAPH_API_VERSION
    assert s.GRAPH_API_BASE == "https://graph.facebook.com/v26.0", s.GRAPH_API_BASE
    assert s.JWT_ALGORITHM == "HS256"
    placeholders = {
        k: v
        for k, v in s.model_dump().items()
        if isinstance(v, str) and v.startswith("your_")
    }
    if placeholders:
        print(f"[warn] placeholders in .env: {', '.join(placeholders)}")
    assert s.FB_PAGE_ID, "FB_PAGE_ID must not be empty"
    print("config: OK")


async def check_db():
    from database.connection import engine, redis_client, ping_services

    ok = await ping_services()
    assert ok, "DB/Redis not reachable (fill real credentials in .env)"
    await engine.dispose()
    if redis_client:
        await redis_client.aclose()
    print("database: OK")


def check_models():
    from database.connection import Base
    from models.database_models import User, generate_uuid

    tables = Base.metadata.tables
    assert set(tables) == {
        "users",
        "subscriptions",
        "facebook_pages",
        "conversations",
        "messages",
        "knowledge_base",
        "products",
    }, set(tables)
    assert tables["users"].c.email.unique, "users.email must be unique"
    assert tables["subscriptions"].c.user_id.unique, "subscription must be 1:1"
    assert tables["facebook_pages"].c.page_id.unique
    assert tables["conversations"].c.customer_fb_id.index
    assert tables["messages"].c.timestamp.index
    assert tables["messages"].c.conversation_id.nullable is False
    assert tables["subscriptions"].c.expires_at.nullable is False
    assert len({generate_uuid() for _ in range(100)}) == 100, "generate_uuid must be unique"
    assert User.__mapper__.relationships["subscription"].uselist is False
    print("models: OK")


async def check_models_db():
    from datetime import datetime

    from sqlalchemy import select
    from sqlalchemy.exc import IntegrityError

    from database.connection import AsyncSessionFactory, init_db
    from models.database_models import (
        Conversation,
        FacebookPage,
        KnowledgeBase,
        Message,
        Product,
        Subscription,
        User,
    )

    await init_db()
    async with AsyncSessionFactory() as s:
        u = User(email="selfcheck@test.local", password_hash="x", full_name="Selfcheck")
        s.add(u)
        await s.flush()
        s.add(Subscription(user_id=u.id, expires_at=datetime.utcnow()))
        p = FacebookPage(
            user_id=u.id, page_id="selfcheck_page", page_access_token="t", bot_tone="casual"
        )
        s.add(p)
        await s.flush()
        c = Conversation(page_id=p.id, customer_fb_id="cust_1")
        s.add(c)
        await s.flush()
        s.add(
            Message(conversation_id=c.id, sender_type="customer", content="hi"),
            KnowledgeBase(user_id=u.id, title="KB", content="kb content"),
            Product(user_id=u.id, name="Widget", price="10", currency="BDT"),
        )
        await s.commit()

        msg_id = (await s.execute(select(Message.id).limit(1))).scalar_one()
        assert (await s.get(Message, msg_id)).content == "hi"

        dup = User(email="selfcheck@test.local", password_hash="x", full_name="Dup")
        s.add(dup)
        try:
            await s.commit()
            raise AssertionError("unique email must be enforced")
        except IntegrityError:
            await s.rollback()
        row = (await s.execute(select(User).where(User.email == "selfcheck@test.local"))).scalar_one()
        assert row.full_name == "Selfcheck"
        print("models roundtrip: OK")


def check_app():
    import main

    assert main.app.title == "AI Bot SaaS Platform"
    print("app import: OK")


async def check_app_live():
    import json
    import subprocess
    import sys
    import time
    import urllib.request

    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--port", "8765"],
        cwd=BACKEND,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        for _ in range(30):
            try:
                with urllib.request.urlopen("http://127.0.0.1:8765/health", timeout=1) as r:
                    assert json.loads(r.read()) == {"status": "healthy"}
                break
            except Exception:
                time.sleep(1)
        else:
            raise AssertionError("server did not become ready")
        with urllib.request.urlopen("http://127.0.0.1:8765/", timeout=2) as r:
            data = json.loads(r.read())
        assert data["status"] == "alive" and data["phase"].startswith("Phase 1")
        print("app routes: OK")
    finally:
        proc.terminate()
        proc.wait(timeout=10)


async def main():
    checks = [check_config, check_models, check_app]
    if len(sys.argv) > 1 and sys.argv[1] == "--db":
        checks.extend([check_db, check_models_db, check_app_live])
    for check in checks:
        r = check()
        if asyncio.iscoroutine(r):
            await r
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
