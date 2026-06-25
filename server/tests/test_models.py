"""Tests for the canonical domain models."""

import json
from pathlib import Path

from server.models.project import (
    KeyboardProject,
    ProductDomain,
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
    assert p.layout.elements == []
    assert p.product_domain == ProductDomain.CONTROL_SURFACE
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


def test_layout_compatibility_generates_elements_from_keys():
    layout = LayoutSpec(
        keys=[KeySpec(id="k1", label="A", x_u=0, y_u=0)],
    )
    assert len(layout.elements) == 1
    assert layout.elements[0].element_type.value == "key_switch"


def test_layout_compatibility_excludes_encoders_from_legacy_keys():
    layout = LayoutSpec(
        elements=[
            {
                "id": "enc_1",
                "element_type": "encoder",
                "label": "E1",
                "x_mm": 0,
                "y_mm": 0,
                "w_mm": 19.05,
                "h_mm": 19.05,
            },
            {
                "id": "k1",
                "element_type": "key_switch",
                "label": "A",
                "x_mm": 19.05,
                "y_mm": 0,
                "w_mm": 19.05,
                "h_mm": 19.05,
            },
        ],
    )
    assert len(layout.elements) == 2
    assert [key.id for key in layout.keys] == ["k1"]


def test_layout_compatibility_excludes_pads_from_legacy_keys():
    layout = LayoutSpec(
        elements=[
            {
                "id": "pad_1",
                "element_type": "pad",
                "label": "P1",
                "x_mm": 0,
                "y_mm": 0,
                "w_mm": 24,
                "h_mm": 24,
            },
        ],
    )
    assert len(layout.elements) == 1
    assert layout.keys == []


def test_template_key_counts_match():
    """Every template's actual key count must match SUPPORTED_TEMPLATES declaration."""
    for tmpl in SUPPORTED_TEMPLATES:
        path = TEMPLATES_DIR / f"{tmpl.template_id}.json"
        assert path.exists(), f"Missing template file: {path}"
        with open(path) as f:
            data = json.load(f)
        layout = LayoutSpec(**data["layout"])
        actual_count = len(layout.elements) if layout.elements else len(layout.keys)
        assert actual_count == tmpl.key_count, (
            f"{tmpl.template_id}: declared {tmpl.key_count}, actual {actual_count}"
        )


def test_template_no_duplicate_key_ids():
    """No template should have duplicate key IDs."""
    for tmpl in SUPPORTED_TEMPLATES:
        path = TEMPLATES_DIR / f"{tmpl.template_id}.json"
        with open(path) as f:
            data = json.load(f)
        raw_items = data["layout"].get("elements") or data["layout"].get("keys") or []
        ids = [k["id"] for k in raw_items]
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
