"""
Mesh normalization pipeline for AI-generated keycap assets.

Currently implemented:
1. Scale normalization — fit to standard keycap bounding box
2. Bottom alignment — origin at center-bottom of mesh
3. Decimation — reduce face count for real-time preview
4. Watertight validation — check manifold status for 3D printing

Not yet implemented (deferred):
- Orientation alignment via PCA on surface normals
- Cherry MX stem cavity boolean (requires Manifold3D)
- Style-on-shell approach (applying AI surface to deterministic shell)

Spec reference: PRODUCT_SPEC.md section 11.4
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

# Cherry MX keycap dimensions (mm)
KEYCAP_1U_WIDTH = 18.0
KEYCAP_1U_DEPTH = 18.0
KEYCAP_HEIGHT = 8.0
UNIT_MM = 19.05

# Stem dimensions (Cherry MX cross)
STEM_CROSS_WIDTH = 4.0  # mm
STEM_CROSS_THICKNESS = 1.17  # mm
STEM_DEPTH = 3.6  # mm
STEM_TOLERANCE = 0.05  # mm added per arm for press-fit

# Validation thresholds
MIN_WALL_THICKNESS_RESIN = 1.2  # mm
MIN_WALL_THICKNESS_FDM = 1.5  # mm
PREVIEW_TARGET_FACES = 3000
EXPORT_MAX_FACES = 200000


@dataclass
class NormalizationResult:
    """Result of mesh normalization."""

    success: bool
    preview_path: str | None = None
    export_path: str | None = None
    face_count_original: int = 0
    face_count_preview: int = 0
    is_watertight: bool = False
    bounding_box_mm: tuple[float, float, float] = (0, 0, 0)
    errors: list[str] | None = None


def normalize_mesh(
    input_path: str | Path,
    output_dir: str | Path,
    asset_id: str,
    unit_width: float = 1.0,
) -> NormalizationResult:
    """
    Full normalization pipeline for an AI-generated keycap mesh.

    Returns paths to preview and export meshes plus validation metadata.
    """
    try:
        import trimesh
    except ImportError:
        return NormalizationResult(
            success=False,
            errors=["trimesh not installed. Install with: pip install trimesh"],
        )

    input_path = Path(input_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    errors: list[str] = []

    # Load mesh
    try:
        mesh = trimesh.load(str(input_path), force="mesh")
    except Exception as e:
        return NormalizationResult(success=False, errors=[f"Failed to load mesh: {e}"])

    if not hasattr(mesh, "vertices") or len(mesh.vertices) == 0:
        return NormalizationResult(success=False, errors=["Mesh has no vertices"])

    original_faces = len(mesh.faces)
    logger.info(f"Loaded mesh: {original_faces} faces")

    # 1. Scale normalization — fit to keycap bounding box
    target_w = unit_width * KEYCAP_1U_WIDTH
    target_d = KEYCAP_1U_DEPTH
    target_h = KEYCAP_HEIGHT

    extents = mesh.bounding_box.extents
    scale_factors = [
        target_w / extents[0] if extents[0] > 0 else 1,
        target_h / extents[1] if extents[1] > 0 else 1,
        target_d / extents[2] if extents[2] > 0 else 1,
    ]
    uniform_scale = min(scale_factors)  # Preserve aspect ratio
    mesh.apply_scale(uniform_scale)

    # 2. Center and align — origin at bottom center
    mesh.vertices -= mesh.centroid
    mesh.vertices[:, 1] -= mesh.vertices[:, 1].min()  # Bottom at y=0

    # 3. Watertight check
    is_watertight = mesh.is_watertight
    if not is_watertight:
        # Attempt basic repair
        trimesh.repair.fix_normals(mesh)
        trimesh.repair.fill_holes(mesh)
        is_watertight = mesh.is_watertight
        if not is_watertight:
            errors.append("Mesh is not watertight after repair. May have printing issues.")

    # 4. Decimation for preview
    preview_mesh = mesh.copy()
    if len(preview_mesh.faces) > PREVIEW_TARGET_FACES:
        # Simple decimation — reduce to target face count
        ratio = PREVIEW_TARGET_FACES / len(preview_mesh.faces)
        preview_mesh = preview_mesh.simplify_quadric_decimation(PREVIEW_TARGET_FACES)
        logger.info(f"Decimated: {original_faces} -> {len(preview_mesh.faces)} faces")

    # 5. Export meshes
    preview_path = output_dir / f"{asset_id}_preview.glb"
    export_path = output_dir / f"{asset_id}_export.stl"

    preview_mesh.export(str(preview_path))
    mesh.export(str(export_path))

    bb = mesh.bounding_box.extents

    return NormalizationResult(
        success=True,
        preview_path=str(preview_path),
        export_path=str(export_path),
        face_count_original=original_faces,
        face_count_preview=len(preview_mesh.faces),
        is_watertight=is_watertight,
        bounding_box_mm=(float(bb[0]), float(bb[1]), float(bb[2])),
        errors=errors if errors else None,
    )
