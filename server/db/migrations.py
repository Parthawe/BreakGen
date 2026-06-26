"""Database migration checks used by server startup and deployment scripts."""

from __future__ import annotations

from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine

from server.config import SERVER_DIR, settings

REPO_ROOT = SERVER_DIR.parent
ALEMBIC_INI_PATH = REPO_ROOT / "alembic.ini"
ALEMBIC_SCRIPT_LOCATION = SERVER_DIR / "alembic"


def alembic_config() -> Config:
    """Build an Alembic config from repo paths and current settings."""
    config = Config(str(ALEMBIC_INI_PATH))
    config.set_main_option("script_location", str(ALEMBIC_SCRIPT_LOCATION))
    config.set_main_option("sqlalchemy.url", settings.database_url)
    return config


def migration_heads() -> set[str]:
    """Return the expected Alembic head revision ids."""
    return set(ScriptDirectory.from_config(alembic_config()).get_heads())


async def current_database_revisions(engine: AsyncEngine) -> set[str]:
    """Return revisions recorded in alembic_version, or an empty set if absent."""
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            return {str(row[0]) for row in result.fetchall()}
    except SQLAlchemyError:
        return set()


async def assert_database_migrated(engine: AsyncEngine) -> None:
    """Fail closed when a production database has not been migrated to head."""
    expected = migration_heads()
    actual = await current_database_revisions(engine)
    if actual != expected:
        raise RuntimeError(
            "Database schema is not at the Alembic head. "
            f"Expected {sorted(expected)}, found {sorted(actual)}. "
            "Run `cd server && uv run alembic -c ../alembic.ini upgrade head` before starting production."
        )


def migration_paths_exist() -> bool:
    """Return whether the repo contains the migration entrypoints."""
    return (
        Path(ALEMBIC_INI_PATH).exists()
        and Path(ALEMBIC_SCRIPT_LOCATION / "env.py").exists()
        and Path(ALEMBIC_SCRIPT_LOCATION / "versions").exists()
    )
