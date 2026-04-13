"""Project CRUD endpoints."""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.config import settings
from server.db.database import get_db
from server.db.models import ProjectRevisionRow, ProjectRow
from server.models.project import KeyboardProject, LayoutSpec, ProductFamily, ProjectStatus
from server.models.supported_configs import SUPPORTED_SWITCHES

router = APIRouter(prefix="/api/projects", tags=["projects"])


class CreateProjectRequest(BaseModel):
    name: str = "Untitled Project"
    template_id: Optional[str] = None
    product_family: str = "keyboard"


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    layout: Optional[LayoutSpec] = None
    switch_part_id: Optional[str] = None
    style_prompt: Optional[str] = None
    expected_revision: Optional[int] = None  # Optimistic lock: reject if stale


_VALID_SWITCH_IDS = frozenset(s.part_id for s in SUPPORTED_SWITCHES)


def _generate_id() -> str:
    return f"bg_{uuid.uuid4().hex[:12]}"


def _load_template(template_id: str) -> dict:
    template_path = Path(settings.templates_dir) / f"{template_id}.json"
    if not template_path.exists():
        raise HTTPException(
            status_code=400, detail=f"Template '{template_id}' not found"
        )
    with open(template_path) as f:
        return json.load(f)


@router.post("/", status_code=201)
async def create_project(req: CreateProjectRequest, db: AsyncSession = Depends(get_db)):
    """Create a new keyboard project, optionally from a template."""
    project_id = _generate_id()
    now = datetime.now(timezone.utc)

    # Validate product family
    try:
        family = ProductFamily(req.product_family)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown product family: {req.product_family}")

    project = KeyboardProject(
        project_id=project_id,
        product_family=family,
        name=req.name,
        revision=1,
        status=ProjectStatus.DRAFT,
        created_at=now,
        updated_at=now,
        template=req.template_id,
    )

    # Load template layout if specified
    if req.template_id:
        template_data = _load_template(req.template_id)
        layout_data = template_data.get("layout", {})
        project.layout = LayoutSpec(**layout_data)
        project.status = ProjectStatus.CONFIGURED

    project_dict = project.model_dump(mode="json")

    # Persist
    row = ProjectRow(
        project_id=project_id,
        product_family=family.value,
        name=project.name,
        revision=1,
        status=project.status.value,
        template=req.template_id,
        data=project_dict,
        created_at=now,
        updated_at=now,
    )
    db.add(row)

    # Save initial revision
    rev_row = ProjectRevisionRow(
        project_id=project_id,
        revision=1,
        data=project_dict,
        created_at=now,
        change_summary="Project created",
    )
    db.add(rev_row)

    await db.commit()
    return project_dict


@router.get("/")
async def list_projects(db: AsyncSession = Depends(get_db)):
    """List all projects (summary only)."""
    result = await db.execute(
        select(ProjectRow).order_by(ProjectRow.updated_at.desc())
    )
    rows = result.scalars().all()
    return [
        {
            "project_id": r.project_id,
            "product_family": r.product_family,
            "name": r.name,
            "revision": r.revision,
            "status": r.status,
            "template": r.template,
            "key_count": len(r.data.get("layout", {}).get("keys", [])),
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]


@router.get("/{project_id}")
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """Get full project data."""
    result = await db.execute(
        select(ProjectRow).where(ProjectRow.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return row.data


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    req: UpdateProjectRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update project fields. Increments revision."""
    result = await db.execute(
        select(ProjectRow).where(ProjectRow.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    # Optimistic locking: reject if client's revision doesn't match
    if req.expected_revision is not None and row.revision != req.expected_revision:
        raise HTTPException(
            status_code=409,
            detail=f"Revision conflict: expected {req.expected_revision}, current is {row.revision}",
        )

    # Reconstruct project from stored data
    project = KeyboardProject(**row.data)
    changes: list[str] = []

    if req.name is not None:
        project.name = req.name
        changes.append("name")

    if req.layout is not None:
        project.layout = req.layout
        changes.append("layout")

    if req.switch_part_id is not None:
        if req.switch_part_id not in _VALID_SWITCH_IDS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported switch '{req.switch_part_id}'. Supported: {sorted(_VALID_SWITCH_IDS)}",
            )
        project.switch_profile.part_id = req.switch_part_id
        changes.append("switch")

    if req.style_prompt is not None:
        project.style_request.prompt = req.style_prompt
        changes.append("style")

    if not changes:
        return project.model_dump(mode="json")

    # Increment revision
    now = datetime.now(timezone.utc)
    project.revision += 1
    project.updated_at = now

    # Invalidate validation on material changes
    if any(c in changes for c in ["layout", "switch"]):
        project.status = ProjectStatus.CONFIGURED
        project.pcb.drc_passed = None
        project.exports.bundle_id = None
        project.exports.validation_report_id = None

    project_dict = project.model_dump(mode="json")

    # Update current row
    row.name = project.name
    row.revision = project.revision
    row.status = project.status.value
    row.data = project_dict
    row.updated_at = now

    # Save revision snapshot
    rev_row = ProjectRevisionRow(
        project_id=project_id,
        revision=project.revision,
        data=project_dict,
        created_at=now,
        change_summary=f"Updated: {', '.join(changes)}",
    )
    db.add(rev_row)

    await db.commit()
    return project_dict


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a project and all its revisions."""
    result = await db.execute(
        select(ProjectRow).where(ProjectRow.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    # Delete all revision snapshots for this project
    rev_result = await db.execute(
        select(ProjectRevisionRow).where(
            ProjectRevisionRow.project_id == project_id
        )
    )
    for rev_row in rev_result.scalars().all():
        await db.delete(rev_row)

    await db.delete(row)
    await db.commit()
