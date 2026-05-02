"""PCB and firmware compilation endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.database import get_db
from server.eda.control_surface_electronics import (
    apply_project_matrix,
    compile_control_surface_electronics,
    compile_project_matrix,
)
from server.firmware.qmk_generator import (
    generate_control_map,
    generate_keymap,
    generate_qmk_info,
    generate_via_definition,
)
from server.models.project import KeyboardProject
from server.services.project_state import (
    commit_project_mutation,
    invalidate_derived_state,
    load_project_state,
)

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
    row, project = await load_project_state(db, project_id)
    if not project.layout.elements:
        raise HTTPException(status_code=400, detail="Layout has no placed elements")

    electronics = compile_control_surface_electronics(project)
    if electronics.total_pins > electronics.gpio_budget:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Electronics compile requires {electronics.total_pins} GPIO "
                f"({electronics.matrix_pins} matrix + {electronics.direct_pins} direct), "
                f"exceeds {project.pcb.controller.value.upper()} capacity "
                f"({electronics.gpio_budget})"
            ),
        )

    # Apply matrix assignments back to layout
    apply_project_matrix(project, electronics.matrix)
    project.pcb.matrix_rows = electronics.matrix.matrix_rows
    project.pcb.matrix_cols = electronics.matrix.matrix_cols
    project.derived["electronics"] = electronics.model_dump()
    invalidate_derived_state(project)

    await commit_project_mutation(
        db,
        row,
        project,
        change_summary="Electronics metadata compiled",
    )

    return {
        "project_id": project_id,
        "revision": project.revision,
        "matrix_rows": electronics.matrix.matrix_rows,
        "matrix_cols": electronics.matrix.matrix_cols,
        "matrix_strategy": electronics.matrix_strategy,
        "matrix_controls": electronics.matrix_control_count,
        "direct_controls": electronics.direct_control_count,
        "matrix_pins": electronics.matrix_pins,
        "direct_pins": electronics.direct_pins,
        "pins_needed": electronics.total_pins,
        "gpio_budget": electronics.gpio_budget,
        "gpio_remaining": electronics.gpio_remaining,
        "firmware_target": electronics.firmware_target,
        "control_protocol": electronics.control_protocol,
        "direct_pin_usage": electronics.model_dump()["direct_pin_usage"],
        "status": "electronics_compiled",
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


@router.get("/{project_id}/firmware/control-map.json")
async def get_control_map(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get family-native control mapping metadata for this project."""
    project, matrix = await _load_project_with_matrix(project_id, db)
    return generate_control_map(project, matrix)


async def _load_project_with_matrix(
    project_id: str,
    db: AsyncSession,
) -> tuple[KeyboardProject, ...]:
    """Load project and compile matrix (read-only, no persistence)."""
    _, project = await load_project_state(db, project_id)
    if not project.layout.elements:
        raise HTTPException(status_code=400, detail="Layout has no placed elements")

    matrix, _ = compile_project_matrix(project)
    apply_project_matrix(project, matrix)

    return project, matrix
