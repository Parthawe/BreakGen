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
    artifact_storage_backend: str = "local"
    artifact_storage_public_base_url: str = ""
    r2_endpoint_url: str = ""
    r2_bucket: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    templates_dir: str = str(SERVER_DIR / "templates")
    jwt_secret: str = DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 72
    min_password_length: int = 8
    public_signup_enabled: bool = False
    signup_invite_code: str = ""
    cors_origins: str = "http://localhost:5173"
    cors_allow_credentials: bool = True
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    apple_oauth_client_id: str = ""
    apple_oauth_team_id: str = ""
    apple_oauth_key_id: str = ""
    apple_oauth_private_key: str = ""
    launch_lead_rate_limit_per_minute: int = 12
    launch_lead_note_max_length: int = 1000
    auth_rate_limit_per_minute: int = 20
    generation_rate_limit_per_minute: int = 8
    compile_rate_limit_per_minute: int = 12
    validation_rate_limit_per_minute: int = 20
    export_rate_limit_per_minute: int = 6
    free_generation_jobs_per_project: int = 20
    free_export_bundles_per_project: int = 10

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
        database_driver = self.database_url.strip().split(":", 1)[0].lower()
        database_scheme = database_driver.split("+", 1)[0]
        if not self.debug and database_scheme == "sqlite":
            raise ValueError(
                "BREAKGEN_DATABASE_URL must use a production database when BREAKGEN_DEBUG=false"
            )
        if not self.debug and database_scheme in {"postgres", "postgresql"} and database_driver != "postgresql+asyncpg":
            raise ValueError(
                "BREAKGEN_DATABASE_URL must use postgresql+asyncpg:// when BREAKGEN_DEBUG=false"
            )
        google_fields = [
            self.google_oauth_client_id,
            self.google_oauth_client_secret,
        ]
        if any(google_fields) and not all(google_fields):
            raise ValueError(
                "BREAKGEN_GOOGLE_OAUTH_CLIENT_ID and BREAKGEN_GOOGLE_OAUTH_CLIENT_SECRET must be set together"
            )
        apple_fields = [
            self.apple_oauth_client_id,
            self.apple_oauth_team_id,
            self.apple_oauth_key_id,
            self.apple_oauth_private_key,
        ]
        if any(apple_fields) and not all(apple_fields):
            raise ValueError(
                "BREAKGEN_APPLE_OAUTH_CLIENT_ID, BREAKGEN_APPLE_OAUTH_TEAM_ID, BREAKGEN_APPLE_OAUTH_KEY_ID, and BREAKGEN_APPLE_OAUTH_PRIVATE_KEY must be set together"
            )
        if self.launch_lead_rate_limit_per_minute < 1:
            raise ValueError("BREAKGEN_LAUNCH_LEAD_RATE_LIMIT_PER_MINUTE must be at least 1")
        if self.launch_lead_note_max_length < 1:
            raise ValueError("BREAKGEN_LAUNCH_LEAD_NOTE_MAX_LENGTH must be at least 1")
        if self.auth_rate_limit_per_minute < 1:
            raise ValueError("BREAKGEN_AUTH_RATE_LIMIT_PER_MINUTE must be at least 1")
        if self.generation_rate_limit_per_minute < 1:
            raise ValueError("BREAKGEN_GENERATION_RATE_LIMIT_PER_MINUTE must be at least 1")
        if self.compile_rate_limit_per_minute < 1:
            raise ValueError("BREAKGEN_COMPILE_RATE_LIMIT_PER_MINUTE must be at least 1")
        if self.validation_rate_limit_per_minute < 1:
            raise ValueError("BREAKGEN_VALIDATION_RATE_LIMIT_PER_MINUTE must be at least 1")
        if self.export_rate_limit_per_minute < 1:
            raise ValueError("BREAKGEN_EXPORT_RATE_LIMIT_PER_MINUTE must be at least 1")
        if self.free_generation_jobs_per_project < 1:
            raise ValueError("BREAKGEN_FREE_GENERATION_JOBS_PER_PROJECT must be at least 1")
        if self.free_export_bundles_per_project < 1:
            raise ValueError("BREAKGEN_FREE_EXPORT_BUNDLES_PER_PROJECT must be at least 1")
        storage_backend = self.artifact_storage_backend.strip().lower()
        if storage_backend != "local":
            if storage_backend == "r2":
                raise ValueError(
                    "BREAKGEN_ARTIFACT_STORAGE_BACKEND=r2 is planned but not active until object upload/download transport is implemented"
                )
            raise ValueError("BREAKGEN_ARTIFACT_STORAGE_BACKEND must be local")
        return self


settings = Settings()

# Ensure artifact directory exists
Path(settings.artifacts_dir).mkdir(parents=True, exist_ok=True)
