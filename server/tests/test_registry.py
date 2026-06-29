"""Tests for artifact and job registries."""

from __future__ import annotations

import io
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
from server.services.artifact_storage import (
    artifact_exists,
    artifact_storage_metadata,
    delete_project_artifacts,
    iter_artifact_bytes,
    read_artifact_bytes,
    store_artifact_file,
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
            assert stored.details["storage_backend"] == "local"
            assert stored.details["storage_location"] == "local_path"
            assert stored.sha256 is not None and len(stored.sha256) == 64
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_record_export_bundle_uploads_to_r2_and_records_object_key(tmp_path: Path, monkeypatch):
    engine, session_factory = await _make_session(tmp_path)
    bundle_path = tmp_path / "projects" / "p_export_r2" / "exports" / "bundle_test.zip"
    bundle_path.parent.mkdir(parents=True)
    with zipfile.ZipFile(bundle_path, "w") as zf:
        zf.writestr("demo.txt", "hello")
    fake_client = _FakeS3Client()
    monkeypatch.setattr("server.services.artifact_storage.settings.artifacts_dir", str(tmp_path))
    monkeypatch.setattr("server.services.artifact_storage.settings.artifact_storage_backend", "r2")
    monkeypatch.setattr("server.services.artifact_storage.settings.r2_endpoint_url", "https://r2.example")
    monkeypatch.setattr("server.services.artifact_storage.settings.r2_bucket", "breakgen")
    monkeypatch.setattr("server.services.artifact_storage.settings.r2_access_key_id", "key")
    monkeypatch.setattr("server.services.artifact_storage.settings.r2_secret_access_key", "secret")
    monkeypatch.setattr("server.services.artifact_storage._s3_client", lambda: fake_client)

    try:
        async with session_factory() as db:
            record_export_bundle(
                db,
                project_id="p_export_r2",
                revision=4,
                bundle_id="bundle_registry_r2",
                zip_path=bundle_path,
                validation_report_id="vr_registry",
            )
            await db.commit()

            stored = (
                await db.execute(
                    select(ProjectArtifactRow).where(
                        ProjectArtifactRow.artifact_id == "bundle_registry_r2"
                    )
                )
            ).scalar_one()

            assert stored.path == "projects/p_export_r2/exports/bundle_test.zip"
            assert stored.details["storage_backend"] == "r2"
            assert stored.details["storage_location"] == "object_key"
            assert stored.details["bucket"] == "breakgen"
            assert fake_client.objects[("breakgen", stored.path)].startswith(b"PK")
    finally:
        await engine.dispose()


def test_artifact_storage_metadata_redacts_to_storage_key(tmp_path: Path, monkeypatch):
    artifact_path = tmp_path / "projects" / "p1" / "exports" / "bundle.zip"
    artifact_path.parent.mkdir(parents=True)
    artifact_path.write_text("bundle")
    monkeypatch.setattr("server.services.artifact_storage.settings.artifacts_dir", str(tmp_path))
    monkeypatch.setattr("server.services.artifact_storage.settings.artifact_storage_backend", "local")

    metadata = artifact_storage_metadata(artifact_path)

    assert metadata == {
        "storage_backend": "local",
        "storage_location": "local_path",
        "storage_key": "projects/p1/exports/bundle.zip",
    }


class _FakePaginator:
    def __init__(self, fake_client):
        self.fake_client = fake_client

    def paginate(self, *, Bucket: str, Prefix: str):
        keys = [
            {"Key": key}
            for (bucket, key) in self.fake_client.objects
            if bucket == Bucket and key.startswith(Prefix)
        ]
        return [{"Contents": keys}]


class _FakeS3Client:
    def __init__(self):
        self.objects: dict[tuple[str, str], bytes] = {}
        self.content_types: dict[tuple[str, str], str] = {}

    def upload_file(self, filename: str, bucket: str, key: str, ExtraArgs=None):
        self.objects[(bucket, key)] = Path(filename).read_bytes()
        if ExtraArgs and ExtraArgs.get("ContentType"):
            self.content_types[(bucket, key)] = ExtraArgs["ContentType"]

    def head_object(self, *, Bucket: str, Key: str):
        if (Bucket, Key) not in self.objects:
            raise KeyError(Key)
        return {"ContentLength": len(self.objects[(Bucket, Key)])}

    def get_object(self, *, Bucket: str, Key: str):
        if (Bucket, Key) not in self.objects:
            raise KeyError(Key)
        return {"Body": _FakeStreamingBody(self.objects[(Bucket, Key)])}

    def get_paginator(self, name: str):
        assert name == "list_objects_v2"
        return _FakePaginator(self)

    def delete_objects(self, *, Bucket: str, Delete: dict):
        for item in Delete["Objects"]:
            self.objects.pop((Bucket, item["Key"]), None)


class _FakeStreamingBody(io.BytesIO):
    def iter_chunks(self, chunk_size: int):
        while True:
            chunk = self.read(chunk_size)
            if not chunk:
                break
            yield chunk


def test_r2_storage_upload_read_metadata_and_delete(tmp_path: Path, monkeypatch):
    source = tmp_path / "projects" / "p_r2" / "exports" / "bundle.zip"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"zip-bytes")
    fake_client = _FakeS3Client()
    monkeypatch.setattr("server.services.artifact_storage.settings.artifacts_dir", str(tmp_path))
    monkeypatch.setattr("server.services.artifact_storage.settings.artifact_storage_backend", "r2")
    monkeypatch.setattr("server.services.artifact_storage.settings.r2_endpoint_url", "https://r2.example")
    monkeypatch.setattr("server.services.artifact_storage.settings.r2_bucket", "breakgen")
    monkeypatch.setattr("server.services.artifact_storage.settings.r2_access_key_id", "key")
    monkeypatch.setattr("server.services.artifact_storage.settings.r2_secret_access_key", "secret")
    monkeypatch.setattr("server.services.artifact_storage._s3_client", lambda: fake_client)

    stored = store_artifact_file(source, project_id="p_r2", content_type="application/zip")

    assert stored.path == "projects/p_r2/exports/bundle.zip"
    assert fake_client.objects[("breakgen", stored.path)] == b"zip-bytes"
    assert fake_client.content_types[("breakgen", stored.path)] == "application/zip"
    assert artifact_exists(stored.path)
    assert read_artifact_bytes(stored.path) == b"zip-bytes"
    assert b"".join(iter_artifact_bytes(stored.path, chunk_size=3)) == b"zip-bytes"
    assert artifact_storage_metadata(stored.path) == {
        "storage_backend": "r2",
        "storage_location": "object_key",
        "storage_key": "projects/p_r2/exports/bundle.zip",
        "bucket": "breakgen",
    }

    delete_project_artifacts("p_r2")

    assert not artifact_exists(stored.path)


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
            assert all("_mech_panel_dxf_r1_default" in row.artifact_id for row in stored)
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
