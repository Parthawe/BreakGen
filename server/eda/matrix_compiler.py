"""
Keyboard matrix compiler.

Converts a LayoutSpec into a scanning matrix (rows × columns) suitable
for keyboard firmware. Each key is assigned a (row, col) pair.

Strategy: cluster keys by physical Y position into rows, then assign
columns by X position within each row. This produces the most natural
matrix for standard staggered layouts.

Spec reference: PRODUCT_SPEC.md section 13.3
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from server.models.project import KeySpec, LayoutSpec

logger = logging.getLogger(__name__)

# Keys within this Y-distance (in keyboard units) are considered the same row
ROW_CLUSTER_THRESHOLD = 0.5


@dataclass
class MatrixAssignment:
    """Result of matrix compilation."""

    matrix_rows: int
    matrix_cols: int
    assignments: dict[str, tuple[int, int]]  # key_id -> (row, col)
    row_pins_needed: int
    col_pins_needed: int


def _cluster_by_y(keys: list[KeySpec], threshold: float = ROW_CLUSTER_THRESHOLD) -> list[list[KeySpec]]:
    """Group keys into rows by their Y-center position."""
    if not keys:
        return []

    # Sort by Y center
    sorted_keys = sorted(keys, key=lambda k: k.y_u + k.h_u / 2)

    rows: list[list[KeySpec]] = []
    current_row: list[KeySpec] = [sorted_keys[0]]
    current_y = sorted_keys[0].y_u + sorted_keys[0].h_u / 2

    for key in sorted_keys[1:]:
        key_y = key.y_u + key.h_u / 2
        if abs(key_y - current_y) <= threshold:
            current_row.append(key)
        else:
            rows.append(current_row)
            current_row = [key]
            current_y = key_y

    if current_row:
        rows.append(current_row)

    # Sort keys within each row by X position
    for row in rows:
        row.sort(key=lambda k: k.x_u)

    return rows


def compile_matrix(layout: LayoutSpec) -> MatrixAssignment:
    """
    Compile a keyboard scanning matrix from the layout.

    Returns row/column assignments for every key.
    """
    if not layout.keys:
        return MatrixAssignment(
            matrix_rows=0, matrix_cols=0, assignments={},
            row_pins_needed=0, col_pins_needed=0,
        )

    rows = _cluster_by_y(layout.keys)
    assignments: dict[str, tuple[int, int]] = {}

    max_cols = 0
    for row_idx, row_keys in enumerate(rows):
        for col_idx, key in enumerate(row_keys):
            assignments[key.id] = (row_idx, col_idx)
            max_cols = max(max_cols, col_idx + 1)

    n_rows = len(rows)
    n_cols = max_cols

    logger.info(f"Matrix compiled: {n_rows} rows × {n_cols} cols for {len(layout.keys)} keys")

    return MatrixAssignment(
        matrix_rows=n_rows,
        matrix_cols=n_cols,
        assignments=assignments,
        row_pins_needed=n_rows,
        col_pins_needed=n_cols,
    )


def apply_matrix_to_layout(layout: LayoutSpec, matrix: MatrixAssignment) -> LayoutSpec:
    """Write row/col assignments back into the layout keys."""
    for key in layout.keys:
        if key.id in matrix.assignments:
            row, col = matrix.assignments[key.id]
            key.row = row
            key.col = col
    return layout
