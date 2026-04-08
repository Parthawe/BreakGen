"""Application configuration."""

from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "BreakGen"
    debug: bool = True
    database_url: str = "sqlite+aiosqlite:///./breakgen.db"
    artifacts_dir: str = "./artifacts"
    templates_dir: str = "./templates"

    # Meshy AI (Phase 3)
    meshy_api_key: str = ""
    meshy_api_url: str = "https://api.meshy.ai"

    class Config:
        env_file = ".env"
        env_prefix = "BREAKGEN_"


settings = Settings()

# Ensure artifact directory exists
Path(settings.artifacts_dir).mkdir(parents=True, exist_ok=True)
