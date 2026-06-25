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

from server.models.project import (
    ElementType,
    KeySpec,
    LayoutSpec,
    PlacedElementSpec,
    ProductFamily,
)

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
    elements: list[PlacedElementSpec] = []

    # Encoders at the top
    encoder_spacing = key_count / (encoder_count + 1)
    for i in range(encoder_count):
        elements.append(PlacedElementSpec(
            id=f"k_enc_{i}",
            element_type=ElementType.ENCODER,
            label=f"E{i + 1}",
            footprint_id="rotary_encoder",
            x_mm=round(((i + 1) * encoder_spacing - 0.5) * UNIT_MM, 2),
            y_mm=0,
            w_mm=UNIT_MM,
            h_mm=UNIT_MM,
        ))

    # Keys in a row below
    for i in range(key_count):
        elements.append(PlacedElementSpec(
            id=f"k_key_{i}",
            element_type=ElementType.KEY_SWITCH,
            label=str(i + 1),
            footprint_id="mx_switch",
            x_mm=float(i) * UNIT_MM,
            y_mm=1.5 * UNIT_MM,
            w_mm=UNIT_MM,
            h_mm=UNIT_MM,
        ))

    return LayoutSpec(unit_pitch_mm=UNIT_MM, elements=elements)


def generate_midi_pad_layout(
    rows: int = 4,
    cols: int = 4,
    encoder_count: int = 4,
) -> LayoutSpec:
    """Generate a pad-first MIDI controller layout."""
    elements: list[PlacedElementSpec] = []
    pad_size = 24.0
    pad_gap = 6.0
    pitch = pad_size + pad_gap
    grid_width = cols * pad_size + (cols - 1) * pad_gap

    encoder_spacing = grid_width / max(encoder_count, 1)
    for i in range(encoder_count):
        elements.append(PlacedElementSpec(
            id=f"enc_{i}",
            element_type=ElementType.ENCODER,
            label=f"E{i + 1}",
            footprint_id="rotary_encoder",
            x_mm=round(i * encoder_spacing + encoder_spacing / 2 - UNIT_MM / 2, 2),
            y_mm=0.0,
            w_mm=UNIT_MM,
            h_mm=UNIT_MM,
        ))

    for r in range(rows):
        for c in range(cols):
            index = r * cols + c
            elements.append(PlacedElementSpec(
                id=f"pad_{r}_{c}",
                element_type=ElementType.PAD,
                label=f"P{index + 1}",
                footprint_id="rubber_drum_pad",
                x_mm=round(c * pitch, 2),
                y_mm=round(34.0 + r * pitch, 2),
                w_mm=pad_size,
                h_mm=pad_size,
            ))

    return LayoutSpec(unit_pitch_mm=UNIT_MM, elements=elements)


def generate_gamepad_layout() -> LayoutSpec:
    """Generate a compact gamepad button cluster."""
    buttons: list[PlacedElementSpec] = [
        PlacedElementSpec(id="dpad_up", element_type=ElementType.BUTTON, label="Up", footprint_id="tact_button", x_mm=UNIT_MM, y_mm=0, w_mm=UNIT_MM, h_mm=UNIT_MM),
        PlacedElementSpec(id="dpad_left", element_type=ElementType.BUTTON, label="Left", footprint_id="tact_button", x_mm=0, y_mm=UNIT_MM, w_mm=UNIT_MM, h_mm=UNIT_MM),
        PlacedElementSpec(id="dpad_right", element_type=ElementType.BUTTON, label="Right", footprint_id="tact_button", x_mm=UNIT_MM * 2, y_mm=UNIT_MM, w_mm=UNIT_MM, h_mm=UNIT_MM),
        PlacedElementSpec(id="dpad_down", element_type=ElementType.BUTTON, label="Down", footprint_id="tact_button", x_mm=UNIT_MM, y_mm=UNIT_MM * 2, w_mm=UNIT_MM, h_mm=UNIT_MM),
        PlacedElementSpec(id="face_y", element_type=ElementType.BUTTON, label="Y", footprint_id="tact_button", x_mm=UNIT_MM * 5, y_mm=0, w_mm=UNIT_MM, h_mm=UNIT_MM),
        PlacedElementSpec(id="face_x", element_type=ElementType.BUTTON, label="X", footprint_id="tact_button", x_mm=UNIT_MM * 4, y_mm=UNIT_MM, w_mm=UNIT_MM, h_mm=UNIT_MM),
        PlacedElementSpec(id="face_b", element_type=ElementType.BUTTON, label="B", footprint_id="tact_button", x_mm=UNIT_MM * 6, y_mm=UNIT_MM, w_mm=UNIT_MM, h_mm=UNIT_MM),
        PlacedElementSpec(id="face_a", element_type=ElementType.BUTTON, label="A", footprint_id="tact_button", x_mm=UNIT_MM * 5, y_mm=UNIT_MM * 2, w_mm=UNIT_MM, h_mm=UNIT_MM),
        PlacedElementSpec(id="shoulder_l", element_type=ElementType.BUTTON, label="L1", footprint_id="tact_button", x_mm=UNIT_MM * 0.5, y_mm=-UNIT_MM * 1.1, w_mm=UNIT_MM * 1.5, h_mm=UNIT_MM * 0.75),
        PlacedElementSpec(id="shoulder_r", element_type=ElementType.BUTTON, label="R1", footprint_id="tact_button", x_mm=UNIT_MM * 5.0, y_mm=-UNIT_MM * 1.1, w_mm=UNIT_MM * 1.5, h_mm=UNIT_MM * 0.75),
        PlacedElementSpec(id="thumb_stick", element_type=ElementType.JOYSTICK, label="Stick", footprint_id="thumb_joystick", x_mm=UNIT_MM * 3.0, y_mm=UNIT_MM * 2.5, w_mm=24.0, h_mm=24.0),
    ]
    return LayoutSpec(unit_pitch_mm=UNIT_MM, elements=buttons)


