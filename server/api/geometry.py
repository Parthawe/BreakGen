"""Geometry compilation endpoints — plate, case, keycap shells."""

import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.database import get_db
from server.db.models import ProjectRow
from server.geometry.plate_generator import (
    PlateConfig,
    generate_plate_dxf,
    get_plate_bounds,
)
from server.models.project import KeyboardProject, LayoutSpec

router = APIRouter(prefix="/api/projects", tags=["geometry"])


class PlateConfigRequest(BaseModel):
    edge_margin_mm: float = 7.5
    kerf_compensation_mm: float = 0.0
    include_stabilizers: bool = True
    include_mounting_holes: bool = True


@router.post("/{project_id}/compile/plate")
async def compile_plate(
    project_id: str,
    config: PlateConfigRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Compile plate geometry from the project's layout. Returns plate metadata."""
    result = await db.execute(
        select(ProjectRow).where(ProjectRow.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    project = KeyboardProject(**row.data)
    if not project.layout.keys:
        raise HTTPException(status_code=400, detail="Layout has no keys")

    plate_config = PlateConfig(
        edge_margin_mm=config.edge_margin_mm if config else 7.5,
        kerf_compensation_mm=config.kerf_compensation_mm if config else 0.0,
        include_stabilizers=config.include_stabilizers if config else True,
        include_mounting_holes=config.include_mounting_holes if config else True,
    )

    bounds = get_plate_bounds(project.layout, plate_config)

    return {
        "project_id": project_id,
        "revision": project.revision,
        "key_count": len(project.layout.keys),
        "plate_width_mm": round(bounds["width_mm"], 2),
        "plate_height_mm": round(bounds["height_mm"], 2),
        "status": "compiled",
    }


@router.get("/{project_id}/export/plate.dxf")
async def export_plate_dxf(
    project_id: str,
    kerf_mm: float = 0.0,
    db: AsyncSession = Depends(get_db),
):
    """Download the plate as a DXF file."""
    result = await db.execute(
        select(ProjectRow).where(ProjectRow.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    project = KeyboardProject(**row.data)
    if not project.layout.keys:
        raise HTTPException(status_code=400, detail="Layout has no keys")

    plate_config = PlateConfig(kerf_compensation_mm=kerf_mm)

    # Generate to a temp file
    tmp = tempfile.NamedTemporaryFile(suffix=".dxf", delete=False)
    generate_plate_dxf(project.layout, plate_config, output_path=tmp.name)

    return FileResponse(
        tmp.name,
        media_type="application/dxf",
        filename=f"{project.name.replace(' ', '_')}_plate.dxf",
    )
