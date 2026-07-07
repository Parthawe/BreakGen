"""Tests for usage metering helpers."""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.db.models import Base
from server.services.usage_registry import record_usage_event, record_usage_event_once, usage_total


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


@pytest.mark.anyio
async def test_record_usage_event_once_dedupes_project_revision_transition(tmp_path: Path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'usage_once.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with session_factory() as db:
            first = await record_usage_event_once(
                db,
                event_type="export_created",
                user_id=1,
                project_id="project_1",
                revision=2,
            )
            second = await record_usage_event_once(
                db,
                event_type="export_created",
                user_id=1,
                project_id="project_1",
                revision=2,
            )
            await db.commit()

            assert first is not None
            assert second is None
            total = await usage_total(
                db,
                event_type="export_created",
                user_id=1,
                project_id="project_1",
            )
            assert total == 1
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_record_usage_event_once_can_dedupe_across_revisions(tmp_path: Path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'usage_activation.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with session_factory() as db:
            first = await record_usage_event_once(
                db,
                event_type="first_validation_passed",
                user_id=1,
                project_id="project_1",
                revision=2,
                dedupe_revision=False,
            )
            second = await record_usage_event_once(
                db,
                event_type="first_validation_passed",
                user_id=1,
                project_id="project_1",
                revision=3,
                dedupe_revision=False,
            )
            await db.commit()

            assert first is not None
            assert first.revision == 2
            assert second is None
            total = await usage_total(
                db,
                event_type="first_validation_passed",
                user_id=1,
                project_id="project_1",
            )
            assert total == 1
    finally:
        await engine.dispose()
