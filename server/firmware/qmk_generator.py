"""
QMK/VIA firmware metadata generator.

Produces JSON metadata files that are consumed by QMK Firmware and VIA.
These are NOT compiled firmware — they are configuration/data files that
the user takes to the QMK/VIA toolchain.

Spec reference: [R3] QMK info.json, [R4] QMK data-driven config, [R5] VIA spec
"""

from __future__ import annotations

import json
from pathlib import Path

from server.eda.matrix_compiler import MatrixAssignment
from server.models.project import KeyboardProject


# Default pin assignments for RP2040-based controllers
# These match common Pro Micro RP2040 pinouts
RP2040_ROW_PINS = ["GP0", "GP1", "GP2", "GP3", "GP4", "GP5", "GP6", "GP7"]
RP2040_COL_PINS = [
    "GP8", "GP9", "GP10", "GP11", "GP12", "GP13", "GP14", "GP15",
    "GP16", "GP17", "GP18", "GP19", "GP20", "GP21", "GP22", "GP23",
    "GP26", "GP27", "GP28", "GP29",
]

# Standard QWERTY keymap for common layout positions
QWERTY_MAP: dict[str, str] = {
    "Esc": "KC_ESC", "`": "KC_GRV",
    "1": "KC_1", "2": "KC_2", "3": "KC_3", "4": "KC_4", "5": "KC_5",
    "6": "KC_6", "7": "KC_7", "8": "KC_8", "9": "KC_9", "0": "KC_0",
    "-": "KC_MINS", "=": "KC_EQL", "Bksp": "KC_BSPC",
    "Tab": "KC_TAB", "Q": "KC_Q", "W": "KC_W", "E": "KC_E", "R": "KC_R",
    "T": "KC_T", "Y": "KC_Y", "U": "KC_U", "I": "KC_I", "O": "KC_O",
    "P": "KC_P", "[": "KC_LBRC", "]": "KC_RBRC", "\\": "KC_BSLS",
    "Caps": "KC_CAPS", "A": "KC_A", "S": "KC_S", "D": "KC_D", "F": "KC_F",
    "G": "KC_G", "H": "KC_H", "J": "KC_J", "K": "KC_K", "L": "KC_L",
    ";": "KC_SCLN", "'": "KC_QUOT", "Enter": "KC_ENT",
    "Shift": "KC_LSFT", "Z": "KC_Z", "X": "KC_X", "C": "KC_C", "V": "KC_V",
    "B": "KC_B", "N": "KC_N", "M": "KC_M", ",": "KC_COMM", ".": "KC_DOT",
    "/": "KC_SLSH",
    "Ctrl": "KC_LCTL", "Win": "KC_LGUI", "Alt": "KC_LALT",
    "Space": "KC_SPC", "Fn": "MO(1)",
    "Left": "KC_LEFT", "Down": "KC_DOWN", "Up": "KC_UP", "Right": "KC_RGHT",
    "Home": "KC_HOME", "End": "KC_END", "PgUp": "KC_PGUP", "PgDn": "KC_PGDN",
    "Del": "KC_DEL", "Menu": "KC_APP",
    "F1": "KC_F1", "F2": "KC_F2", "F3": "KC_F3", "F4": "KC_F4",
    "F5": "KC_F5", "F6": "KC_F6", "F7": "KC_F7", "F8": "KC_F8",
    "F9": "KC_F9", "F10": "KC_F10", "F11": "KC_F11", "F12": "KC_F12",
}


def _label_to_keycode(label: str) -> str:
    """Convert a key label to a QMK keycode."""
    return QWERTY_MAP.get(label, "KC_NO")


