"""Tests for the canonical domain models."""

import json
from pathlib import Path

from server.models.project import (
    KeyboardProject,
    KeySpec,
    LayoutSpec,
    ProjectStatus,
    StabilizerType,
    SwitchFamily,
)
from server.models.supported_configs import SUPPORTED_SWITCHES, SUPPORTED_TEMPLATES
from server.models.validation_schema import CheckStatus, ValidationCheck, ValidationReport


TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def test_keyboard_project_defaults():
    p = KeyboardProject(project_id="test")
    assert p.revision == 1
    assert p.status == ProjectStatus.DRAFT
    assert p.layout.keys == []
    assert p.switch_profile.family == SwitchFamily.MX
    assert p.pcb.matrix_rows is None


def test_keyboard_project_roundtrip():
    p = KeyboardProject(project_id="test", name="My Board")
    data = p.model_dump(mode="json")
    p2 = KeyboardProject(**data)
    assert p2.project_id == "test"
    assert p2.name == "My Board"
    assert p2.revision == 1


def test_key_spec_defaults():
    k = KeySpec(id="k1", x_u=0, y_u=0)
    assert k.w_u == 1.0
    assert k.h_u == 1.0
    assert k.rotation_deg == 0.0
    assert k.stabilizer == StabilizerType.NONE
    assert k.row is None
    assert k.col is None


def test_template_key_counts_match():
    """Every template's actual key count must match SUPPORTED_TEMPLATES declaration."""
    for tmpl in SUPPORTED_TEMPLATES:
        path = TEMPLATES_DIR / f"{tmpl.template_id}.json"
        assert path.exists(), f"Missing template file: {path}"
        with open(path) as f:
            data = json.load(f)
        layout = LayoutSpec(**data["layout"])
        assert len(layout.keys) == tmpl.key_count, (
            f"{tmpl.template_id}: declared {tmpl.key_count}, actual {len(layout.keys)}"
        )


def test_template_no_duplicate_key_ids():
    """No template should have duplicate key IDs."""
    for tmpl in SUPPORTED_TEMPLATES:
        path = TEMPLATES_DIR / f"{tmpl.template_id}.json"
        with open(path) as f:
            data = json.load(f)
        ids = [k["id"] for k in data["layout"]["keys"]]
        assert len(ids) == len(set(ids)), f"{tmpl.template_id} has duplicate key IDs"


def test_template_wide_keys_have_stabilizers():
    """Keys >= 2u should have stabilizers assigned."""
    for tmpl in SUPPORTED_TEMPLATES:
        path = TEMPLATES_DIR / f"{tmpl.template_id}.json"
        with open(path) as f:
            data = json.load(f)
        layout = LayoutSpec(**data["layout"])
        for key in layout.keys:
            if key.w_u >= 2.0:
                assert key.stabilizer != StabilizerType.NONE, (
                    f"{tmpl.template_id}: key {key.id} ({key.w_u}u) missing stabilizer"
                )


def test_supported_switches_all_mx():
    """V1: all switches must be MX family."""
    for sw in SUPPORTED_SWITCHES:
        assert sw.family == SwitchFamily.MX, f"{sw.part_id} is not MX"


def test_validation_report_structure():
    report = ValidationReport(
        report_id="vr_test",
        project_id="p_test",
        revision=1,
        status=CheckStatus.PASS,
        checks=[
            ValidationCheck(id="test_check", category="geometry", status=CheckStatus.PASS, details="ok"),
        ],
    )
    data = report.model_dump(mode="json")
    assert data["status"] == "pass"
    assert len(data["checks"]) == 1