def generate_pedal_controller_layout() -> LayoutSpec:
    """Generate a compact MIDI foot controller with expression input."""
    elements: list[PlacedElementSpec] = [
        PlacedElementSpec(
            id="footswitch_1",
            element_type=ElementType.BUTTON,
            label="FS1",
            footprint_id="stomp_switch",
            x_mm=0.0,
            y_mm=0.0,
            w_mm=24.0,
            h_mm=24.0,
            mounting={"panel_mount": True},
        ),
        PlacedElementSpec(
            id="footswitch_2",
            element_type=ElementType.BUTTON,
            label="FS2",
            footprint_id="stomp_switch",
            x_mm=40.0,
            y_mm=0.0,
            w_mm=24.0,
            h_mm=24.0,
            mounting={"panel_mount": True},
        ),
        PlacedElementSpec(
            id="footswitch_3",
            element_type=ElementType.BUTTON,
            label="FS3",
            footprint_id="stomp_switch",
            x_mm=80.0,
            y_mm=0.0,
            w_mm=24.0,
            h_mm=24.0,
            mounting={"panel_mount": True},
        ),
        PlacedElementSpec(
            id="expression_1",
            element_type=ElementType.SLIDER,
            label="EXP",
            footprint_id="expression_pedal",
            x_mm=10.0,
            y_mm=46.0,
            w_mm=84.0,
            h_mm=28.0,
            mounting={"travel_axis": "x"},
        ),
    ]
    return LayoutSpec(unit_pitch_mm=UNIT_MM, elements=elements)


def generate_breath_controller_layout() -> LayoutSpec:
    """Generate a compact breath-controller instrument proof layout."""
    elements: list[PlacedElementSpec] = [
        PlacedElementSpec(
            id="breath_pressure",
            element_type=ElementType.SENSOR,
            label="Breath",
            footprint_id="pressure_sensor",
            x_mm=20.0,
            y_mm=0.0,
            w_mm=28.0,
            h_mm=16.0,
            electrical_ref="midi_cc_2",
            mounting={"air_path": True},
        ),
        PlacedElementSpec(
            id="bite_pressure",
            element_type=ElementType.SENSOR,
            label="Bite",
            footprint_id="bite_sensor",
            x_mm=56.0,
            y_mm=0.0,
            w_mm=24.0,
            h_mm=14.0,
            electrical_ref="midi_cc_1",
            mounting={"mouthpiece_coupled": True},
        ),
        PlacedElementSpec(
            id="breath_mic",
            element_type=ElementType.MICROPHONE,
            label="Noise",
            footprint_id="mems_microphone",
            x_mm=88.0,
            y_mm=2.0,
            w_mm=12.0,
            h_mm=12.0,
            electrical_ref="breath_noise_gate",
        ),
        PlacedElementSpec(
            id="octave_down",
            element_type=ElementType.BUTTON,
            label="Oct-",
            footprint_id="tact_button",
            x_mm=0.0,
            y_mm=34.0,
            w_mm=16.0,
            h_mm=16.0,
        ),
        PlacedElementSpec(
            id="octave_up",
            element_type=ElementType.BUTTON,
            label="Oct+",
            footprint_id="tact_button",
            x_mm=24.0,
            y_mm=34.0,
            w_mm=16.0,
            h_mm=16.0,
        ),
        PlacedElementSpec(
            id="status_display",
            element_type=ElementType.DISPLAY,
            label="Status",
            footprint_id="oled_128x64",
            x_mm=52.0,
            y_mm=28.0,
            w_mm=42.0,
            h_mm=20.0,
        ),
    ]
    return LayoutSpec(unit_pitch_mm=UNIT_MM, elements=elements)


