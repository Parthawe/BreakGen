"""Tests for artifact and job registries."""

from __future__ import annotations

import zipfile
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.config import settings
from server.db.models import Base, ProjectArtifactRow, ProjectJobRow
from server.export.bundler import create_export_bundle
from server.models.project import KeySpec, KeyboardProject, LayoutSpec, ProductDomain, ProductFamily
from server.models.validation_schema import CheckStatus, ValidationCheck, ValidationReport
from server.services.artifact_registry import (
    record_export_bundle,
    record_mechanical_panel_compile,
    record_mechanical_shell_compile,
    record_validation_report,
)
from server.services.job_registry import create_project_job, update_job_by_external_ref


async def _make_session(tmp_path: Path):
    db_path = tmp_path / "registry.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, session_factory


def _project_with_keys() -> KeyboardProject:
    return KeyboardProject(
        project_id="registry_test",
        name="Registry Test",
        layout=LayoutSpec(
            keys=[
                KeySpec(id="k1", label="A", x_u=0, y_u=0),
                KeySpec(id="k2", label="B", x_u=1, y_u=0),
            ]
        ),
    )


def _project_with_id(project_id: str) -> KeyboardProject:
    project = _project_with_keys()
    project.project_id = project_id
    return project


def _handheld_project() -> KeyboardProject:
    project = _project_with_keys()
    project.project_id = "handheld_registry"
    project.product_domain = ProductDomain.HANDHELD
    project.product_family = ProductFamily.HANDHELD_COMPANION
    return project


