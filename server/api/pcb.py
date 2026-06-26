"""PCB and firmware compilation endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.auth import require_user, user_scope_id
from server.config import settings
from server.db.database import get_db
from server.db.models import UserRow
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
from server.services.artifact_registry import project_state_fingerprint
from server.services.hardware_sources import summarize_project_footprint_sources
from server.services.project_state import (
    commit_project_mutation,
    invalidate_derived_state,
    load_project_state,
)
from server.services.rate_limit import enforce_rate_limit

router = APIRouter(prefix="/api/projects", tags=["pcb"])


async def enforce_compile_rate_limit(
    request: Request,
    user: UserRow = Depends(require_user),
) -> None:
    enforce_rate_limit(
        request,
        scope="project:compile",
        limit=settings.compile_rate_limit_per_minute,
        identity=f"user:{user.id}",
    )


@router.post("/{project_id}/compile/pcb")
async def compile_pcb(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
    _rate_limit: None = Depends(enforce_compile_rate_limit),
):
    return await compile_pcb_for_project(
        project_id,
        db,
        owner_user_id=user_scope_id(user),
    )


async def compile_pcb_for_project(
    project_id: str,
    db: AsyncSession,
    *,
    owner_user_id: int | None,
):
    """
    Compile PCB: matrix assignment + firmware metadata.
    Bumps revision and snapshots the change.
    """
    row, project = await load_project_state(
        db,
        project_id,
        owner_user_id=owner_user_id,
    )
    if not project.layout.elements:
        raise HTTPException(status_code=400, detail="Layout has no placed elements")

    electronics = compile_control_surface_electronics(project)
    footprint_summary = summarize_project_footprint_sources(project)
    if footprint_summary.unknown_footprints:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported footprint id(s): "
                f"{', '.join(footprint_summary.unknown_footprints)}"
            ),
        )
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

    invalidate_derived_state(project)

    # Apply matrix assignments back to layout
    apply_project_matrix(project, electronics.matrix)
    project.pcb.matrix_rows = electronics.matrix.matrix_rows
    project.pcb.matrix_cols = electronics.matrix.matrix_cols
    electronics_payload = electronics.model_dump()
    electronics_payload["footprint_source_summary"] = footprint_summary.model_dump(mode="json")
    electronics_payload["source_revision"] = project.revision + 1
    electronics_payload["source_spec_hash"] = project_state_fingerprint(project)
    project.derived["electronics"] = electronics_payload

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
        "footprint_source_summary": footprint_summary.model_dump(mode="json"),
        "source_revision": project.revision,
        "source_spec_hash": electronics_payload["source_spec_hash"],
        "status": "electronics_compiled",
    }


@router.get("/{project_id}/firmware/info.json")
async def get_qmk_info(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Get QMK info.json for this project."""
    project, matrix = await _load_project_with_matrix(project_id, db, user_scope_id(user))
    return generate_qmk_info(project, matrix)


@router.get("/{project_id}/firmware/keymap.json")
async def get_keymap(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Get default QWERTY keymap.json for this project."""
    project, matrix = await _load_project_with_matrix(project_id, db, user_scope_id(user))
    return generate_keymap(project, matrix)


@router.get("/{project_id}/firmware/via.json")
async def get_via_definition(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Get VIA keyboard definition for this project."""
    project, matrix = await _load_project_with_matrix(project_id, db, user_scope_id(user))
    return generate_via_definition(project, matrix)


@router.get("/{project_id}/firmware/control-map.json")
async def get_control_map(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Get family-native control mapping metadata for this project."""
    project, matrix = await _load_project_with_matrix(project_id, db, user_scope_id(user))
    return generate_control_map(project, matrix)


async def _load_project_with_matrix(
    project_id: str,
    db: AsyncSession,
    owner_user_id: int | None = None,
) -> tuple[KeyboardProject, ...]:
    """Load project and compile matrix (read-only, no persistence)."""
    _, project = await load_project_state(
        db,
        project_id,
        owner_user_id=owner_user_id,
    )
    if not project.layout.elements:
        raise HTTPException(status_code=400, detail="Layout has no placed elements")

    matrix, _ = compile_project_matrix(project)
    apply_project_matrix(project, matrix)

    return project, matrix
