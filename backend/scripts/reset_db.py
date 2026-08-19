"""Dev reset: truncate every table, then re-seed the rows that startup normally creates.

Use when test data (pages, conversations, users) blocks re-testing — e.g. the
free_trial max_pages=1 limit is consumed. Restores the exact state a fresh
deploy boots into: system_settings row + super-admin from env (no Render
restart required). Demo/registered accounts are dropped — register again.
"""

import asyncio
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from sqlalchemy import text

from database.connection import AsyncSessionFactory, Base
from models.database_models import User, SystemSettings  # noqa: F401  (register tables)


async def reset() -> None:
    tables = ", ".join(f'"{t}"' for t in Base.metadata.tables)
    async with AsyncSessionFactory() as db:
        await db.execute(text(f"TRUNCATE TABLE {tables} CASCADE"))

        db.add(SystemSettings(id="global"))

        from config import get_settings
        from utils.password import hash_password

        settings = get_settings()
        if settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD:
            db.add(
                User(
                    email=settings.ADMIN_EMAIL,
                    password_hash=hash_password(settings.ADMIN_PASSWORD),
                    full_name="Super Admin",
                    role="super_admin",
                    is_active=True,
                )
            )

        await db.commit()

        for table in Base.metadata.tables:
            n = (await db.execute(text(f'SELECT COUNT(*) FROM "{table}"'))).scalar()
            print(f"{table}: {n}")


if __name__ == "__main__":
    asyncio.run(reset())