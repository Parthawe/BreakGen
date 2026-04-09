"""Tests for firmware metadata generation."""

import json
from pathlib import Path

from server.eda.matrix_compiler import compile_matrix, apply_matrix_to_layout
from server.firmware.qmk_generator import generate_qmk_info, generate_keymap, generate_via_definition
from server.models.project import KeyboardProject, LayoutSpec


TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def _project_from_template(template_id: str) -> tuple:
    with open(TEMPLATES_DIR / f"{template_id}.json") as f:
        data = json.load(f)
    project = KeyboardProject(
        project_id="test",
        name="Test Board",
        layout=LayoutSpec(**data["layout"]),
    )
    project.switch_profile.part_id = "cherry_mx_red"
    matrix = compile_matrix(project.layout)
    project.layout = apply_matrix_to_layout(project.layout, matrix)
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
    assert len(keymap) == matrix.matrix_rows  # One KLE row per matrix row

    # First entry in first row should be a string with "row,col\nlabel"
    first_key = None
    for item in keymap[0]:
        if isinstance(item, str):
            first_key = item
            break
    assert first_key is not None
    assert "\n" in first_key  # "0,0\nEsc" format
    parts = first_key.split("\n")
    assert "," in parts[0]  # "row,col"