@pytest.mark.anyio
async def test_record_validation_report_writes_file_and_row(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            report = ValidationReport(
                report_id="vr_registry",
                project_id="p_registry",
                revision=3,
                status=CheckStatus.WARN,
                created_at=datetime.now(timezone.utc),
                checks=[
                    ValidationCheck(
                        id="warn_test",
                        category="geometry",
                        status=CheckStatus.WARN,
                        details="warning",
                    )
                ],
            )

            row = record_validation_report(db, report=report, base_dir=tmp_path)
            await db.commit()

            stored = (
                await db.execute(
                    select(ProjectArtifactRow).where(
                        ProjectArtifactRow.artifact_id == report.report_id
                    )
                )
            ).scalar_one()
            expected_path = tmp_path / "projects" / "p_registry" / "validation" / "vr_registry.json"

            assert row.artifact_id == report.report_id
            assert expected_path.exists()
            assert stored.kind == "validation_report"
            assert stored.sha256 is not None and len(stored.sha256) == 64
            assert stored.details["status"] == "warn"
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_record_export_bundle_registers_bundle(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    bundle_path = tmp_path / "bundle_test.zip"
    with zipfile.ZipFile(bundle_path, "w") as zf:
        zf.writestr("demo.txt", "hello")

    try:
        async with session_factory() as db:
            row = record_export_bundle(
                db,
                project_id="p_export",
                revision=4,
                bundle_id="bundle_registry",
                zip_path=bundle_path,
                validation_report_id="vr_registry",
            )
            await db.commit()

            stored = (
                await db.execute(
                    select(ProjectArtifactRow).where(
                        ProjectArtifactRow.artifact_id == "bundle_registry"
                    )
                )
            ).scalar_one()

            assert row.kind == "export_bundle"
            assert stored.path == str(bundle_path)
            assert stored.details["validation_report_id"] == "vr_registry"
            assert stored.sha256 is not None and len(stored.sha256) == 64
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_project_jobs_can_be_created_and_updated(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            job = create_project_job(
                db,
                project_id="p_job",
                revision=2,
                job_type="keycap_generation",
                status="submitted",
                provider="meshy",
                external_ref="task_123",
                input_data={"prompt": "industrial"},
            )
            await db.commit()

            await update_job_by_external_ref(
                db,
                project_id="p_job",
                external_ref="task_123",
                status="SUCCEEDED",
                output_data={"model_urls": {"glb": "https://example.com/model.glb"}},
            )
            await db.commit()

            stored = (
                await db.execute(
                    select(ProjectJobRow).where(ProjectJobRow.job_id == job.job_id)
                )
            ).scalar_one()

            assert stored.status == "succeeded"
            assert stored.completed_at is not None
            assert stored.output_data["model_urls"]["glb"].endswith("model.glb")
    finally:
        await engine.dispose()


def test_create_export_bundle_uses_artifact_store_by_default(tmp_path: Path, monkeypatch):
    project = _project_with_keys()
    monkeypatch.setattr(settings, "artifacts_dir", str(tmp_path))

    bundle_id, zip_path = create_export_bundle(project)

    assert bundle_id.startswith("bundle_")
    assert zip_path.exists()
    assert zip_path.parent == tmp_path / "projects" / project.project_id / "exports"


@pytest.mark.anyio
async def test_record_mechanical_panel_compile_persists_files_and_rows(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    panel_path = tmp_path / "panel.dxf"
    panel_path.write_text("0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n")
    try:
        async with session_factory() as db:
            rows = await record_mechanical_panel_compile(
                db,
                project=_project_with_keys(),
                summary_payload={
                    "project_id": "registry_test",
                    "revision": 1,
                    "status": "compiled",
                    "mechanical_kind": "panel",
                    "geometry_kind": "switch_plate",
                    "artifact_urls": {"panel_dxf": "/demo"},
                },
                panel_dxf_path=panel_path,
                source_spec_hash="spec_hash",
                base_dir=tmp_path,
            )
            await db.commit()

            assert len(rows) == 2
            stored = list(
                (
                    await db.execute(
                        select(ProjectArtifactRow).where(
                            ProjectArtifactRow.project_id == "registry_test"
                        )
                    )
                ).scalars()
            )
            stored_paths = {Path(row.path).name for row in stored}

            assert {row.kind for row in stored} == {
                "mechanical_panel_dxf",
                "mechanical_panel_summary",
            }
            assert "panel.dxf" in stored_paths
            assert any(row.details["source_spec_hash"] == "spec_hash" for row in stored)
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_mechanical_artifact_ids_are_project_scoped(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    panel_path = tmp_path / "panel.dxf"
    panel_path.write_text("0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n")
    try:
        async with session_factory() as db:
            for project_id in ("registry_alpha", "registry_beta"):
                rows = await record_mechanical_panel_compile(
                    db,
                    project=_project_with_id(project_id),
                    summary_payload={
                        "project_id": project_id,
                        "revision": 1,
                        "status": "compiled",
                        "mechanical_kind": "panel",
                        "geometry_kind": "switch_plate",
                        "artifact_urls": {"panel_dxf": "/demo"},
                    },
                    panel_dxf_path=panel_path,
                    source_spec_hash=f"{project_id}_hash",
                    base_dir=tmp_path,
                )
                assert len(rows) == 2
            await db.commit()

            stored = list(
                (
                    await db.execute(
                        select(ProjectArtifactRow).where(
                            ProjectArtifactRow.kind == "mechanical_panel_dxf"
                        )
                    )
                ).scalars()
            )

            assert {row.project_id for row in stored} == {"registry_alpha", "registry_beta"}
            assert len({row.artifact_id for row in stored}) == 2
            assert all(row.artifact_id.endswith("_mech_panel_dxf_r1") for row in stored)
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_record_mechanical_shell_compile_persists_files_and_rows(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    front_path = tmp_path / "front_shell_panel.dxf"
    back_path = tmp_path / "back_shell_reference.dxf"
    spec_path = tmp_path / "shell_spec.json"
    front_path.write_text("front")
    back_path.write_text("back")
    spec_path.write_text("{}")
    try:
        async with session_factory() as db:
            rows = await record_mechanical_shell_compile(
                db,
                project=_handheld_project(),
                summary_payload={
                    "project_id": "handheld_registry",
                    "revision": 1,
                    "status": "compiled",
                    "mechanical_kind": "shell",
                    "shell_kind": "two_piece_handheld_proof",
                    "artifact_urls": {"shell_spec_json": "/demo"},
                },
                front_panel_path=front_path,
                back_reference_path=back_path,
                shell_spec_path=spec_path,
                source_spec_hash="shell_hash",
                base_dir=tmp_path,
            )
            await db.commit()

            assert len(rows) == 3
            stored = list(
                (
                    await db.execute(
                        select(ProjectArtifactRow).where(
                            ProjectArtifactRow.project_id == "handheld_registry"
                        )
                    )
                ).scalars()
            )
            assert {row.kind for row in stored} == {
                "mechanical_front_shell_dxf",
                "mechanical_back_shell_dxf",
                "mechanical_shell_spec",
            }
            assert any(row.details["source_spec_hash"] == "shell_hash" for row in stored)
    finally:
        await engine.dispose()
