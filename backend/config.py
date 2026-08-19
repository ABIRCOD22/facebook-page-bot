from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Facebook
    FB_APP_ID: str
    FB_APP_SECRET: str
    FB_VERIFY_TOKEN: str
    FB_PAGE_ACCESS_TOKEN: str
    FB_PAGE_ID: str

    # Gemini
    GEMINI_API_KEY: str
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str

    # Auth
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_DAYS: int = 7

    # Admin panel (separate domain, separate JWT secret)
    ADMIN_JWT_SECRET_KEY: str = ""
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""

    # CORS — dev + deployed panels; override in env if the list changes
    ALLOWED_ORIGINS: str = (
        "http://localhost:3000,http://localhost:3001,http://localhost:3002,"
        "https://fb-autoreply-website.netlify.app,https://fb-autoreply-admin.netlify.app,"
        "https://fb-autoreply-client.netlify.app"
    )

    # App
    APP_ENV: str = "development"
    APP_URL: str = "http://localhost:8000"

    # Graph API
    GRAPH_API_VERSION: str = "v26.0"

    # Email (Brevo — free tier, 300/day, single-sender verification, no domain needed)
    BREVO_API_KEY: str = ""
    BREVO_FROM_EMAIL: str = ""
    BREVO_FROM_NAME: str = "Chatrix Support"

    # Public URLs used in emails and webhook callbacks
    CLIENT_PANEL_URL: str = "https://fb-autoreply-client.netlify.app"
    WEBHOOK_PUBLIC_URL: str = "https://facebook-page-bot-rdkt.onrender.com"

    # Where the Facebook Login dialog bounces back for admin-led provisioning
    # (owner approves in a popup during onboarding; admin completes the pick).
    FB_ADMIN_REDIRECT_URI: str = "https://fb-autoreply-admin.netlify.app/provision"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent / ".env",
        env_file_encoding="utf-8",
    )

    @property
    def GRAPH_API_BASE(self) -> str:
        return f"https://graph.facebook.com/{self.GRAPH_API_VERSION}"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
