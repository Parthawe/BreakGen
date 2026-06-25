"""Tests for export bundling and export endpoint semantics."""

import json
import zipfile
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.api.export import export_bundle
from server.db.models import Base, ProjectArtifactRow, ProjectRow
from server.export.bundler import build_export_preview, create_export_bundle
from server.models.project import KeyboardProject, LayoutSpec
from server.models.validation_schema import CheckStatus
from server.services.project_state import create_project_record
from server.validation.engine import validate_project


TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def _project_65() -> KeyboardProject:
    with open(TEMPLATES_DIR / "65_percent.json") as f:
        data = json.load(f)
    project = KeyboardProject(
        project_id="export_test",
        name="Export Test",
        layout=LayoutSpec(**data["layout"]),
    )
    project.switch_profile.part_id = "cherry_mx_red"
    return project


def _project_handheld() -> KeyboardProject:
    with open(TEMPLATES_DIR / "handheld_companion_compact.json") as f:
        data = json.load(f)
    project = KeyboardProject(
        project_id="handheld_export_test",
        name="Handheld Export Test",
        product_family="handheld_companion",
        product_domain="handheld",
        layout=LayoutSpec(**data["layout"]),
    )
    return project


async def _make_session(tmp_path: Path):
    db_path = tmp_path / "export.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, session_factory


def test_bundle_creates_zip():
    project = _project_65()
    bundle_id, zip_path = create_export_bundle(project)
    assert bundle_id.startswith("bundle_")
    assert Path(zip_path).exists()
    assert Path(zip_path).stat().st_size > 0


def test_bundle_contains_expected_files():
    project = _project_65()
    _, zip_path = create_export_bundle(project)
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
    expected = [
        "BreakGen_Export/plate/plate.dxf",
        "BreakGen_Export/firmware/info.json",
        "BreakGen_Export/firmware/keymap.json",
        "BreakGen_Export/firmware/via.json",
        "BreakGen_Export/firmware/control-map.json",
        "BreakGen_Export/manifest.json",
        "BreakGen_Export/validation_report.json",
        "BreakGen_Export/BUILD_GUIDE.md",
        "BreakGen_Export/BOM.md",
        "BreakGen_Export/bom.json",
    ]
    for file_name in expected:
        assert file_name in names, f"Missing: {file_name}"


def test_manifest_has_artifact_hashes_and_readiness():
    project = _project_65()
    _, zip_path = create_export_bundle(project)
    with zipfile.ZipFile(zip_path) as zf:
        manifest = json.loads(zf.read("BreakGen_Export/manifest.json"))
    assert manifest["project_id"] == "export_test"
    assert manifest["revision"] == 1
    assert manifest["validation_status"] == "pass"
    assert manifest["export_readiness"] == "review_ready"
    assert len(manifest["artifacts"]) >= 5
    for artifact in manifest["artifacts"]:
        assert "sha256" in artifact
        assert len(artifact["sha256"]) == 64


def test_bundle_uses_supplied_validation_report():
    project = _project_65()
    report = validate_project(project)
    bundle_id, zip_path = create_export_bundle(
        project,
        validation_report=report,
        export_readiness="candidate",
    )
    assert bundle_id.startswith("bundle_")
    with zipfile.ZipFile(zip_path) as zf:
        manifest = json.loads(zf.read("BreakGen_Export/manifest.json"))
        bundled_report = json.loads(zf.read("BreakGen_Export/validation_report.json"))
        guide = zf.read("BreakGen_Export/BUILD_GUIDE.md").decode()
        bom = json.loads(zf.read("BreakGen_Export/bom.json"))
        bom_markdown = zf.read("BreakGen_Export/BOM.md").decode()
    assert manifest["validation_report_id"] == report.report_id
    assert manifest["validation_status"] == report.status.value
    assert manifest["export_readiness"] == "candidate"
    assert bundled_report["report_id"] == report.report_id
    assert "candidate" in guide
    assert "supplier-ready PCB BOM" in guide
    assert bom["status"] == "review_bom"
    assert bom["items"]
    assert "review-grade bill of materials" in bom_markdown


