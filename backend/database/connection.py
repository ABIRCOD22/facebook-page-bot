import logging

import redis.asyncio as redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ============================================
# SQLAlchemy (PostgreSQL via Supabase)
# ============================================
class Base(DeclarativeBase):
    pass


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_ENV == "development",
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    # Supabase requires TLS; asyncpg takes ssl=, not sslmode= (URL params are
    # forwarded to asyncpg.connect() verbatim and sslmode would crash it).
    connect_args={"ssl": "require"},
)

AsyncSessionFactory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    async with AsyncSessionFactory() as session:
        try:
            yield session
        finally:
            await session.close()


# ============================================
# Redis (Upstash)
# ============================================
redis_client = None


def get_redis():
    global redis_client
    if redis_client is None:
        if not settings.REDIS_URL:
            logger.warning("REDIS_URL not set — Redis features disabled")
            return None
        redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return redis_client


# ============================================
# Init & Cleanup
# ============================================
async def init_db():
    """Create all tables on startup."""
    from models.database_models import (  # noqa: F401 - registers models with Base
        Conversation,
        FacebookPage,
        KnowledgeBase,
        Message,
        Product,
        Subscription,
        User,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created/verified")

    await _ensure_columns()

    r = get_redis()
    if r is not None:
        try:
            await r.ping()
            logger.info("Redis connected")
        except Exception as e:
            logger.warning("Redis unavailable at startup: %s", e)


async def close_db():
    """Cleanup on shutdown."""
    await engine.dispose()
    r = get_redis()
    if r is not None:
        try:
            await r.close()
        except Exception:
            pass
    logger.info("Database connections closed")


async def ping_services() -> bool:
    """Selfcheck hook: verify DB + Redis are reachable."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        r = get_redis()
        if r is not None:
            await r.ping()
        return True
    except Exception:
        logger.exception("Service ping failed")
        return False


async def _ensure_columns():
    """Idempotent ALTER TABLE for Phase 2+ schema evolution.

    ponytail: no alembic yet — schema churn is still high. Once it stabilises,
    replace this with a proper migration tool (alembic, yoyo, etc.).
    """
    alters = [
        "ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS fb_app_id VARCHAR(64)",
        "ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS fb_app_secret VARCHAR(128)",
        "ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS language_mode VARCHAR(20) DEFAULT 'auto'",
        "ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS system_prompt TEXT DEFAULT ''",
        "ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS handover_message TEXT DEFAULT 'Let me connect you with a human agent.'",
        "ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS auto_handover_after INTEGER DEFAULT 0",
        "ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS quick_replies_enabled BOOLEAN DEFAULT TRUE",
        "ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS typing_indicator_enabled BOOLEAN DEFAULT TRUE",
        "ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS fetch_customer_name BOOLEAN DEFAULT TRUE",
        "ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS verify_token VARCHAR(64)",
        "ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS webhook_verified_at TIMESTAMP WITHOUT TIME ZONE",
        "ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS business_profile TEXT",
        "ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS scan_status VARCHAR(20) DEFAULT 'not_scanned'",
        "ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMP WITHOUT TIME ZONE",
        "ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN DEFAULT TRUE",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS taken_over_at TIMESTAMP WITHOUT TIME ZONE",
    ]
    async with engine.begin() as conn:
        for stmt in alters:
            try:
                await conn.execute(text(stmt))
            except Exception as e:
                # Column already exists — Postgres throws 42701; other DBs may differ.
                if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                    logger.warning("ALTER failed: %s — %s", stmt, e)
    logger.info("Schema columns verified")