def generate_qmk_info(
    project: KeyboardProject,
    matrix: MatrixAssignment,
) -> dict:
    """
    Generate QMK info.json content.

    This defines the keyboard's identity, matrix, and layout for QMK firmware.
    Ref: https://docs.qmk.fm/reference_info_json
    """
    keyboard_name = project.name.lower().replace(" ", "_").replace("-", "_")

    # Pin assignments (limited by matrix size)
    row_pins = RP2040_ROW_PINS[: matrix.matrix_rows]
    col_pins = RP2040_COL_PINS[: matrix.matrix_cols]

    # Layout definition — key positions for QMK's layout macro
    layout_keys = []
    for key in project.layout.keys:
        if key.row is not None and key.col is not None:
            layout_keys.append({
                "matrix": [key.row, key.col],
                "x": key.x_u,
                "y": key.y_u,
                "w": key.w_u,
                "h": key.h_u,
                "label": key.label,
            })

    return {
        "keyboard_name": keyboard_name,
        "manufacturer": "BreakGen",
        "maintainer": "breakgen",
        "url": "https://github.com/Parthawe/BreakGen",
        "usb": {
            "vid": "0xFEED",
            "pid": "0xBEEF",
            "device_version": "0.0.1",
        },
        "processor": "RP2040",
        "bootloader": "rp2040",
        "diode_direction": project.pcb.diode_direction.value,
        "matrix_pins": {
            "rows": row_pins,
            "cols": col_pins,
        },
        "layouts": {
            "LAYOUT": {
                "layout": layout_keys,
            }
        },
    }


def generate_keymap(
    project: KeyboardProject,
    matrix: MatrixAssignment,
) -> dict:
    """
    Generate a default QWERTY keymap.json.
    """
    # Build a matrix-indexed keymap
    keymap = [["KC_NO"] * matrix.matrix_cols for _ in range(matrix.matrix_rows)]

    for key in project.layout.keys:
        if key.row is not None and key.col is not None:
            keymap[key.row][key.col] = _label_to_keycode(key.label)

    return {
        "version": 1,
        "keyboard": project.name.lower().replace(" ", "_"),
        "keymap": "default",
        "layers": [
            # Layer 0: QWERTY
            [kc for row in keymap for kc in row],
        ],
    }


def generate_via_definition(
    project: KeyboardProject,
    matrix: MatrixAssignment,
) -> dict:
    """
    Generate a VIA keyboard definition.

    VIA expects layouts.keymap in KLE JSON format: an array of rows,
    where each key is either a string (label with matrix coord) or an
    object with position/size overrides followed by its label string.

    Matrix coordinates are embedded as "row,col" in the key label.
    Ref: https://www.caniusevia.com/docs/layouts/
    """
    # Sort keys by row (y) then column (x) for KLE row grouping
    sorted_keys = sorted(
        [k for k in project.layout.keys if k.row is not None and k.col is not None],
        key=lambda k: (k.y_u, k.x_u),
    )

    # Group into KLE rows by Y position (same logic as matrix compiler)
    kle_rows: list[list] = []
    current_row_items: list = []
    current_y: float | None = None

    for key in sorted_keys:
        if current_y is None or abs(key.y_u - current_y) > 0.5:
            if current_row_items:
                kle_rows.append(current_row_items)
            current_row_items = []
            current_y = key.y_u

        # If key has non-default position/size, emit an options object first
        opts: dict = {}
        if key.x_u != 0 and (not current_row_items):
            opts["x"] = key.x_u
        if key.w_u != 1:
            opts["w"] = key.w_u
        if key.h_u != 1:
            opts["h"] = key.h_u

        if opts:
            current_row_items.append(opts)

        # Key label with matrix coordinate: "row,col\nlabel"
        current_row_items.append(f"{key.row},{key.col}\n{key.label}")

    if current_row_items:
        kle_rows.append(current_row_items)

    return {
        "name": project.name,
        "vendorId": "0xFEED",
        "productId": "0xBEEF",
        "matrix": {
            "rows": matrix.matrix_rows,
            "cols": matrix.matrix_cols,
        },
        "layouts": {
            "keymap": kle_rows,
        },
    }


def write_firmware_files(
    project: KeyboardProject,
    matrix: MatrixAssignment,
    output_dir: Path,
) -> dict[str, str]:
    """Write all firmware metadata files to the output directory."""
    output_dir.mkdir(parents=True, exist_ok=True)

    info = generate_qmk_info(project, matrix)
    keymap = generate_keymap(project, matrix)
    via = generate_via_definition(project, matrix)

    info_path = output_dir / "info.json"
    keymap_path = output_dir / "keymap.json"
    via_path = output_dir / "via.json"

    for path, data in [(info_path, info), (keymap_path, keymap), (via_path, via)]:
        with open(path, "w") as f:
            json.dump(data, f, indent=2)

    return {
        "info_json": str(info_path),
        "keymap_json": str(keymap_path),
        "via_json": str(via_path),
    }
