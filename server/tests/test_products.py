"""Tests for multi-product support."""

import json
from pathlib import Path

from server.models.product_adapter import generate_grid_layout, generate_midi_layout
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
    assert len(layout.keys) == 29  # 25 keys + 4 encoders
    encoders = [k for k in layout.keys if k.id.startswith("k_enc_")]
    keys = [k for k in layout.keys if k.id.startswith("k_key_")]
    assert len(encoders) == 4
    assert len(keys) == 25


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
        assert len(layout.keys) == tmpl.key_count, (
            f"{tmpl.template_id}: declared {tmpl.key_count}, actual {len(layout.keys)}"
        )


def test_template_family_filter():
    keyboards = [t for t in SUPPORTED_TEMPLATES if t.product_family == ProductFamily.KEYBOARD]
    macropads = [t for t in SUPPORTED_TEMPLATES if t.product_family == ProductFamily.MACROPAD]
    streamdecks = [t for t in SUPPORTED_TEMPLATES if t.product_family == ProductFamily.STREAMDECK]
    midi = [t for t in SUPPORTED_TEMPLATES if t.product_family == ProductFamily.MIDI]
    assert len(keyboards) == 3
    assert len(macropads) == 2
    assert len(streamdecks) == 2
    assert len(midi) == 1


def test_grid_no_duplicate_ids():
    """Grid layouts should have unique key IDs."""
    for rows, cols in [(3, 3), (4, 4), (2, 6)]:
        layout = generate_grid_layout(rows, cols, ProductFamily.MACROPAD)
        ids = [k.id for k in layout.keys]
        assert len(ids) == len(set(ids)), f"Duplicate IDs in {rows}x{cols} grid"
