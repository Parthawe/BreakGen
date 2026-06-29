"""Tests for Alembic migration readiness."""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from server.db.migrations import (
    assert_database_migrated,
    current_database_revisions,
    migration_heads,
    migration_paths_exist,
)


@pytest.mark.anyio
async def test_unmigrated_database_is_not_production_ready(tmp_path: Path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'empty.db'}")
    try:
        with pytest.raises(RuntimeError, match="Alembic head"):
            await assert_database_migrated(engine)
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_database_revision_check_accepts_current_head(tmp_path: Path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'migrated.db'}")
    head = next(iter(migration_heads()))
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
            await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES (:head)"), {"head": head})

        assert await current_database_revisions(engine) == {head}
        await assert_database_migrated(engine)
    finally:
        await engine.dispose()


def test_migration_files_are_present():
    assert migration_paths_exist()
    assert migration_heads() == {"0002_add_foreign_keys"}
