"""Tests for the export bundler."""

import json
import zipfile
from pathlib import Path

from server.export.bundler import create_export_bundle
from server.models.project import KeyboardProject, LayoutSpec


TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def _project_65() -> KeyboardProject:
    with open(TEMPLATES_DIR / "65_percent.json") as f:
        data = json.load(f)
    p = KeyboardProject(
        project_id="export_test",
        name="Export Test",
        layout=LayoutSpec(**data["layout"]),
    )
    p.switch_profile.part_id = "cherry_mx_red"
    return p


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
        "BreakGen_Export/manifest.json",
        "BreakGen_Export/validation_report.json",
        "BreakGen_Export/BUILD_GUIDE.md",
    ]
    for f in expected:
        assert f in names, f"Missing: {f}"


def test_manifest_has_artifact_hashes():
    project = _project_65()
    _, zip_path = create_export_bundle(project)
    with zipfile.ZipFile(zip_path) as zf:
        manifest = json.loads(zf.read("BreakGen_Export/manifest.json"))
    assert manifest["project_id"] == "export_test"
    assert manifest["revision"] == 1
    assert len(manifest["artifacts"]) >= 5
    for artifact in manifest["artifacts"]:
        assert "sha256" in artifact
        assert len(artifact["sha256"]) == 64  # SHA-256 hex length


def test_validation_report_in_bundle():
    project = _project_65()
    _, zip_path = create_export_bundle(project)
    with zipfile.ZipFile(zip_path) as zf:
        report = json.loads(zf.read("BreakGen_Export/validation_report.json"))
    assert "checks" in report
    assert report["project_id"] == "export_test"


def test_build_guide_contains_project_name():
    project = _project_65()
    _, zip_path = create_export_bundle(project)
    with zipfile.ZipFile(zip_path) as zf:
        guide = zf.read("BreakGen_Export/BUILD_GUIDE.md").decode()
    assert "Export Test" in guide
    assert "cherry_mx_red" in guide
