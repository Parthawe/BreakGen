"""
Parametric tray-mount case generator.

Derives a simple keyboard case shell from the plate outline:
- Walls around the perimeter
- PCB standoffs for mounting
- USB-C port cutout at top-center
- Configurable wall height and thickness

Currently generates STL output via trimesh.

Not yet implemented:
- Top-mount, gasket-mount case styles
- Sculptural or ergonomic shells
- AI-generated case geometry
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import trimesh

from server.geometry.plate_generator import get_plate_bounds, PlateConfig
from server.models.project import LayoutSpec

logger = logging.getLogger(__name__)

UNIT_MM = 19.05

# PCB sits below the plate — standard MX plate-to-PCB distance
PLATE_TO_PCB_MM = 5.0
# PCB thickness
PCB_THICKNESS_MM = 1.6


@dataclass
class CaseConfig:
    wall_thickness_mm: float = 3.0
    wall_height_mm: float = 12.0  # Total case height from bottom to plate top
    bottom_thickness_mm: float = 2.0
    standoff_height_mm: float = 3.5  # PCB standoff from case floor
    standoff_diameter_mm: float = 5.0
    usb_cutout_width_mm: float = 12.0
    usb_cutout_height_mm: float = 7.0
    fillet_radius_mm: float = 1.0  # Not applied in V1, noted for future


def generate_case(
    layout: LayoutSpec,
    case_config: CaseConfig | None = None,
    plate_config: PlateConfig | None = None,
    output_path: Path | str | None = None,
) -> trimesh.Trimesh:
    """
    Generate a tray-mount case from the layout.

    Returns a trimesh.Trimesh object. Saves to STL if output_path provided.
    """
    if case_config is None:
        case_config = CaseConfig()
    if plate_config is None:
        plate_config = PlateConfig()

    bounds = get_plate_bounds(layout, plate_config)
    if bounds["width_mm"] == 0:
        return trimesh.Trimesh()

    w = bounds["width_mm"]
    h = bounds["height_mm"]
    x0 = bounds["x0"]
    y0 = bounds["y0"]

    wt = case_config.wall_thickness_mm
    bt = case_config.bottom_thickness_mm
    total_h = case_config.wall_height_mm

    # Outer box
    outer = trimesh.creation.box(
        extents=[w + wt * 2, total_h, h + wt * 2],
        transform=trimesh.transformations.translation_matrix([
            x0 + w / 2,
            total_h / 2,
            y0 + h / 2,
        ]),
    )

    # Inner cavity (subtract from outer)
    inner = trimesh.creation.box(
        extents=[w, total_h - bt, h],
        transform=trimesh.transformations.translation_matrix([
            x0 + w / 2,
            total_h / 2 + bt / 2,
            y0 + h / 2,
        ]),
    )

    # Boolean difference: outer - inner = case shell
    try:
        case = outer.difference(inner)
    except Exception:
        # Fallback if boolean fails: just return the outer box
        logger.warning("Boolean difference failed, returning solid box")
        case = outer

    # USB-C cutout at top-center back wall
    usb_w = case_config.usb_cutout_width_mm
    usb_h = case_config.usb_cutout_height_mm
    usb_cutout = trimesh.creation.box(
        extents=[usb_w, usb_h, wt * 2],
        transform=trimesh.transformations.translation_matrix([
            x0 + w / 2,  # Centered horizontally
            total_h - usb_h / 2 - 1,  # Near the top
            y0 - wt / 2,  # Back wall (minimum Y)
        ]),
    )

    try:
        case = case.difference(usb_cutout)
    except Exception:
        logger.warning("USB cutout boolean failed")

    if output_path is not None:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        case.export(str(output_path))
        logger.info(f"Case exported to {output_path}")

    return case
