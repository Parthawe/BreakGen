"""Tests for the validation engine."""

from server.models.project import (
    ElementType,
    KeyboardProject,
    KeySpec,
    KeycapAsset,
    LayoutSpec,
    PlacedElementSpec,
    ProductFamily,
    StabilizerType,
)
from server.models.validation_schema import CheckStatus
from server.validation.engine import validate_project


def _project_with_keys(keys: list[KeySpec]) -> KeyboardProject:
    return KeyboardProject(
        project_id="test",
        layout=LayoutSpec(keys=keys),
    )


def test_empty_layout_fails():
    report = validate_project(_project_with_keys([]))
    assert report.status == CheckStatus.FAIL
    empty_check = next(c for c in report.checks if c.id == "layout_nonempty")
    assert empty_check.status == CheckStatus.FAIL


def test_valid_project_passes():
    project = KeyboardProject(
        project_id="test",
        layout=LayoutSpec(keys=[
            KeySpec(id="k1", x_u=0, y_u=0, w_u=1, h_u=1, label="A"),
        ]),
    )
    project.switch_profile.part_id = "cherry_mx_red"
    report = validate_project(project)
    assert report.status == CheckStatus.PASS


def test_wide_key_missing_stab_warns():
    project = _project_with_keys([
        KeySpec(
            id="k1",
            x_u=0,
            y_u=0,
            w_u=2.25,
            h_u=1,
            label="Shift",
            stabilizer=StabilizerType.NONE,
        ),
    ])
    report = validate_project(project)
    stab_check = next(c for c in report.checks if c.id == "stabilizer_assignment")
    assert stab_check.status == CheckStatus.WARN


def test_wide_key_with_stab_passes():
    project = _project_with_keys([
        KeySpec(
            id="k1",
            x_u=0,
            y_u=0,
            w_u=2.25,
            h_u=1,
            label="Shift",
            stabilizer=StabilizerType.CHERRY,
        ),
    ])
    report = validate_project(project)
    stab_check = next(c for c in report.checks if c.id == "stabilizer_assignment")
    assert stab_check.status == CheckStatus.PASS


def test_overlapping_elements_fail():
    project = _project_with_keys([
        KeySpec(id="k1", x_u=0, y_u=0, w_u=1, h_u=1, label="A"),
        KeySpec(id="k2", x_u=0.5, y_u=0, w_u=1, h_u=1, label="B"),
    ])
    report = validate_project(project)
    overlap = next(c for c in report.checks if c.id == "element_overlap")
    assert overlap.status == CheckStatus.FAIL


def test_tight_encoder_clearance_warns():
    project = KeyboardProject(
        project_id="test",
        layout=LayoutSpec(
            elements=[
                PlacedElementSpec(
                    id="enc_1",
                    element_type=ElementType.ENCODER,
                    label="E1",
                    x_mm=0,
                    y_mm=0,
                    w_mm=19.05,
                    h_mm=19.05,
                ),
                PlacedElementSpec(
                    id="enc_2",
                    element_type=ElementType.ENCODER,
                    label="E2",
                    x_mm=21.0,
                    y_mm=0,
                    w_mm=19.05,
                    h_mm=19.05,
                ),
            ]
        ),
    )
    report = validate_project(project)
    clearance = next(c for c in report.checks if c.id == "control_clearance")
    assert clearance.status == CheckStatus.WARN


def test_gpio_budget_fails_when_controls_exceed_controller():
    project = KeyboardProject(
        project_id="test",
        layout=LayoutSpec(
            elements=[
                *[
                    PlacedElementSpec(
                        id=f"k{i}",
                        element_type=ElementType.KEY_SWITCH,
                        label=str(i),
                        x_mm=float(i) * 19.05,
                        y_mm=0,
                        w_mm=19.05,
                        h_mm=19.05,
                    )
                    for i in range(12)
                ],
                *[
                    PlacedElementSpec(
                        id=f"enc{i}",
                        element_type=ElementType.ENCODER,
                        label=f"E{i}",
                        x_mm=float(i) * 25.0,
                        y_mm=40.0,
                        w_mm=19.05,
                        h_mm=19.05,
                    )
                    for i in range(8)
                ],
            ]
        ),
    )
    report = validate_project(project)
    matrix = next(c for c in report.checks if c.id == "matrix_feasibility")
    assert matrix.status == CheckStatus.FAIL


def test_no_switch_selected_warns():
    project = _project_with_keys([
        KeySpec(id="k1", x_u=0, y_u=0, w_u=1, h_u=1, label="A"),
    ])
    report = validate_project(project)
    switch_check = next(c for c in report.checks if c.id == "switch_selected")
    assert switch_check.status == CheckStatus.WARN


def test_unaccepted_assigned_asset_fails_export_readiness():
    project = KeyboardProject(
        project_id="test",
        layout=LayoutSpec(
            elements=[
                PlacedElementSpec(
                    id="k1",
                    element_type=ElementType.KEY_SWITCH,
                    label="A",
                    x_mm=0,
                    y_mm=0,
                    w_mm=19.05,
                    h_mm=19.05,
                    appearance_ref="meshy_candidate",
                    keycap_asset_id="meshy_candidate",
                )
            ]
        ),
        keycap_assets=[
            KeycapAsset(
                asset_id="meshy_candidate",
                source="generated",
                provider="meshy",
                prompt="A",
                mesh_path="/tmp/a.stl",
                preview_mesh_path="/tmp/a.glb",
                normalized=True,
                watertight=True,
            )
        ],
    )
    project.switch_profile.part_id = "cherry_mx_red"
    report = validate_project(project)
    asset_check = next(c for c in report.checks if c.id == "assigned_asset_acceptance")
    assert asset_check.status == CheckStatus.FAIL


def test_handheld_companion_requires_core_modules():
    project = KeyboardProject(
        project_id="test",
        product_family=ProductFamily.HANDHELD_COMPANION,
        layout=LayoutSpec(
            elements=[
                PlacedElementSpec(
                    id="display",
                    element_type=ElementType.DISPLAY,
                    label="Display",
                    x_mm=0,
                    y_mm=0,
                    w_mm=60,
                    h_mm=40,
                ),
                PlacedElementSpec(
                    id="button_a",
                    element_type=ElementType.BUTTON,
                    label="A",
                    x_mm=80,
                    y_mm=10,
                    w_mm=16,
                    h_mm=16,
                ),
            ]
        ),
    )
    report = validate_project(project)
    family_check = next(c for c in report.checks if c.id == "family_required_modules")
    assert family_check.status == CheckStatus.FAIL
