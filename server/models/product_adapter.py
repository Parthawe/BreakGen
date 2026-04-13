"""
Product family adapter.

Converts product-specific specs (grid dimensions, etc.) into the
canonical LayoutSpec that all downstream compilers consume.

This is the key abstraction that makes multi-product work:
every product family converts to LayoutSpec, then reuses the
same matrix compiler, plate generator, firmware generator, etc.
"""

from __future__ import annotations

import json
from pathlib import Path

from server.models.project import KeySpec, LayoutSpec, ProductFamily

UNIT_MM = 19.05
STREAMDECK_PITCH_MM = 24.0  # Stream deck keys are larger (wider spacing)


def generate_grid_layout(
    rows: int,
    cols: int,
    family: ProductFamily = ProductFamily.MACROPAD,
    pitch_mm: float | None = None,
) -> LayoutSpec:
    """
    Generate a regular grid layout.

    Used for macro pads, stream decks, and the key section of MIDI controllers.
    """
    if pitch_mm is None:
        pitch_mm = STREAMDECK_PITCH_MM if family == ProductFamily.STREAMDECK else UNIT_MM

    pitch_u = pitch_mm / UNIT_MM  # Convert to keyboard units
    keys: list[KeySpec] = []

    for r in range(rows):
        for c in range(cols):
            key_id = f"k_{r}_{c}"
            keys.append(KeySpec(
                id=key_id,
                label=f"{r * cols + c + 1}",
                x_u=round(c * pitch_u, 3),
                y_u=round(r * pitch_u, 3),
                w_u=1.0,
                h_u=1.0,
            ))

    return LayoutSpec(unit_pitch_mm=UNIT_MM, keys=keys)


def generate_midi_layout(
    key_count: int = 25,
    encoder_count: int = 4,
) -> LayoutSpec:
    """
    Generate a MIDI controller layout.

    Keys arranged in a single row (piano-style), encoders above.
    """
    keys: list[KeySpec] = []

    # Encoders at the top
    encoder_spacing = key_count / (encoder_count + 1)
    for i in range(encoder_count):
        keys.append(KeySpec(
            id=f"k_enc_{i}",
            label=f"E{i + 1}",
            x_u=round((i + 1) * encoder_spacing - 0.5, 2),
            y_u=0,
            w_u=1.0,
            h_u=1.0,
        ))

    # Keys in a row below
    for i in range(key_count):
        keys.append(KeySpec(
            id=f"k_key_{i}",
            label=str(i + 1),
            x_u=float(i),
            y_u=1.5,
            w_u=1.0,
            h_u=1.0,
        ))

    return LayoutSpec(unit_pitch_mm=UNIT_MM, keys=keys)


def generate_template_json(template_id: str, output_dir: Path) -> dict:
    """Generate a template JSON file from a template ID."""
    family_layouts = {
        "macropad_3x3": lambda: generate_grid_layout(3, 3, ProductFamily.MACROPAD),
        "macropad_4x4": lambda: generate_grid_layout(4, 4, ProductFamily.MACROPAD),
        "streamdeck_3x5": lambda: generate_grid_layout(3, 5, ProductFamily.STREAMDECK),
        "streamdeck_2x3": lambda: generate_grid_layout(2, 3, ProductFamily.STREAMDECK),
        "midi_25key": lambda: generate_midi_layout(25, 4),
    }

    if template_id not in family_layouts:
        raise ValueError(f"Unknown template: {template_id}")

    layout = family_layouts[template_id]()

    data = {
        "template_id": template_id,
        "name": template_id.replace("_", " ").title(),
        "layout": layout.model_dump(mode="json"),
    }

    path = output_dir / f"{template_id}.json"
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

    return data
