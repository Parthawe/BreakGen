"""
Deterministic plate geometry generator.

Converts a LayoutSpec into a switch plate with:
- MX switch cutouts (14.0mm x 14.0mm per Cherry spec [R8])
- Cherry stabilizer cutouts for keys >= 2u
- Board outline with configurable margin
- Mounting hole positions

Outputs DXF for laser cutting.

All dimensions in millimeters. Source of truth: Cherry MX datasheet.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

import ezdxf

from server.models.project import KeySpec, LayoutSpec

# --- Cherry MX Constants (from datasheet [R8]) ---

UNIT_MM = 19.05  # Standard key pitch
MX_CUTOUT_MM = 14.0  # Switch cutout size (square)

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


def _key_center_mm(key: KeySpec) -> tuple[float, float]:
    """Get key center position in mm."""
    cx = (key.x_u + key.w_u / 2) * UNIT_MM
    cy = (key.y_u + key.h_u / 2) * UNIT_MM
    return cx, cy


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

    # --- Switch cutouts ---
    for key in layout.keys:
        cx, cy = _key_center_mm(key)
        _add_rect_cutout(
            msp, cx, cy,
            MX_CUTOUT_MM, MX_CUTOUT_MM,
            rotation_deg=key.rotation_deg,
            kerf=kerf,
        )

        # --- Stabilizer cutouts ---
        if config.include_stabilizers and key.stabilizer != "none":
            offset = _stab_wire_offset(key.w_u)
            if offset is not None:
                for sign in [-1, 1]:
                    sx = cx + sign * offset
                    sy = cy
                    if key.rotation_deg:
                        sx, sy = _rotated_point(sx, sy, cx, cy, key.rotation_deg)
                    _add_rect_cutout(
                        msp, sx, sy,
                        STAB_CUTOUT_W, STAB_CUTOUT_H,
                        rotation_deg=key.rotation_deg,
                        kerf=kerf,
                    )

    # --- Board outline ---
    if not layout.keys:
        return doc

    # Compute bounding box of all key footprints
    all_corners: list[tuple[float, float]] = []
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
    if config.include_mounting_holes:
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
    if not layout.keys:
        return {"width_mm": 0, "height_mm": 0, "x0": 0, "y0": 0}

    # Use the same rotation-aware bounding logic as generate_plate_dxf
    all_x: list[float] = []
    all_y: list[float] = []
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
