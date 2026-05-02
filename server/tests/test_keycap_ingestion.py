"""Tests for completed keycap generation ingestion."""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.ai.providers.base import ProviderPollResponse
from server.ai.providers.registry import provider_registry
from server.api.generation import get_generation_status
from server.db.models import Base, ProjectArtifactRow, ProjectJobRow, ProjectRow
from server.models.platform import GenerationProviderManifest
from server.models.project import KeyboardProject, ProjectStatus
from server.services.job_registry import create_project_job
from server.services.project_state import create_project_record


async def _make_session(tmp_path: Path):
    db_path = tmp_path / "keycap-ingestion.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, session_factory


class _FakeMeshyProvider:
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
            status="SUCCEEDED",
            progress=100,
            output_data={
                "status": "SUCCEEDED",
                "progress": 100,
                "model_urls": {"glb": f"https://example.com/{external_ref}.glb"},
            },
        )

    async def cancel_keycap_generation(self, external_ref: str) -> None:
        return None

    async def download_model(self, model_url: str, output_path: str) -> str:
        Path(output_path).write_bytes(b"fake-glb")
        return output_path


class _FakeNormalizationResult:
    success = True
    face_count_original = 1234
    face_count_preview = 321
    is_watertight = True
    bounding_box_mm = (18.0, 8.0, 18.0)
    errors = None

    def __init__(self, preview_path: Path, export_path: Path):
        self.preview_path = str(preview_path)
        self.export_path = str(export_path)


def _fake_normalize_mesh(input_path, output_dir, asset_id, unit_width=1.0):
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    preview_path = out_dir / f"{asset_id}_preview.glb"
    export_path = out_dir / f"{asset_id}_export.stl"
    preview_path.write_bytes(b"preview")
    export_path.write_bytes(b"export")
    return _FakeNormalizationResult(preview_path, export_path)


@pytest.mark.anyio
async def test_generation_status_ingests_completed_asset_once(tmp_path: Path, monkeypatch):
    engine, session_factory = await _make_session(tmp_path)
    monkeypatch.setitem(provider_registry._providers, "meshy", _FakeMeshyProvider())
    monkeypatch.setattr("server.services.keycap_ingestion.normalize_mesh", _fake_normalize_mesh)
    monkeypatch.setattr("server.services.artifact_registry.settings.artifacts_dir", str(tmp_path))

    try:
        async with session_factory() as db:
            project = KeyboardProject(project_id="bg_ingest_test", status=ProjectStatus.GENERATING)
            await create_project_record(db, project, change_summary="Project created")
            create_project_job(
                db,
                project_id=project.project_id,
                revision=1,
                job_type="keycap_generation",
                status="submitted",
                provider="meshy",
                external_ref="task_ingest",
                input_data={"prompt": "industrial sculpted"},
            )
            await db.commit()

            response1 = await get_generation_status(project.project_id, "task_ingest", db)
            response2 = await get_generation_status(project.project_id, "task_ingest", db)

            row = (
                await db.execute(
                    select(ProjectRow).where(ProjectRow.project_id == project.project_id)
                )
            ).scalar_one()
            artifacts = (
                await db.execute(
                    select(ProjectArtifactRow).where(
                        ProjectArtifactRow.project_id == project.project_id
                    )
                )
            ).scalars().all()
            job = (
                await db.execute(
                    select(ProjectJobRow).where(
                        ProjectJobRow.project_id == project.project_id,
                        ProjectJobRow.external_ref == "task_ingest",
                    )
                )
            ).scalar_one()

            assert response1["status"] == "SUCCEEDED"
            assert response1["asset"]["asset_id"] == "meshy_task_ingest"
            assert response1["asset"]["acceptance_state"] == "candidate"
            assert response2["asset"]["asset_id"] == "meshy_task_ingest"
            assert row.revision == 1
            assert row.status == ProjectStatus.PREVIEWABLE.value
            assert len(row.data["keycap_assets"]) == 1
            assert row.data["keycap_assets"][0]["acceptance_state"] == "candidate"
            assert len(artifacts) == 3
            assert {artifact.details.get("acceptance_state") for artifact in artifacts} == {"candidate"}
            assert job.status == "succeeded"
            assert job.output_data["asset_id"] == "meshy_task_ingest"
    finally:
        await engine.dispose()
