"""Tests for multi-product support."""

import json
from pathlib import Path

from server.models.product_adapter import (
    generate_breath_controller_layout,
    generate_gamepad_layout,
    generate_grid_layout,
    generate_handheld_companion_layout,
    generate_midi_layout,
    generate_midi_pad_layout,
    generate_pedal_controller_layout,
)
from server.models.project import LayoutSpec, ProductFamily
from server.models.supported_configs import SUPPORTED_TEMPLATES
from server.eda.matrix_compiler import compile_matrix
from server.geometry.plate_generator import generate_plate_dxf, PlateConfig


TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def test_macropad_3x3_has_9_keys():
    layout = generate_grid_layout(3, 3, ProductFamily.MACROPAD)
    assert len(layout.keys) == 9


def test_macropad_4x4_has_16_keys():
    layout = generate_grid_layout(4, 4, ProductFamily.MACROPAD)
    assert len(layout.keys) == 16


def test_streamdeck_3x5_has_15_keys():
    layout = generate_grid_layout(3, 5, ProductFamily.STREAMDECK)
    assert len(layout.keys) == 15


def test_streamdeck_display_template_adds_status_modules():
    with open(TEMPLATES_DIR / "streamdeck_display_3x5.json") as f:
        data = json.load(f)
    layout = LayoutSpec(**data["layout"])
    assert len(layout.elements) == 17
    assert len(layout.keys) == 15
    assert sum(1 for element in layout.elements if element.element_type.value == "display") == 1
    assert sum(1 for element in layout.elements if element.element_type.value == "encoder") == 1


def test_streamdeck_wider_spacing():
    """Stream deck keys should be spaced wider than standard keyboard keys."""
    kb = generate_grid_layout(2, 2, ProductFamily.MACROPAD)
    sd = generate_grid_layout(2, 2, ProductFamily.STREAMDECK)
    # Second key X position should be larger for stream deck
    kb_x1 = kb.keys[1].x_u
    sd_x1 = sd.keys[1].x_u
    assert sd_x1 > kb_x1, "Stream deck should have wider key spacing"


def test_midi_layout_has_keys_and_encoders():
    layout = generate_midi_layout(25, 4)
    assert len(layout.elements) == 29  # 25 keys + 4 encoders
    assert len(layout.keys) == 25  # encoders no longer masquerade as keys
    encoders = [element for element in layout.elements if element.id.startswith("k_enc_")]
    keys = [element for element in layout.elements if element.id.startswith("k_key_")]
    assert len(encoders) == 4
    assert len(keys) == 25


def test_midi_pad_layout_has_pads_and_encoders():
    layout = generate_midi_pad_layout()
    assert len(layout.elements) == 20
    assert len(layout.keys) == 0
    pads = [element for element in layout.elements if element.element_type.value == "pad"]
    encoders = [element for element in layout.elements if element.element_type.value == "encoder"]
    assert len(pads) == 16
    assert len(encoders) == 4
    assert {pad.footprint_id for pad in pads} == {"rubber_drum_pad"}


def test_gamepad_layout_generates_button_elements():
    layout = generate_gamepad_layout()
    assert len(layout.elements) == 11
    assert len(layout.keys) == 10
    buttons = [element for element in layout.elements if element.element_type.value == "button"]
    joysticks = [element for element in layout.elements if element.element_type.value == "joystick"]
    assert len(buttons) == 10
    assert len(joysticks) == 1


def test_pedal_controller_layout_uses_footswitches_and_expression_input():
    layout = generate_pedal_controller_layout()
    assert len(layout.elements) == 4
    assert len(layout.keys) == 3
    buttons = [element for element in layout.elements if element.element_type.value == "button"]
    sliders = [element for element in layout.elements if element.element_type.value == "slider"]
    assert len(buttons) == 3
    assert len(sliders) == 1
    assert {button.footprint_id for button in buttons} == {"stomp_switch"}
    assert sliders[0].footprint_id == "expression_pedal"


