"""Tests for the private-alpha operator snapshot script."""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.db.models import (
    Base,
    LaunchLeadRow,
    ProjectArtifactRow,
    ProjectJobRow,
    ProjectRow,
    ProjectUsageEventRow,
    UserRow,
)
from server.scripts.operator_snapshot import build_operator_snapshot


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_operator_snapshot_masks_lead_emails_and_groups_counts(tmp_path: Path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'ops.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with session_factory() as db:
            db.add(UserRow(email="founder@example.com", password_hash="hash"))
            db.add(
                ProjectRow(
                    project_id="p1",
                    user_id=1,
                    product_family="streamdeck",
                    name="Demo",
                    status="validated",
                    data={"project_id": "p1"},
                )
            )
            db.add(
                ProjectArtifactRow(
                    artifact_id="a1",
                    project_id="p1",
                    revision=2,
                    kind="export_bundle",
                    path="/tmp/bundle.zip",
                    details={},
                )
            )
            db.add(
                ProjectJobRow(
                    job_id="j1",
                    project_id="p1",
                    revision=2,
                    job_type="keycap_generation",
                    status="succeeded",
                    input_data={},
                    output_data={},
                )
            )
            db.add(
                ProjectUsageEventRow(
                    user_id=1,
                    project_id="p1",
                    revision=2,
                    event_type="export_bundle_created",
                    quantity=1,
                    event_metadata={},
                )
            )
            db.add(
                LaunchLeadRow(
                    email="maker@example.com",
                    role="Maker",
                    intent="private_alpha",
                    surface="landing",
                    path="/",
                    source={"utm_source": "discord"},
                )
            )
            await db.commit()

        async with session_factory() as db:
            snapshot = await build_operator_snapshot(db)

        assert snapshot["totals"]["users"] == 1
        assert snapshot["totals"]["launch_leads"] == 1
        assert snapshot["launch_leads_by_intent"] == [{"intent": "private_alpha", "count": 1}]
        assert snapshot["projects_by_family_status"] == [
            {"product_family": "streamdeck", "status": "validated", "count": 1}
        ]
        assert snapshot["recent_leads"][0]["email"] == "ma***r@example.com"
        assert snapshot["recent_leads"][0]["utm_source"] == "discord"
    finally:
        await engine.dispose()
