"""Tests for usage metering helpers."""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.db.models import Base
from server.services.usage_registry import record_usage_event, usage_total


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_usage_total_counts_beyond_listing_limit(tmp_path: Path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'usage.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with session_factory() as db:
            for _ in range(525):
                record_usage_event(
                    db,
                    event_type="export_bundle",
                    user_id=1,
                    project_id="project_1",
                    quantity=1,
                )
            await db.commit()

            total = await usage_total(
                db,
                event_type="export_bundle",
                user_id=1,
                project_id="project_1",
            )
            assert total == 525
    finally:
        await engine.dispose()
