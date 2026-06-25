"""Application configuration."""

from pathlib import Path

from pydantic import ConfigDict, model_validator
from pydantic_settings import BaseSettings

# Anchor all relative paths to the server/ directory, not cwd
SERVER_DIR = Path(__file__).resolve().parent
DEV_JWT_SECRET = "breakgen-dev-secret-change-in-production"


class Settings(BaseSettings):
    model_config = ConfigDict(
        env_file=".env",
        env_prefix="BREAKGEN_",
    )

    app_name: str = "BreakGen"
    debug: bool = True
    database_url: str = f"sqlite+aiosqlite:///{SERVER_DIR / 'breakgen.db'}"
    artifacts_dir: str = str(SERVER_DIR / "artifacts")
    templates_dir: str = str(SERVER_DIR / "templates")
    jwt_secret: str = DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 72
    min_password_length: int = 8
    public_signup_enabled: bool = False
    signup_invite_code: str = ""
    cors_origins: str = "http://localhost:5173"
    cors_allow_credentials: bool = True

    # Meshy AI (Phase 3)
    meshy_api_key: str = ""
    meshy_api_url: str = "https://api.meshy.ai"
    meshy_model_download_max_bytes: int = 64 * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        """Return CORS origins from a comma-separated environment value."""
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]

    @model_validator(mode="after")
    def validate_security_settings(self) -> "Settings":
        if not self.debug and self.jwt_secret == DEV_JWT_SECRET:
            raise ValueError(
                "BREAKGEN_JWT_SECRET must be set when BREAKGEN_DEBUG=false"
            )
        if self.min_password_length < 8:
            raise ValueError("BREAKGEN_MIN_PASSWORD_LENGTH must be at least 8")
        if not self.debug and self.public_signup_enabled and not self.signup_invite_code:
            raise ValueError(
                "BREAKGEN_SIGNUP_INVITE_CODE must be set when public signup is enabled in production"
            )
        if not self.cors_origin_list:
            raise ValueError("BREAKGEN_CORS_ORIGINS must include at least one origin")
        if (
            not self.debug
            and self.cors_allow_credentials
            and "*" in self.cors_origin_list
        ):
            raise ValueError(
                "BREAKGEN_CORS_ORIGINS cannot include * with credentials in production"
            )
        return self


settings = Settings()

# Ensure artifact directory exists
Path(settings.artifacts_dir).mkdir(parents=True, exist_ok=True)
