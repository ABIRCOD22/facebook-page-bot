import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from config import get_settings
from database.connection import close_db, init_db

# ponytail: CORS middleware deferred to Phase 2 when a frontend origin exists
# (guide's allow_origins=["*"] + allow_credentials=True is a known bad config;
# it will ship as a settings-based allowlist, not a wildcard).

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Starting AI Bot SaaS Platform...")

    await init_db()

    logger.info("Platform is LIVE")
    logger.info(f"Webhook URL: {settings.APP_URL}/api/webhook")

    yield

    logger.info("Shutting down...")
    await close_db()


app = FastAPI(
    title="AI Bot SaaS Platform",
    description="AI-powered Facebook Messenger bot platform",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/")
async def root():
    return {
        "status": "alive",
        "service": "AI Bot SaaS Platform",
        "version": "1.0.0",
        "phase": "Phase 1 - Auto Reply Bot",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
