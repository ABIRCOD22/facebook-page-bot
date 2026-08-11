import logging

import redis.asyncio as redis
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

    r = get_redis()
    await r.ping()
    logger.info("Redis connected")


async def close_db():
    """Cleanup on shutdown."""
    await engine.dispose()
    r = get_redis()
    await r.close()
    logger.info("Database connections closed")


async def ping_services() -> bool:
    """Selfcheck hook: verify DB + Redis are reachable."""
    try:
        async with engine.connect() as conn:
            await conn.execute("SELECT 1")
        await get_redis().ping()
        return True
    except Exception:
        logger.exception("Service ping failed")
        return False
