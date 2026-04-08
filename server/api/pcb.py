"""PCB and firmware compilation endpoints."""

from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.database import get_db
from server.db.models import ProjectRow
from server.eda.matrix_compiler import apply_matrix_to_layout, compile_matrix
from server.firmware.qmk_generator import (
    generate_keymap,
    generate_qmk_info,
    generate_via_definition,
    write_firmware_files,
)
from server.models.project import KeyboardProject

router = APIRouter(prefix="/api/projects", tags=["pcb"])


@router.post("/{project_id}/compile/pcb")
async def compile_pcb(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Compile PCB: matrix assignment + firmware metadata.

    Full KiCad PCB generation (placement + routing) requires KiCad installed
    and is deferred to a backend worker. This endpoint handles the matrix and
    firmware compilation that can run without KiCad.
    """
    result = await db.execute(
        select(ProjectRow).where(ProjectRow.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    project = KeyboardProject(**row.data)
    if not project.layout.keys:
        raise HTTPException(status_code=400, detail="Layout has no keys")

    # 1. Compile matrix
    matrix = compile_matrix(project.layout)

    # Check if matrix fits RP2040 pin count
    total_pins = matrix.row_pins_needed + matrix.col_pins_needed
    if total_pins > 26:  # RP2040 has ~26 usable GPIO
        raise HTTPException(
            status_code=400,
            detail=f"Matrix requires {total_pins} pins ({matrix.matrix_rows}R + {matrix.matrix_cols}C), exceeds RP2040 capacity (26 GPIO)",
        )

    # 2. Apply matrix assignments back to layout
    project.layout = apply_matrix_to_layout(project.layout, matrix)

    # 3. Update PCB spec
    project.pcb.matrix_rows = matrix.matrix_rows
    project.pcb.matrix_cols = matrix.matrix_cols

    # 4. Persist updated project
    project_dict = project.model_dump(mode="json")
    row.data = project_dict
    await db.commit()

    return {
        "project_id": project_id,
        "matrix_rows": matrix.matrix_rows,
        "matrix_cols": matrix.matrix_cols,
        "total_keys": len(project.layout.keys),
        "pins_needed": total_pins,
        "status": "matrix_compiled",
        "note": "Full KiCad PCB generation requires KiCad backend worker (not yet available). Matrix and firmware metadata are ready.",
    }


@router.get("/{project_id}/firmware/info.json")
async def get_qmk_info(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get QMK info.json for this project."""
    project, matrix = await _load_project_with_matrix(project_id, db)
    return generate_qmk_info(project, matrix)


@router.get("/{project_id}/firmware/keymap.json")
async def get_keymap(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get default QWERTY keymap.json for this project."""
    project, matrix = await _load_project_with_matrix(project_id, db)
    return generate_keymap(project, matrix)


@router.get("/{project_id}/firmware/via.json")
async def get_via_definition(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get VIA keyboard definition for this project."""
    project, matrix = await _load_project_with_matrix(project_id, db)
    return generate_via_definition(project, matrix)


async def _load_project_with_matrix(
    project_id: str,
    db: AsyncSession,
) -> tuple[KeyboardProject, ...]:
    """Load project and compile matrix if not already done."""
    result = await db.execute(
        select(ProjectRow).where(ProjectRow.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    project = KeyboardProject(**row.data)
    if not project.layout.keys:
        raise HTTPException(status_code=400, detail="Layout has no keys")

    matrix = compile_matrix(project.layout)
    project.layout = apply_matrix_to_layout(project.layout, matrix)

    return project, matrix
