"""
Deterministic mechanical panel generator.

Converts a LayoutSpec into a family-aware laser-cut panel with:
- MX switch cutouts for keyboard-style controls
- Control-surface cutouts for encoders, buttons, displays, and joysticks
- Board/panel outline with configurable margin
- Mounting hole positions

Outputs DXF for laser cutting.

All dimensions in millimeters. Cherry MX cutout dimensions remain the source
of truth for keyboard switch apertures; non-keyboard controls use conservative
panel defaults until family-specific hardware libraries are deeper.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

import ezdxf

from server.models.project import ElementType, KeySpec, LayoutSpec, PlacedElementSpec

# --- Cherry MX Constants (from datasheet [R8]) ---

UNIT_MM = 19.05  # Standard key pitch
MX_CUTOUT_MM = 14.0  # Switch cutout size (square)
ENCODER_SHAFT_HOLE_MM = 7.2
BUTTON_APERTURE_INSET_MM = 3.5
BUTTON_SLOT_INSET_X_MM = 6.0
BUTTON_SLOT_INSET_Y_MM = 4.0
DISPLAY_BEZEL_MARGIN_MM = 2.0
JOYSTICK_SHAFT_HOLE_MM = 16.0
JOYSTICK_MOUNT_HOLE_DIAMETER_MM = 2.4
JOYSTICK_MOUNT_HOLE_INSET_MM = 4.5
SLIDER_SLOT_INSET_MM = 4.0
USB_PORT_SLOT_MARGIN_MM = 1.0
SPEAKER_GRILLE_HOLE_MM = 3.0

# Cherry stabilizer wire positions (center-to-center from key center)
# Measured from Cherry spec and community-verified dimensions
STAB_OFFSETS: dict[str, float] = {
    # key_width_u: wire_spacing_mm (distance from key center to each wire)
    "2":    11.938,  # 2u (e.g., Backspace on some layouts)
    "2.25": 11.938,  # 2.25u (Left Shift, Enter)
    "2.75": 11.938,  # 2.75u (Right Shift)
    "6.25": 50.0,    # 6.25u (Spacebar)
    "7":    57.15,   # 7u (Spacebar alt)
}

STAB_CUTOUT_W = 6.65   # Stabilizer housing cutout width
STAB_CUTOUT_H = 12.3   # Stabilizer housing cutout height

# Mounting holes
MOUNT_HOLE_DIAMETER = 2.5  # M2 screw
MOUNT_HOLE_MARGIN = 6.0    # Distance from board edge

DEFAULT_EDGE_MARGIN_MM = 7.5  # Margin from outermost key edge to board edge
DEFAULT_KERF_MM = 0.0  # Kerf compensation (0 = no compensation, user configures)


@dataclass
class PlateConfig:
    edge_margin_mm: float = DEFAULT_EDGE_MARGIN_MM
    kerf_compensation_mm: float = DEFAULT_KERF_MM
    include_stabilizers: bool = True
    include_mounting_holes: bool = True


def _key_as_element(key: KeySpec, unit_pitch_mm: float) -> PlacedElementSpec:
    return PlacedElementSpec(
        id=key.id,
        element_type=ElementType.KEY_SWITCH,
        label=key.label,
        footprint_id="mx_switch",
        x_mm=key.x_u * unit_pitch_mm,
        y_mm=key.y_u * unit_pitch_mm,
        w_mm=key.w_u * unit_pitch_mm,
        h_mm=key.h_u * unit_pitch_mm,
        rotation_deg=key.rotation_deg,
        stabilizer=key.stabilizer,
        keycap_asset_id=key.keycap_asset_id,
        row=key.row,
        col=key.col,
        metadata={
            "rotation_origin_x_u": key.rotation_origin_x_u,
            "rotation_origin_y_u": key.rotation_origin_y_u,
        },
    )


def _key_center_mm(key: KeySpec) -> tuple[float, float]:
    """Get key center position in mm."""
    cx = (key.x_u + key.w_u / 2) * UNIT_MM
    cy = (key.y_u + key.h_u / 2) * UNIT_MM
    return cx, cy


def _element_center_mm(element: PlacedElementSpec) -> tuple[float, float]:
    return element.x_mm + element.w_mm / 2, element.y_mm + element.h_mm / 2


def _authoritative_elements(layout: LayoutSpec) -> list[PlacedElementSpec]:
    if layout.elements:
        return list(layout.elements)
    return [_key_as_element(key, layout.unit_pitch_mm) for key in layout.keys]


def _rotated_point(
    x: float, y: float, cx: float, cy: float, angle_deg: float
) -> tuple[float, float]:
    """Rotate point (x,y) around (cx,cy) by angle_deg."""
    if angle_deg == 0:
        return x, y
    rad = math.radians(angle_deg)
    dx, dy = x - cx, y - cy
    rx = dx * math.cos(rad) - dy * math.sin(rad) + cx
    ry = dx * math.sin(rad) + dy * math.cos(rad) + cy
    return rx, ry


def _add_rect_cutout(
    msp, cx: float, cy: float, w: float, h: float,
    rotation_deg: float = 0, kerf: float = 0
):
    """Add a rectangular cutout centered at (cx, cy) with optional rotation and kerf."""
    hw = (w + kerf) / 2
    hh = (h + kerf) / 2
    corners = [
        (cx - hw, cy - hh),
        (cx + hw, cy - hh),
        (cx + hw, cy + hh),
        (cx - hw, cy + hh),
    ]
    if rotation_deg != 0:
        corners = [_rotated_point(x, y, cx, cy, rotation_deg) for x, y in corners]
    corners.append(corners[0])  # Close the polygon
    msp.add_lwpolyline(corners, close=True, dxfattribs={"layer": "Cutouts"})


def _add_circle_cutout(msp, cx: float, cy: float, diameter: float, layer: str = "Cutouts"):
    msp.add_circle((cx, cy), diameter / 2, dxfattribs={"layer": layer})


def _element_corners_mm(element: PlacedElementSpec) -> list[tuple[float, float]]:
    corners = [
        (element.x_mm, element.y_mm),
        (element.x_mm + element.w_mm, element.y_mm),
        (element.x_mm + element.w_mm, element.y_mm + element.h_mm),
        (element.x_mm, element.y_mm + element.h_mm),
    ]
    if element.rotation_deg:
        cx, cy = _element_center_mm(element)
        corners = [_rotated_point(x, y, cx, cy, element.rotation_deg) for x, y in corners]
    return corners


def _panel_geometry_kind(elements: list[PlacedElementSpec]) -> str:
    if not elements:
        return "switch_plate"
    element_types = {element.element_type for element in elements}
    has_switches = ElementType.KEY_SWITCH in element_types
    has_panel_controls = bool(element_types - {ElementType.KEY_SWITCH})
    if has_switches and has_panel_controls:
        return "hybrid_control_panel"
    if has_panel_controls:
        return "control_panel"
    return "switch_plate"


def _stab_wire_offset(width_u: float) -> float | None:
    """Get stabilizer wire offset for a given key width."""
    # Look up exact match first, then find closest >= 2u
    key = str(width_u).rstrip("0").rstrip(".")
    if key in STAB_OFFSETS:
        return STAB_OFFSETS[key]
    # For non-standard widths >= 2u, use 2u spacing
    if width_u >= 2.0:
        return STAB_OFFSETS["2"]
    return None


def _add_button_cutout(msp, element: PlacedElementSpec, kerf: float):
    cx, cy = _element_center_mm(element)
    aspect_ratio = max(element.w_mm, element.h_mm) / max(min(element.w_mm, element.h_mm), 0.001)
    if aspect_ratio >= 1.3:
        _add_rect_cutout(
            msp,
            cx,
            cy,
            max(element.w_mm - BUTTON_SLOT_INSET_X_MM, 8.0),
            max(element.h_mm - BUTTON_SLOT_INSET_Y_MM, 6.0),
            rotation_deg=element.rotation_deg,
            kerf=kerf,
        )
        return
    _add_circle_cutout(
        msp,
        cx,
        cy,
        max(min(element.w_mm, element.h_mm) - BUTTON_APERTURE_INSET_MM * 2, 8.0) + kerf,
    )


def _add_display_cutout(msp, element: PlacedElementSpec, kerf: float):
    cx, cy = _element_center_mm(element)
    _add_rect_cutout(
        msp,
        cx,
        cy,
        max(element.w_mm - DISPLAY_BEZEL_MARGIN_MM * 2, 8.0),
        max(element.h_mm - DISPLAY_BEZEL_MARGIN_MM * 2, 6.0),
        rotation_deg=element.rotation_deg,
        kerf=kerf,
    )


def _add_slider_cutout(msp, element: PlacedElementSpec, kerf: float):
    cx, cy = _element_center_mm(element)
    horizontal = element.w_mm >= element.h_mm
    _add_rect_cutout(
        msp,
        cx,
        cy,
        max(element.w_mm - SLIDER_SLOT_INSET_MM * 2, 12.0) if horizontal else max(element.w_mm * 0.4, 6.0),
        max(element.h_mm * 0.4, 6.0) if horizontal else max(element.h_mm - SLIDER_SLOT_INSET_MM * 2, 12.0),
        rotation_deg=element.rotation_deg,
        kerf=kerf,
    )


def _add_usb_port_cutout(msp, element: PlacedElementSpec, kerf: float):
    cx, cy = _element_center_mm(element)
    _add_rect_cutout(
        msp,
        cx,
        cy,
        max(element.w_mm - USB_PORT_SLOT_MARGIN_MM * 2, 8.0),
        max(element.h_mm - USB_PORT_SLOT_MARGIN_MM * 2, 3.5),
        rotation_deg=element.rotation_deg,
        kerf=kerf,
    )


def _add_speaker_grille_cutout(msp, element: PlacedElementSpec, kerf: float):
    cx, cy = _element_center_mm(element)
    hole_diameter = max(SPEAKER_GRILLE_HOLE_MM + kerf, 2.4)
    ring_radius = max(min(element.w_mm, element.h_mm) * 0.22, 6.0)
    _add_circle_cutout(msp, cx, cy, hole_diameter)
    for angle_deg in range(0, 360, 60):
        angle = math.radians(angle_deg)
        hx = cx + math.cos(angle) * ring_radius
        hy = cy + math.sin(angle) * ring_radius
        _add_circle_cutout(msp, hx, hy, hole_diameter)


def _add_joystick_cutout(msp, element: PlacedElementSpec, kerf: float, include_mounting_holes: bool):
    cx, cy = _element_center_mm(element)
    _add_circle_cutout(
        msp,
        cx,
        cy,
        min(JOYSTICK_SHAFT_HOLE_MM, min(element.w_mm, element.h_mm) - 6.0) + kerf,
    )
    if not include_mounting_holes:
        return
    offset_x = max(element.w_mm / 2 - JOYSTICK_MOUNT_HOLE_INSET_MM, 0)
    offset_y = max(element.h_mm / 2 - JOYSTICK_MOUNT_HOLE_INSET_MM, 0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            hx = cx + sx * offset_x
            hy = cy + sy * offset_y
            if element.rotation_deg:
                hx, hy = _rotated_point(hx, hy, cx, cy, element.rotation_deg)
            _add_circle_cutout(
                msp,
                hx,
                hy,
                JOYSTICK_MOUNT_HOLE_DIAMETER_MM,
                layer="MountingHoles",
            )


def summarize_plate_geometry(layout: LayoutSpec, config: PlateConfig | None = None) -> dict:
    if config is None:
        config = PlateConfig()

    elements = _authoritative_elements(layout)
    key_switches = [element for element in elements if element.element_type == ElementType.KEY_SWITCH]
    buttons = [element for element in elements if element.element_type == ElementType.BUTTON]
    encoders = [element for element in elements if element.element_type == ElementType.ENCODER]
    displays = [element for element in elements if element.element_type == ElementType.DISPLAY]
    joysticks = [element for element in elements if element.element_type == ElementType.JOYSTICK]
    sliders = [element for element in elements if element.element_type == ElementType.SLIDER]
    speakers = [element for element in elements if element.element_type == ElementType.SPEAKER]
    usb_ports = [element for element in elements if element.element_type == ElementType.USB_PORT]
    stabilizer_cutouts = 0
    if config.include_stabilizers:
        stabilizer_cutouts = sum(
            2
            for element in key_switches
            if element.stabilizer != "none" and _stab_wire_offset(element.w_mm / UNIT_MM) is not None
        )
    mounting_holes = 0
    if config.include_mounting_holes and elements:
        mounting_holes = 5 + len(joysticks) * 4

    return {
        "geometry_kind": _panel_geometry_kind(elements),
        "element_count": len(elements),
        "key_count": len(layout.keys),
        "cutout_summary": {
            "key_switch": len(key_switches),
            "stabilizer": stabilizer_cutouts,
            "button": len(buttons),
            "encoder": len(encoders),
            "display": len(displays),
            "joystick": len(joysticks),
            "slider": len(sliders),
            "speaker": len(speakers),
            "usb_port": len(usb_ports),
        },
        "mounting_hole_count": mounting_holes,
    }


def generate_plate_dxf(
    layout: LayoutSpec,
    config: PlateConfig | None = None,
    output_path: Path | str | None = None,
) -> ezdxf.document.Drawing:
    """
    Generate a plate DXF from a layout specification.

    Returns an ezdxf Drawing object. If output_path is provided, also saves to disk.
    """
    if config is None:
        config = PlateConfig()

    doc = ezdxf.new("R2010")
    msp = doc.modelspace()

    # Set up layers
    doc.layers.add("Cutouts", color=1)      # Red — switch/stab cutouts
    doc.layers.add("Outline", color=5)       # Blue — board outline
    doc.layers.add("MountingHoles", color=3) # Green — mounting holes

    kerf = config.kerf_compensation_mm

    elements = _authoritative_elements(layout)
    key_switch_elements = [element for element in elements if element.element_type == ElementType.KEY_SWITCH]

    # --- Switch cutouts ---
    for element in key_switch_elements:
        cx, cy = _element_center_mm(element)
        _add_rect_cutout(
            msp, cx, cy,
            MX_CUTOUT_MM, MX_CUTOUT_MM,
            rotation_deg=element.rotation_deg,
            kerf=kerf,
        )

        # --- Stabilizer cutouts ---
        if config.include_stabilizers and element.stabilizer != "none":
            offset = _stab_wire_offset(element.w_mm / UNIT_MM)
            if offset is not None:
                for sign in [-1, 1]:
                    sx = cx + sign * offset
                    sy = cy
                    if element.rotation_deg:
                        sx, sy = _rotated_point(sx, sy, cx, cy, element.rotation_deg)
                    _add_rect_cutout(
                        msp, sx, sy,
                        STAB_CUTOUT_W, STAB_CUTOUT_H,
                        rotation_deg=element.rotation_deg,
                        kerf=kerf,
                    )

    # --- Generic element cutouts ---
    for element in elements:
        if element.element_type == ElementType.ENCODER:
            cx, cy = _element_center_mm(element)
            _add_circle_cutout(msp, cx, cy, ENCODER_SHAFT_HOLE_MM + kerf)
        elif element.element_type == ElementType.BUTTON:
            _add_button_cutout(msp, element, kerf)
        elif element.element_type == ElementType.DISPLAY:
            _add_display_cutout(msp, element, kerf)
        elif element.element_type == ElementType.JOYSTICK:
            _add_joystick_cutout(msp, element, kerf, config.include_mounting_holes)
        elif element.element_type == ElementType.SLIDER:
            _add_slider_cutout(msp, element, kerf)
        elif element.element_type == ElementType.USB_PORT:
            _add_usb_port_cutout(msp, element, kerf)
        elif element.element_type == ElementType.SPEAKER:
            _add_speaker_grille_cutout(msp, element, kerf)

    # --- Board outline ---
    if not elements and not layout.keys:
        return doc

    # Compute bounding box of all placed elements
    all_corners: list[tuple[float, float]] = []
    if elements:
        for element in elements:
            all_corners.extend(_element_corners_mm(element))
    else:
        for key in layout.keys:
            x0 = key.x_u * UNIT_MM
            y0 = key.y_u * UNIT_MM
            x1 = (key.x_u + key.w_u) * UNIT_MM
            y1 = (key.y_u + key.h_u) * UNIT_MM
            corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
            if key.rotation_deg:
                cx, cy = _key_center_mm(key)
                corners = [_rotated_point(x, y, cx, cy, key.rotation_deg) for x, y in corners]
            all_corners.extend(corners)

    xs = [c[0] for c in all_corners]
    ys = [c[1] for c in all_corners]
    margin = config.edge_margin_mm

    outline_x0 = min(xs) - margin
    outline_y0 = min(ys) - margin
    outline_x1 = max(xs) + margin
    outline_y1 = max(ys) + margin

    # Rectangular board outline
    msp.add_lwpolyline(
        [
            (outline_x0, outline_y0),
            (outline_x1, outline_y0),
            (outline_x1, outline_y1),
            (outline_x0, outline_y1),
        ],
        close=True,
        dxfattribs={"layer": "Outline"},
    )

    # --- Mounting holes ---
    if config.include_mounting_holes and elements:
        hole_r = MOUNT_HOLE_DIAMETER / 2
        hole_m = MOUNT_HOLE_MARGIN
        # 4 corner holes + 1 center
        hole_positions = [
            (outline_x0 + hole_m, outline_y0 + hole_m),
            (outline_x1 - hole_m, outline_y0 + hole_m),
            (outline_x1 - hole_m, outline_y1 - hole_m),
            (outline_x0 + hole_m, outline_y1 - hole_m),
            ((outline_x0 + outline_x1) / 2, (outline_y0 + outline_y1) / 2),
        ]
        for hx, hy in hole_positions:
            msp.add_circle(
                (hx, hy), hole_r, dxfattribs={"layer": "MountingHoles"}
            )

    if output_path is not None:
        doc.saveas(str(output_path))

    return doc


def get_plate_bounds(layout: LayoutSpec, config: PlateConfig | None = None) -> dict:
    """Get plate bounding box dimensions in mm, accounting for rotated keys."""
    if config is None:
        config = PlateConfig()
    elements = _authoritative_elements(layout)
    if not elements and not layout.keys:
        return {"width_mm": 0, "height_mm": 0, "x0": 0, "y0": 0}

    # Use the same rotation-aware bounding logic as generate_plate_dxf
    all_x: list[float] = []
    all_y: list[float] = []
    if elements:
        for element in elements:
            for px, py in _element_corners_mm(element):
                all_x.append(px)
                all_y.append(py)
    else:
        for key in layout.keys:
            x0 = key.x_u * UNIT_MM
            y0 = key.y_u * UNIT_MM
            x1 = (key.x_u + key.w_u) * UNIT_MM
            y1 = (key.y_u + key.h_u) * UNIT_MM
            corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
            if key.rotation_deg:
                cx, cy = _key_center_mm(key)
                corners = [_rotated_point(px, py, cx, cy, key.rotation_deg) for px, py in corners]
            for px, py in corners:
                all_x.append(px)
                all_y.append(py)

    margin = config.edge_margin_mm
    x0 = min(all_x) - margin
    y0 = min(all_y) - margin
    x1 = max(all_x) + margin
    y1 = max(all_y) + margin

    return {
        "width_mm": x1 - x0,
        "height_mm": y1 - y0,
        "x0": x0,
        "y0": y0,
        "x1": x1,
        "y1": y1,
    }