def generate_streamdeck_display_layout(
    rows: int = 3,
    cols: int = 5,
) -> LayoutSpec:
    """Generate a stream-deck-style surface with a status display and encoder."""
    grid = generate_grid_layout(rows, cols, ProductFamily.STREAMDECK)
    elements = [PlacedElementSpec(**element.model_dump(mode="json")) for element in grid.elements]

    pitch_mm = STREAMDECK_PITCH_MM
    grid_width = ((cols - 1) * pitch_mm) + UNIT_MM
    display_w = 56.0
    display_h = 28.0
    display_x = round((grid_width - display_w) / 2, 2)
    display_y = -40.0
    encoder_size = 22.0

    elements.append(
        PlacedElementSpec(
            id="status_display",
            element_type=ElementType.DISPLAY,
            label="Status",
            footprint_id="tft_round_240",
            x_mm=display_x,
            y_mm=display_y,
            w_mm=display_w,
            h_mm=display_h,
        )
    )
    elements.append(
        PlacedElementSpec(
            id="scene_encoder",
            element_type=ElementType.ENCODER,
            label="Scene",
            footprint_id="rotary_encoder",
            x_mm=round(grid_width - encoder_size, 2),
            y_mm=display_y + 3.0,
            w_mm=encoder_size,
            h_mm=encoder_size,
        )
    )

    return LayoutSpec(unit_pitch_mm=UNIT_MM, elements=elements)


def generate_handheld_companion_layout() -> LayoutSpec:
    """Generate a compact handheld companion with display, power, audio, mic, and controls."""
    elements: list[PlacedElementSpec] = [
        PlacedElementSpec(id="main_display", element_type=ElementType.DISPLAY, label="Display", footprint_id="oled_128x64", x_mm=44.0, y_mm=10.0, w_mm=72.0, h_mm=48.0),
        PlacedElementSpec(id="dpad_up", element_type=ElementType.BUTTON, label="Up", footprint_id="tact_button", x_mm=12.0, y_mm=72.0, w_mm=16.0, h_mm=16.0),
        PlacedElementSpec(id="dpad_left", element_type=ElementType.BUTTON, label="Left", footprint_id="tact_button", x_mm=0.0, y_mm=88.0, w_mm=16.0, h_mm=16.0),
        PlacedElementSpec(id="dpad_right", element_type=ElementType.BUTTON, label="Right", footprint_id="tact_button", x_mm=24.0, y_mm=88.0, w_mm=16.0, h_mm=16.0),
        PlacedElementSpec(id="dpad_down", element_type=ElementType.BUTTON, label="Down", footprint_id="tact_button", x_mm=12.0, y_mm=104.0, w_mm=16.0, h_mm=16.0),
        PlacedElementSpec(id="face_y", element_type=ElementType.BUTTON, label="Y", footprint_id="tact_button", x_mm=138.0, y_mm=72.0, w_mm=16.0, h_mm=16.0),
        PlacedElementSpec(id="face_x", element_type=ElementType.BUTTON, label="X", footprint_id="tact_button", x_mm=126.0, y_mm=88.0, w_mm=16.0, h_mm=16.0),
        PlacedElementSpec(id="face_b", element_type=ElementType.BUTTON, label="B", footprint_id="tact_button", x_mm=150.0, y_mm=88.0, w_mm=16.0, h_mm=16.0),
        PlacedElementSpec(id="face_a", element_type=ElementType.BUTTON, label="A", footprint_id="tact_button", x_mm=138.0, y_mm=104.0, w_mm=16.0, h_mm=16.0),
        PlacedElementSpec(id="speaker_main", element_type=ElementType.SPEAKER, label="Speaker", footprint_id="speaker_40mm", x_mm=10.0, y_mm=126.0, w_mm=40.0, h_mm=40.0),
        PlacedElementSpec(id="voice_mic", element_type=ElementType.MICROPHONE, label="Mic", footprint_id="mems_microphone", x_mm=76.0, y_mm=128.0, w_mm=12.0, h_mm=12.0),
        PlacedElementSpec(id="battery_pack", element_type=ElementType.BATTERY, label="Battery", footprint_id="lipo_1000mah", x_mm=116.0, y_mm=126.0, w_mm=50.0, h_mm=34.0),
        PlacedElementSpec(id="usb_c", element_type=ElementType.USB_PORT, label="USB-C", footprint_id="usb_c_port", x_mm=72.0, y_mm=168.0, w_mm=20.0, h_mm=8.0),
    ]
    return LayoutSpec(unit_pitch_mm=UNIT_MM, elements=elements)


def generate_template_json(template_id: str, output_dir: Path) -> dict:
    """Generate a template JSON file from a template ID."""
    family_layouts = {
        "macropad_3x3": lambda: generate_grid_layout(3, 3, ProductFamily.MACROPAD),
        "macropad_4x4": lambda: generate_grid_layout(4, 4, ProductFamily.MACROPAD),
        "streamdeck_3x5": lambda: generate_grid_layout(3, 5, ProductFamily.STREAMDECK),
        "streamdeck_2x3": lambda: generate_grid_layout(2, 3, ProductFamily.STREAMDECK),
        "streamdeck_display_3x5": generate_streamdeck_display_layout,
        "midi_25key": lambda: generate_midi_layout(25, 4),
        "midi_pad_4x4": generate_midi_pad_layout,
        "gamepad_compact": generate_gamepad_layout,
        "pedal_controller_3switch": generate_pedal_controller_layout,
        "breath_controller_basic": generate_breath_controller_layout,
        "handheld_companion_compact": generate_handheld_companion_layout,
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
