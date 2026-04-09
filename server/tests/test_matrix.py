"""Tests for the matrix compiler."""

import json
from pathlib import Path

from server.eda.matrix_compiler import compile_matrix, apply_matrix_to_layout
from server.models.project import LayoutSpec


TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def _load_layout(template_id: str) -> LayoutSpec:
    with open(TEMPLATES_DIR / f"{template_id}.json") as f:
        data = json.load(f)
    return LayoutSpec(**data["layout"])


def test_60_percent_matrix():
    layout = _load_layout("60_percent")
    matrix = compile_matrix(layout)
    assert matrix.matrix_rows == 5
    assert matrix.matrix_cols == 14
    assert len(matrix.assignments) == 61


def test_65_percent_matrix():
    layout = _load_layout("65_percent")
    matrix = compile_matrix(layout)
    assert matrix.matrix_rows == 5
    assert matrix.matrix_cols == 15
    assert len(matrix.assignments) == 68


def test_75_percent_matrix():
    layout = _load_layout("75_percent")
    matrix = compile_matrix(layout)
    assert len(matrix.assignments) == 82
    # Must fit RP2040 (26 GPIO)
    total_pins = matrix.row_pins_needed + matrix.col_pins_needed
    assert total_pins <= 26, f"75% needs {total_pins} pins, exceeds RP2040"


def test_matrix_every_key_assigned():
    """Every key must get a (row, col) assignment."""
    layout = _load_layout("65_percent")
    matrix = compile_matrix(layout)
    for key in layout.keys:
        assert key.id in matrix.assignments, f"Key {key.id} not assigned"


def test_apply_matrix_writes_row_col():
    layout = _load_layout("60_percent")
    matrix = compile_matrix(layout)
    layout = apply_matrix_to_layout(layout, matrix)
    for key in layout.keys:
        assert key.row is not None, f"Key {key.id} has no row"
        assert key.col is not None, f"Key {key.id} has no col"


def test_empty_layout():
    layout = LayoutSpec(keys=[])
    matrix = compile_matrix(layout)
    assert matrix.matrix_rows == 0
    assert matrix.matrix_cols == 0
    assert len(matrix.assignments) == 0
