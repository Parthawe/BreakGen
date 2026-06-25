"""Tests for the handheld shell proof compiler."""

import json
from pathlib import Path

from server.geometry.handheld_shell_generator import (
    HandheldShellConfig,
    compile_handheld_shell_spec,
    generate_handheld_shell_artifacts,
)
from server.models.project import LayoutSpec


TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def _load_layout(template_id: str) -> LayoutSpec:
    with open(TEMPLATES_DIR / f"{template_id}.json") as f:
        data = json.load(f)
    return LayoutSpec(**data["layout"])


def test_handheld_shell_spec_contains_core_features():
    layout = _load_layout("handheld_companion_compact")
    spec = compile_handheld_shell_spec(layout, HandheldShellConfig())

    assert spec["shell_kind"] == "two_piece_handheld_proof"
    assert spec["outer_shell"]["width_mm"] > 0
    assert spec["outer_shell"]["height_mm"] > 0
    assert len(spec["front_features"]) >= 6
    assert len(spec["rear_features"]) >= 2
    assert len(spec["side_ports"]) == 1
    assert spec["control_summary"]["display"] == 1
    assert spec["control_summary"]["battery"] == 1
    assert spec["control_summary"]["speaker"] == 1
    assert spec["control_summary"]["microphone"] == 1
    assert spec["control_summary"]["usb_port"] == 1
    assert any(feature["role"] == "microphone_port" for feature in spec["front_features"])


def test_handheld_shell_artifacts_write_expected_files(tmp_path: Path):
    layout = _load_layout("handheld_companion_compact")
    result = generate_handheld_shell_artifacts(layout, tmp_path)

    assert Path(result["front_panel_path"]).exists()
    assert Path(result["back_reference_path"]).exists()
    assert Path(result["spec_path"]).exists()
    assert Path(result["front_panel_path"]).stat().st_size > 0
    assert Path(result["back_reference_path"]).stat().st_size > 0
