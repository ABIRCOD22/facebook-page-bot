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


async def main():
    checks = [check_config]
    if len(sys.argv) > 1 and sys.argv[1] == "--db":
        checks.append(check_db)
    for check in checks:
        r = check()
        if asyncio.iscoroutine(r):
            await r
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
