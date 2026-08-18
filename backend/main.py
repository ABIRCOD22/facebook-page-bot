import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.client_auth import router as client_auth_router
from api.routes.client_bot import router as client_bot_router
from api.routes.client_pages import router as client_pages_router
from api.routes.client_products import router as client_products_router
from api.routes.client_knowledge import router as client_knowledge_router
from api.routes.client_subscription import router as client_subscription_router
from api.routes.client_conversations import router as client_conversations_router
from api.routes.webhook import router as webhook_router
from api.routes.admin_auth import router as admin_auth_router
from api.routes.admin_overview import router as admin_overview_router
from api.routes.admin_users import router as admin_users_router
from api.routes.admin_subscriptions import router as admin_subscriptions_router
from api.routes.admin_bots import router as admin_bots_router
from api.routes.admin_conversations import router as admin_conversations_router
from api.routes.admin_analytics import router as admin_analytics_router
from api.routes.admin_revenue import router as admin_revenue_router
from api.routes.admin_kb_templates import router as admin_kb_templates_router
from api.routes.admin_system import router as admin_system_router
from config import get_settings
from database.connection import AsyncSessionFactory, close_db, init_db
from utils.password import hash_password
from models.database_models import User

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
    await _ensure_super_admin()

    logger.info("Platform is LIVE")
    logger.info(f"Webhook URL: {settings.APP_URL}/api/webhook")

    yield

    logger.info("Shutting down...")
    await close_db()



async def _ensure_super_admin():
    """Bootstrap the super-admin account from env (ADMIN_EMAIL/ADMIN_PASSWORD)."""
    settings = get_settings()
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        logger.warning("ADMIN_EMAIL/ADMIN_PASSWORD not set - super-admin not bootstrapped")
        return
    async with AsyncSessionFactory() as session:
        from sqlalchemy import select

        user = (
            await session.execute(select(User).where(User.email == settings.ADMIN_EMAIL))
        ).scalar_one_or_none()
        if user is None:
            user = User(
                email=settings.ADMIN_EMAIL,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                full_name="Super Admin",
                role="super_admin",
                is_active=True,
            )
            session.add(user)
            await session.commit()
            logger.info("Bootstrapped super-admin %s", settings.ADMIN_EMAIL)
        elif user.role != "super_admin":
            user.role = "super_admin"
            user.password_hash = hash_password(settings.ADMIN_PASSWORD)
            user.is_active = True
            await session.commit()
            logger.info("Promoted %s to super-admin", settings.ADMIN_EMAIL)


app = FastAPI(
    title="AI Bot SaaS Platform",
    description="AI-powered Facebook Messenger bot platform",
    version="1.0.0",
    lifespan=lifespan,
)

# ponytail: settings-based CORS allowlist, not wildcard â€” ships with env-configured origins
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook_router)
app.include_router(client_auth_router)
app.include_router(client_bot_router)
app.include_router(client_products_router)
app.include_router(client_knowledge_router)
app.include_router(client_subscription_router)
app.include_router(client_pages_router)
app.include_router(client_conversations_router)
app.include_router(admin_auth_router)
app.include_router(admin_overview_router)
app.include_router(admin_users_router)
app.include_router(admin_subscriptions_router)
app.include_router(admin_bots_router)
app.include_router(admin_conversations_router)
app.include_router(admin_analytics_router)
app.include_router(admin_revenue_router)
app.include_router(admin_kb_templates_router)
app.include_router(admin_system_router)


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
