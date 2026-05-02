"""Tests for generation status reconciliation."""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.ai.providers.base import ProviderPollResponse
from server.ai.providers.registry import provider_registry
from server.api.generation import get_generation_status
from server.db.models import Base, ProjectJobRow, ProjectRow
from server.models.platform import GenerationProviderManifest
from server.models.project import KeyboardProject, ProjectStatus
from server.services.job_registry import create_project_job
from server.services.project_state import create_project_record


async def _make_session(tmp_path: Path):
    db_path = tmp_path / "generation-status.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, session_factory


class _FailedMeshyProvider:
    provider_id = "meshy"

    def manifest(self) -> GenerationProviderManifest:
        return GenerationProviderManifest(
            id="meshy",
            display_name="Meshy",
            description="test provider",
            status="enabled",
            supported_asset_types=["keycap"],
            capabilities=["async_jobs"],
            default_for=["keycap"],
        )

    async def submit_keycap_generation(self, request):  # pragma: no cover - not used here
        raise NotImplementedError

    async def poll_keycap_generation(self, external_ref: str) -> ProviderPollResponse:
        return ProviderPollResponse(
            provider_id="meshy",
            status="FAILED",
            progress=100,
            output_data={
                "status": "FAILED",
                "progress": 100,
                "message": "provider error",
                "model_urls": {},
            },
        )

    async def cancel_keycap_generation(self, external_ref: str) -> None:
        return None

    async def download_model(self, model_url: str, output_path: str) -> str:
        return output_path


@pytest.mark.anyio
async def test_generation_status_failed_job_reconciles_project_status(tmp_path: Path, monkeypatch):
    engine, session_factory = await _make_session(tmp_path)
    monkeypatch.setitem(provider_registry._providers, "meshy", _FailedMeshyProvider())

    try:
        async with session_factory() as db:
            project = KeyboardProject(project_id="bg_status_test", status=ProjectStatus.GENERATING)
            await create_project_record(db, project, change_summary="Project created")
            create_project_job(
                db,
                project_id=project.project_id,
                revision=1,
                job_type="keycap_generation",
                status="submitted",
                provider="meshy",
                external_ref="task_failed",
            )
            await db.commit()

            response = await get_generation_status(project.project_id, "task_failed", db)

            row = (
                await db.execute(
                    select(ProjectRow).where(ProjectRow.project_id == project.project_id)
                )
            ).scalar_one()
            job = (
                await db.execute(
                    select(ProjectJobRow).where(
                        ProjectJobRow.project_id == project.project_id,
                        ProjectJobRow.external_ref == "task_failed",
                    )
                )
            ).scalar_one()

            assert response["status"] == "FAILED"
            assert response["project_status"] == ProjectStatus.CONFIGURED.value
            assert row.status == ProjectStatus.CONFIGURED.value
            assert job.status == "failed"
    finally:
        await engine.dispose()
