"""PCB and firmware compilation endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.database import get_db
from server.db.models import ProjectRevisionRow, ProjectRow
from server.eda.matrix_compiler import apply_matrix_to_layout, compile_matrix
from server.firmware.qmk_generator import (
    generate_keymap,
    generate_qmk_info,
    generate_via_definition,
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
    Bumps revision and snapshots the change.
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

    # Compile matrix
    matrix = compile_matrix(project.layout)

    total_pins = matrix.row_pins_needed + matrix.col_pins_needed
    if total_pins > 26:
        raise HTTPException(
            status_code=400,
            detail=f"Matrix requires {total_pins} pins ({matrix.matrix_rows}R + {matrix.matrix_cols}C), exceeds RP2040 capacity (26 GPIO)",
        )

    # Apply matrix assignments back to layout
    project.layout = apply_matrix_to_layout(project.layout, matrix)
    project.pcb.matrix_rows = matrix.matrix_rows
    project.pcb.matrix_cols = matrix.matrix_cols

    # Bump revision
    now = datetime.now(timezone.utc)
    project.revision += 1
    project.updated_at = now

    project_dict = project.model_dump(mode="json")

    # Persist
    row.revision = project.revision
    row.data = project_dict
    row.updated_at = now

    # Snapshot revision
    db.add(ProjectRevisionRow(
        project_id=project_id,
        revision=project.revision,
        data=project_dict,
        created_at=now,
        change_summary="PCB matrix compiled",
    ))

    await db.commit()

    return {
        "project_id": project_id,
        "revision": project.revision,
        "matrix_rows": matrix.matrix_rows,
        "matrix_cols": matrix.matrix_cols,
        "total_keys": len(project.layout.keys),
        "pins_needed": total_pins,
        "status": "matrix_compiled",
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
    """Load project and compile matrix (read-only, no persistence)."""
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