def test_export_preview_describes_bundle_and_bom_without_writing_files():
    project = _project_65()
    preview = build_export_preview(project)

    assert preview["project_id"] == project.project_id
    assert preview["revision"] == project.revision
    assert preview["validation_status"] == "pass"
    assert preview["export_readiness"] == "review_ready"
    assert any(item["path"] == "BUILD_GUIDE.md" for item in preview["included_files"])
    assert any(item["path"] == "BOM.md" for item in preview["included_files"])
    assert preview["bom"]["status"] == "review_bom"
    assert preview["bom"]["items"]
    assert "Supplier-ready BOM" in " ".join(preview["missing_outputs"])
    assert "Build Guide" in preview["build_guide_markdown"]


def test_handheld_bundle_contains_shell_artifacts():
    project = _project_handheld()
    _, zip_path = create_export_bundle(project, export_readiness="candidate")
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        guide = zf.read("BreakGen_Export/BUILD_GUIDE.md").decode()
    expected = [
        "BreakGen_Export/shell/front_shell_panel.dxf",
        "BreakGen_Export/shell/back_shell_reference.dxf",
        "BreakGen_Export/shell/shell_spec.json",
        "BreakGen_Export/firmware/control-map.json",
        "BreakGen_Export/manifest.json",
    ]
    for file_name in expected:
        assert file_name in names, f"Missing: {file_name}"
    assert "deterministic enclosure baseline" in guide


@pytest.mark.anyio
async def test_export_with_warnings_stays_validated_and_records_candidate_bundle(tmp_path: Path, monkeypatch):
    engine, session_factory = await _make_session(tmp_path)
    monkeypatch.setattr("server.services.artifact_registry.settings.artifacts_dir", str(tmp_path))
    monkeypatch.setattr("server.export.bundler.settings.artifacts_dir", str(tmp_path))

    try:
        async with session_factory() as db:
            project = _project_65()
            project.switch_profile.part_id = None
            await create_project_record(db, project, change_summary="Project created")

            response = await export_bundle(project.project_id, db)
            row = (
                await db.execute(
                    select(ProjectRow).where(ProjectRow.project_id == project.project_id)
                )
            ).scalar_one()
            artifact = (
                await db.execute(
                    select(ProjectArtifactRow).where(
                        ProjectArtifactRow.project_id == project.project_id,
                        ProjectArtifactRow.kind == "export_bundle",
                    )
                )
            ).scalar_one()

            assert response.headers["X-Validation-Status"] == CheckStatus.WARN.value
            assert response.headers["X-Export-Readiness"] == "candidate"
            assert row.status == "validated"
            assert row.data["exports"]["bundle_id"]
            assert artifact.details["acceptance_state"] == "candidate"
            assert artifact.details["validation_status"] == CheckStatus.WARN.value
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_review_ready_export_stays_validated_until_fabrication_outputs_exist(tmp_path: Path, monkeypatch):
    engine, session_factory = await _make_session(tmp_path)
    monkeypatch.setattr("server.services.artifact_registry.settings.artifacts_dir", str(tmp_path))
    monkeypatch.setattr("server.export.bundler.settings.artifacts_dir", str(tmp_path))

    try:
        async with session_factory() as db:
            project = _project_65()
            await create_project_record(db, project, change_summary="Project created")

            response = await export_bundle(project.project_id, db)
            row = (
                await db.execute(
                    select(ProjectRow).where(ProjectRow.project_id == project.project_id)
                )
            ).scalar_one()
            artifact = (
                await db.execute(
                    select(ProjectArtifactRow).where(
                        ProjectArtifactRow.project_id == project.project_id,
                        ProjectArtifactRow.kind == "export_bundle",
                    )
                )
            ).scalar_one()

            assert response.headers["X-Validation-Status"] == CheckStatus.PASS.value
            assert response.headers["X-Export-Readiness"] == "review_ready"
            assert row.status == "validated"
            assert artifact.details["acceptance_state"] == "review_ready"
    finally:
        await engine.dispose()