def test_breath_controller_layout_uses_sensors_microphone_and_controls():
    layout = generate_breath_controller_layout()
    assert len(layout.elements) == 6
    assert len(layout.keys) == 2
    sensors = [element for element in layout.elements if element.element_type.value == "sensor"]
    microphones = [element for element in layout.elements if element.element_type.value == "microphone"]
    buttons = [element for element in layout.elements if element.element_type.value == "button"]
    displays = [element for element in layout.elements if element.element_type.value == "display"]
    assert len(sensors) == 2
    assert len(microphones) == 1
    assert len(buttons) == 2
    assert len(displays) == 1
    assert {sensor.footprint_id for sensor in sensors} == {"pressure_sensor", "bite_sensor"}


def test_handheld_companion_layout_uses_portable_modules():
    layout = generate_handheld_companion_layout()
    assert len(layout.elements) == 13
    assert len(layout.keys) == 8
    element_types = [element.element_type.value for element in layout.elements]
    assert element_types.count("button") == 8
    assert element_types.count("display") == 1
    assert element_types.count("speaker") == 1
    assert element_types.count("microphone") == 1
    assert element_types.count("battery") == 1
    assert element_types.count("usb_port") == 1


def test_macropad_matrix_compiles():
    layout = generate_grid_layout(3, 3, ProductFamily.MACROPAD)
    matrix = compile_matrix(layout)
    assert matrix.matrix_rows == 3
    assert matrix.matrix_cols == 3
    assert len(matrix.assignments) == 9


def test_macropad_plate_generates():
    layout = generate_grid_layout(4, 4, ProductFamily.MACROPAD)
    doc = generate_plate_dxf(layout, PlateConfig())
    msp = doc.modelspace()
    cutouts = [e for e in msp if e.dxf.layer == "Cutouts"]
    assert len(cutouts) == 16  # No stabilizers on 1u keys


def test_all_new_templates_exist():
    """Every template in SUPPORTED_TEMPLATES must have a JSON file."""
    for tmpl in SUPPORTED_TEMPLATES:
        path = TEMPLATES_DIR / f"{tmpl.template_id}.json"
        assert path.exists(), f"Missing template: {path}"
        with open(path) as f:
            data = json.load(f)
        layout = LayoutSpec(**data["layout"])
        actual_count = len(layout.elements) if layout.elements else len(layout.keys)
        assert actual_count == tmpl.key_count, (
            f"{tmpl.template_id}: declared {tmpl.key_count}, actual {actual_count}"
        )


def test_template_family_filter():
    keyboards = [t for t in SUPPORTED_TEMPLATES if t.product_family == ProductFamily.KEYBOARD]
    macropads = [t for t in SUPPORTED_TEMPLATES if t.product_family == ProductFamily.MACROPAD]
    streamdecks = [t for t in SUPPORTED_TEMPLATES if t.product_family == ProductFamily.STREAMDECK]
    midi = [t for t in SUPPORTED_TEMPLATES if t.product_family == ProductFamily.MIDI]
    gamepads = [t for t in SUPPORTED_TEMPLATES if t.product_family == ProductFamily.GAMEPAD]
    pedals = [t for t in SUPPORTED_TEMPLATES if t.product_family == ProductFamily.PEDAL_CONTROLLER]
    breaths = [t for t in SUPPORTED_TEMPLATES if t.product_family == ProductFamily.BREATH_CONTROLLER]
    handhelds = [t for t in SUPPORTED_TEMPLATES if t.product_family == ProductFamily.HANDHELD_COMPANION]
    assert len(keyboards) == 3
    assert len(macropads) == 2
    assert len(streamdecks) == 3
    assert len(midi) == 2
    assert len(gamepads) == 1
    assert len(pedals) == 1
    assert len(breaths) == 1
    assert len(handhelds) == 1


def test_grid_no_duplicate_ids():
    """Grid layouts should have unique key IDs."""
    for rows, cols in [(3, 3), (4, 4), (2, 6)]:
        layout = generate_grid_layout(rows, cols, ProductFamily.MACROPAD)
        ids = [k.id for k in layout.keys]
        assert len(ids) == len(set(ids)), f"Duplicate IDs in {rows}x{cols} grid"
