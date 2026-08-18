import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

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
from models.database_models import FacebookPage, KnowledgeBase, Product, Subscription, User
from core.rag_engine import RAGEngine

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
    await _seed_demo_knowledge()
    await _ensure_super_admin()

    logger.info("Platform is LIVE")
    logger.info(f"Webhook URL: {settings.APP_URL}/api/webhook")

    yield

    logger.info("Shutting down...")
    await close_db()


async def _seed_demo_knowledge():
    """Seed the admin demo account (if missing) and index knowledge into Chroma.

    Postgres is the source of truth (Railway's disk is ephemeral); Chroma is
    rebuilt from Postgres whenever its collection is empty.
    """
    async with AsyncSessionFactory() as session:
        from sqlalchemy import select

        user = (
            await session.execute(select(User).where(User.email == "admin@demo.com"))
        ).scalar_one_or_none()

        if user is None:
            user = User(
                email="admin@demo.com",
                password_hash="not-a-real-login",  # Phase 2 auth replaces this
                full_name="Demo Admin",
                role="client",
            )
            session.add(user)
            await session.flush()

            subscription = Subscription(
                user_id=user.id,
                tier="free_trial",
                status="active",
                max_messages_per_month=100,
                expires_at=datetime.utcnow() + timedelta(days=30),
            )
            session.add(subscription)

            page = FacebookPage(
                user_id=user.id,
                page_id=settings.FB_PAGE_ID,
                page_name="Demo Store",
                page_access_token=settings.FB_PAGE_ACCESS_TOKEN,
                fb_app_id=settings.FB_APP_ID,
                fb_app_secret=settings.FB_APP_SECRET,
            )
            session.add(page)

            products = [
                Product(
                    user_id=user.id,
                    name="Leather Laptop Bag",
                    description="Premium genuine leather laptop bag, fits 15.6 inch laptops. Water-resistant lining, padded laptop compartment, adjustable shoulder strap.",
                    price="4500",
                    currency="BDT",
                    availability="in_stock",
                    category="Accessories",
                    variants='{"colors": ["Brown", "Black"], "sizes": ["15.6\""]}',
                ),
                Product(
                    user_id=user.id,
                    name="Wireless Bluetooth Earbuds",
                    description="True wireless earbuds with noise cancellation, 24-hour battery life with charging case, IPX5 water resistance, touch controls.",
                    price="2500",
                    currency="BDT",
                    availability="in_stock",
                    category="Electronics",
                    variants='{"colors": ["White", "Black"]}',
                ),
                Product(
                    user_id=user.id,
                    name="Stainless Steel Water Bottle",
                    description="500ml vacuum insulated bottle, keeps drinks cold 24h or hot 12h. Leak-proof lid, powder-coated finish.",
                    price="800",
                    currency="BDT",
                    availability="out_of_stock",
                    category="Home & Kitchen",
                ),
            ]
            session.add_all(products)

            faqs = [
                KnowledgeBase(
                    user_id=user.id,
                    title="Shipping Policy",
                    content="We ship nationwide via Sundarban Courier and Pathao. Delivery takes 2-4 business days in Dhaka, 3-5 business days outside Dhaka. Shipping is free for orders above 3000 BDT. COD (Cash on Delivery) is available across Bangladesh.",
                    category="shipping",
                ),
                KnowledgeBase(
                    user_id=user.id,
                    title="Return Policy",
                    content="Items can be returned within 7 days of delivery if unused and in original packaging. Please message us with your order number and reason for return. Refunds are processed within 3-5 business days after we receive the item.",
                    category="policy",
                ),
                KnowledgeBase(
                    user_id=user.id,
                    title="Payment Methods",
                    content="We accept bKash, Nagad, Rocket, and Cash on Delivery (COD). For bKash/Nagad payments, you'll receive the merchant number after confirming your order. Always check the recipient name before completing payment.",
                    category="payment",
                ),
                KnowledgeBase(
                    user_id=user.id,
                    title="Business Hours",
                    content="Our support team is available Sunday to Saturday, 9 AM to 11 PM. Orders placed after 11 PM are processed the next morning. We reply to all messages within 30 minutes during business hours.",
                    category="general",
                ),
                KnowledgeBase(
                    user_id=user.id,
                    title="About Our Store",
                    content="We are an online store based in Dhaka, Bangladesh, offering quality products at honest prices. Every item is checked before shipping. Our goal is a 5-star experience with every order. Feel free to ask about any product.",
                    category="about",
                ),
            ]
            session.add_all(faqs)
            await session.commit()
            logger.info("Seeded demo user, subscription, page, products and FAQs")

            rag = RAGEngine(user.id)
            for product in products:
                rag.add_product(
                    product_id=product.id,
                    name=product.name,
                    description=product.description or "",
                    price=product.price or "",
                    currency=product.currency or "BDT",
                    availability=product.availability or "in_stock",
                    category=product.category or "",
                )
            for faq in faqs:
                rag.add_document(
                    document_id=faq.id,
                    title=faq.title,
                    content=faq.content,
                    category=faq.category,
                )
            logger.info("Indexed demo knowledge into Chroma")
            return

        # Existing demo account: rebuild Chroma only if its collection is empty,
        # and keep the page row in sync with .env (env is the Phase 1 config source)
        page = (
            await session.execute(select(FacebookPage).where(FacebookPage.user_id == user.id))
        ).scalar_one_or_none()
        if page is not None and page.page_id != settings.FB_PAGE_ID:
            page.page_id = settings.FB_PAGE_ID
            page.page_access_token = settings.FB_PAGE_ACCESS_TOKEN
            await session.commit()
            logger.info("Synced demo page row to .env values")

        rag = RAGEngine(user.id)
        stats = rag.get_stats()
        if stats.get("total_documents", 0) == 0:
            products = (
                await session.execute(
                    select(Product).where(
                        Product.user_id == user.id, Product.is_active == True  # noqa: E712
                    )
                )
            ).scalars().all()
            faqs = (
                await session.execute(
                    select(KnowledgeBase).where(
                        KnowledgeBase.user_id == user.id,
                        KnowledgeBase.is_active == True,  # noqa: E712
                    )
                )
            ).scalars().all()
            for product in products:
                rag.add_product(
                    product_id=product.id,
                    name=product.name,
                    description=product.description or "",
                    price=product.price or "",
                    currency=product.currency or "BDT",
                    availability=product.availability or "in_stock",
                    category=product.category or "",
                )
            for faq in faqs:
                rag.add_document(
                    document_id=faq.id,
                    title=faq.title,
                    content=faq.content,
                    category=faq.category,
                )
            logger.info("Rebuilt Chroma index from Postgres (%s docs)", len(products) + len(faqs))


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

# ponytail: settings-based CORS allowlist, not wildcard — ships with env-configured origins
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
