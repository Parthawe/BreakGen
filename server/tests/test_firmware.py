"""Tests for firmware metadata generation."""

import json
from pathlib import Path

from server.eda.control_surface_electronics import apply_project_matrix, compile_project_matrix
from server.firmware.qmk_generator import (
    generate_control_map,
    generate_keymap,
    generate_qmk_info,
    generate_via_definition,
)
from server.models.project import KeyboardProject, LayoutSpec, ProductFamily


TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def _project_from_template(template_id: str) -> tuple:
    with open(TEMPLATES_DIR / f"{template_id}.json") as f:
        data = json.load(f)
    project = KeyboardProject(
        project_id="test",
        name="Test Board",
        layout=LayoutSpec(**data["layout"]),
    )
    if template_id.startswith("midi_"):
        project.product_family = ProductFamily.MIDI
    elif template_id.startswith("gamepad_"):
        project.product_family = ProductFamily.GAMEPAD
    elif template_id.startswith("handheld_"):
        project.product_family = ProductFamily.HANDHELD_COMPANION
    project.switch_profile.part_id = "cherry_mx_red"
    matrix, _ = compile_project_matrix(project)
    apply_project_matrix(project, matrix)
    return project, matrix


def test_qmk_info_structure():
    project, matrix = _project_from_template("60_percent")
    info = generate_qmk_info(project, matrix)
    assert info["keyboard_name"] == "test_board"
    assert info["processor"] == "RP2040"
    assert info["diode_direction"] == "COL2ROW"
    assert len(info["matrix_pins"]["rows"]) == matrix.matrix_rows
    assert len(info["matrix_pins"]["cols"]) == matrix.matrix_cols
    assert "LAYOUT" in info["layouts"]


def test_keymap_maps_all_keys():
    project, matrix = _project_from_template("65_percent")
    keymap = generate_keymap(project, matrix)
    layer = keymap["layers"][0]
    mapped = [kc for kc in layer if kc != "KC_NO"]
    assert len(mapped) == len(project.layout.keys)


def test_via_definition_kle_format():
    """VIA must use KLE-style layout with matrix coords in labels."""
    project, matrix = _project_from_template("60_percent")
    via = generate_via_definition(project, matrix)
    assert via["name"] == "Test Board"
    assert via["matrix"]["rows"] == matrix.matrix_rows
    assert via["matrix"]["cols"] == matrix.matrix_cols

    keymap = via["layouts"]["keymap"]
    assert len(keymap) == matrix.matrix_rows

    first_key = None
    for item in keymap[0]:
        if isinstance(item, str):
            first_key = item
            break
    assert first_key is not None
    assert "\n" in first_key
    parts = first_key.split("\n")
    assert "," in parts[0]


def test_midi_control_map_uses_midi_semantics():
    project, matrix = _project_from_template("midi_25key")
    control_map = generate_control_map(project, matrix)

    assert control_map["product_family"] == "midi"
    assert control_map["firmware_target"] == "midi_control_surface"
    assert control_map["control_protocol"] == "usb_midi"
    first_key = next(item for item in control_map["mappings"] if item["element_type"] == "key_switch")
    first_encoder = next(item for item in control_map["mappings"] if item["element_type"] == "encoder")
    assert first_key["mapping"]["kind"] == "midi_note"
    assert first_key["mapping"]["note"] == 60
    assert first_encoder["mapping"]["kind"] == "midi_cc"
    assert first_encoder["mapping"]["cc"] == 16


def test_gamepad_control_map_uses_gamepad_semantics():
    project, matrix = _project_from_template("gamepad_compact")
    control_map = generate_control_map(project, matrix)

    assert control_map["product_family"] == "gamepad"
    assert control_map["firmware_target"] == "hid_gamepad"
    assert control_map["control_protocol"] == "usb_hid_gamepad"
    dpad_up = next(item for item in control_map["mappings"] if item["id"] == "dpad_up")
    face_a = next(item for item in control_map["mappings"] if item["id"] == "face_a")
    assert dpad_up["mapping"]["kind"] == "dpad"
    assert dpad_up["mapping"]["direction"] == "up"
    assert face_a["mapping"]["kind"] == "gamepad_button"
    assert face_a["mapping"]["button"] == "south"


def test_handheld_control_map_uses_companion_semantics():
    project, matrix = _project_from_template("handheld_companion_compact")
    control_map = generate_control_map(project, matrix)

    assert control_map["product_family"] == "handheld_companion"
    assert control_map["firmware_target"] == "handheld_companion_proof"
    assert control_map["control_protocol"] == "usb_hid_companion"
    display = next(item for item in control_map["mappings"] if item["id"] == "main_display")
    speaker = next(item for item in control_map["mappings"] if item["id"] == "speaker_main")
    usb_port = next(item for item in control_map["mappings"] if item["id"] == "usb_c")
    assert display["mapping"]["kind"] == "display_surface"
    assert speaker["mapping"]["kind"] == "audio_output"
    assert usb_port["mapping"]["kind"] == "service_port"
