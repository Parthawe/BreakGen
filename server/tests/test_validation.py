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


def test_tight_pad_clearance_warns():
    project = KeyboardProject(
        project_id="test",
        product_family=ProductFamily.MIDI,
        layout=LayoutSpec(
            elements=[
                PlacedElementSpec(
                    id="pad_1",
                    element_type=ElementType.PAD,
                    label="P1",
                    footprint_id="rubber_drum_pad",
                    x_mm=0,
                    y_mm=0,
                    w_mm=24,
                    h_mm=24,
                ),
                PlacedElementSpec(
                    id="pad_2",
                    element_type=ElementType.PAD,
                    label="P2",
                    footprint_id="rubber_drum_pad",
                    x_mm=25,
                    y_mm=0,
                    w_mm=24,
                    h_mm=24,
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


def test_unknown_footprint_source_fails():
    project = KeyboardProject(
        project_id="test",
        layout=LayoutSpec(
            elements=[
                PlacedElementSpec(
                    id="k1",
                    element_type=ElementType.KEY_SWITCH,
                    label="A",
                    footprint_id="mystery_switch",
                    x_mm=0,
                    y_mm=0,
                    w_mm=19.05,
                    h_mm=19.05,
                )
            ]
        ),
    )
    project.switch_profile.part_id = "cherry_mx_red"
    report = validate_project(project)
    footprint_check = next(c for c in report.checks if c.id == "footprint_source_coverage")
    assert footprint_check.status == CheckStatus.FAIL
    assert "mystery_switch" in footprint_check.details


def test_proof_placeholder_footprint_warns():
    project = KeyboardProject(
        project_id="test",
        product_family=ProductFamily.MIDI,
        layout=LayoutSpec(
            elements=[
                PlacedElementSpec(
                    id="pad_1",
                    element_type=ElementType.PAD,
                    label="P1",
                    footprint_id="rubber_drum_pad",
                    x_mm=0,
                    y_mm=0,
                    w_mm=24,
                    h_mm=24,
                )
            ]
        ),
    )
    report = validate_project(project)
    footprint_check = next(c for c in report.checks if c.id == "footprint_source_coverage")
    assert footprint_check.status == CheckStatus.WARN
    assert "proof placeholder" in footprint_check.details


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


def test_handheld_companion_passes_with_core_modules():
    project = KeyboardProject(
        project_id="test",
        product_family=ProductFamily.HANDHELD_COMPANION,
        layout=LayoutSpec(
            elements=[
                PlacedElementSpec(id="display", element_type=ElementType.DISPLAY, label="Display", x_mm=40, y_mm=0, w_mm=60, h_mm=40),
                PlacedElementSpec(id="up", element_type=ElementType.BUTTON, label="Up", x_mm=0, y_mm=50, w_mm=16, h_mm=16),
                PlacedElementSpec(id="down", element_type=ElementType.BUTTON, label="Down", x_mm=0, y_mm=72, w_mm=16, h_mm=16),
                PlacedElementSpec(id="a", element_type=ElementType.BUTTON, label="A", x_mm=120, y_mm=50, w_mm=16, h_mm=16),
                PlacedElementSpec(id="b", element_type=ElementType.BUTTON, label="B", x_mm=142, y_mm=50, w_mm=16, h_mm=16),
                PlacedElementSpec(id="speaker", element_type=ElementType.SPEAKER, label="Speaker", x_mm=0, y_mm=100, w_mm=40, h_mm=40),
                PlacedElementSpec(id="mic", element_type=ElementType.MICROPHONE, label="Mic", x_mm=72, y_mm=104, w_mm=12, h_mm=12),
                PlacedElementSpec(id="battery", element_type=ElementType.BATTERY, label="Battery", x_mm=112, y_mm=100, w_mm=50, h_mm=34),
                PlacedElementSpec(id="usb", element_type=ElementType.USB_PORT, label="USB-C", x_mm=72, y_mm=150, w_mm=20, h_mm=8),
            ]
        ),
    )
    report = validate_project(project)
    family_check = next(c for c in report.checks if c.id == "family_required_modules")
    assert family_check.status == CheckStatus.PASS


def test_pedal_controller_requires_footswitches_and_expression_input():
    project = KeyboardProject(
        project_id="test",
        product_family=ProductFamily.PEDAL_CONTROLLER,
        layout=LayoutSpec(
            elements=[
                PlacedElementSpec(
                    id="footswitch_1",
                    element_type=ElementType.BUTTON,
                    label="FS1",
                    footprint_id="stomp_switch",
                    x_mm=0,
                    y_mm=0,
                    w_mm=24,
                    h_mm=24,
                ),
            ]
        ),
    )
    report = validate_project(project)
    family_check = next(c for c in report.checks if c.id == "family_required_modules")
    assert family_check.status == CheckStatus.FAIL
    assert "expression input" in family_check.details


def test_breath_controller_requires_sensor_mic_and_octave_controls():
    project = KeyboardProject(
        project_id="test",
        product_family=ProductFamily.BREATH_CONTROLLER,
        layout=LayoutSpec(
            elements=[
                PlacedElementSpec(
                    id="breath_pressure",
                    element_type=ElementType.SENSOR,
                    label="Breath",
                    footprint_id="pressure_sensor",
                    x_mm=0,
                    y_mm=0,
                    w_mm=28,
                    h_mm=16,
                ),
            ]
        ),
    )
    report = validate_project(project)
    family_check = next(c for c in report.checks if c.id == "family_required_modules")
    assert family_check.status == CheckStatus.FAIL
    assert "microphone" in family_check.details
    assert "two octave buttons" in family_check.details


def test_valid_breath_controller_family_modules_pass():
    project = KeyboardProject(
        project_id="test",
        product_family=ProductFamily.BREATH_CONTROLLER,
        layout=LayoutSpec(
            elements=[
                PlacedElementSpec(
                    id="breath_pressure",
                    element_type=ElementType.SENSOR,
                    label="Breath",
                    footprint_id="pressure_sensor",
                    x_mm=20,
                    y_mm=0,
                    w_mm=28,
                    h_mm=16,
                ),
                PlacedElementSpec(
                    id="bite_pressure",
                    element_type=ElementType.SENSOR,
                    label="Bite",
                    footprint_id="bite_sensor",
                    x_mm=56,
                    y_mm=0,
                    w_mm=24,
                    h_mm=14,
                ),
                PlacedElementSpec(
                    id="breath_mic",
                    element_type=ElementType.MICROPHONE,
                    label="Noise",
                    footprint_id="mems_microphone",
                    x_mm=88,
                    y_mm=2,
                    w_mm=12,
                    h_mm=12,
                ),
                PlacedElementSpec(
                    id="octave_down",
                    element_type=ElementType.BUTTON,
                    label="Oct-",
                    footprint_id="tact_button",
                    x_mm=0,
                    y_mm=34,
                    w_mm=16,
                    h_mm=16,
                ),
                PlacedElementSpec(
                    id="octave_up",
                    element_type=ElementType.BUTTON,
                    label="Oct+",
                    footprint_id="tact_button",
                    x_mm=24,
                    y_mm=34,
                    w_mm=16,
                    h_mm=16,
                ),
            ]
        ),
    )
    report = validate_project(project)
    family_check = next(c for c in report.checks if c.id == "family_required_modules")
    assert family_check.status == CheckStatus.PASS


def test_valid_pedal_controller_family_modules_pass():
    project = KeyboardProject(
        project_id="test",
        product_family=ProductFamily.PEDAL_CONTROLLER,
        layout=LayoutSpec(
            elements=[
                PlacedElementSpec(
                    id="footswitch_1",
                    element_type=ElementType.BUTTON,
                    label="FS1",
                    footprint_id="stomp_switch",
                    x_mm=0,
                    y_mm=0,
                    w_mm=24,
                    h_mm=24,
                ),
                PlacedElementSpec(
                    id="footswitch_2",
                    element_type=ElementType.BUTTON,
                    label="FS2",
                    footprint_id="stomp_switch",
                    x_mm=40,
                    y_mm=0,
                    w_mm=24,
                    h_mm=24,
                ),
                PlacedElementSpec(
                    id="expression_1",
                    element_type=ElementType.SLIDER,
                    label="EXP",
                    footprint_id="expression_pedal",
                    x_mm=10,
                    y_mm=46,
                    w_mm=84,
                    h_mm=28,
                ),
            ]
        ),
    )
    report = validate_project(project)
    family_check = next(c for c in report.checks if c.id == "family_required_modules")
    assert family_check.status == CheckStatus.PASS
