"""Tests for database-enforced integrity constraints."""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.db.database import enable_sqlite_foreign_keys
from server.db.models import (
    Base,
    ProjectArtifactRow,
    ProjectJobRow,
    ProjectRevisionRow,
    ProjectRow,
    ProjectUsageEventRow,
)


async def _make_session(tmp_path: Path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'constraints.db'}")
    enable_sqlite_foreign_keys(engine)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return engine, async_sessionmaker(engine, expire_on_commit=False)


@pytest.mark.anyio
async def test_project_owned_rows_cascade_when_project_is_deleted(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            project = ProjectRow(
                project_id="p_constraints",
                product_family="keyboard",
                name="Constraints",
                revision=1,
                status="draft",
                data={"project_id": "p_constraints"},
            )
            db.add(project)
            await db.flush()
            db.add(
                ProjectRevisionRow(
                    project_id=project.project_id,
                    revision=1,
                    data={"project_id": project.project_id},
                    change_summary="created",
                )
            )
            db.add(
                ProjectArtifactRow(
                    artifact_id="artifact_constraints",
                    project_id=project.project_id,
                    revision=1,
                    kind="validation_report",
                    path="projects/p_constraints/validation/report.json",
                    details={},
                )
            )
            db.add(
                ProjectJobRow(
                    job_id="job_constraints",
                    project_id=project.project_id,
                    revision=1,
                    job_type="generation",
                    status="submitted",
                    input_data={},
                    output_data={},
                )
            )
            db.add(
                ProjectUsageEventRow(
                    project_id=project.project_id,
                    revision=1,
                    event_type="artifact_download",
                    quantity=1,
                    unit="download",
                    source="test",
                    event_metadata={},
                )
            )
            await db.commit()

            await db.delete(project)
            await db.commit()

            for model in (
                ProjectRevisionRow,
                ProjectArtifactRow,
                ProjectJobRow,
                ProjectUsageEventRow,
            ):
                count = await db.scalar(select(func.count()).select_from(model))
                assert count == 0
    finally:
        await engine.dispose()
