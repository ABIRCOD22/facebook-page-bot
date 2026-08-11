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

    # App
    APP_ENV: str = "development"
    APP_URL: str = "http://localhost:8000"

    # Graph API
    GRAPH_API_VERSION: str = "v26.0"

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
