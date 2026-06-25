"""Project CRUD endpoints."""

import copy
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
from server.api.auth import require_user, user_scope_id
from server.db.database import get_db
from server.db.models import ProjectArtifactRow, ProjectJobRow, ProjectRevisionRow, ProjectRow, UserRow
from server.models.project import (
    KeyboardProject,
    LayoutSpec,
    ProductDomain,
    ProductFamily,
    ProjectStatus,
    domain_for_family,
)
from server.models.supported_configs import SUPPORTED_SWITCHES, SUPPORTED_TEMPLATES
from server.services.artifact_registry import delete_project_artifact_tree
from server.services.project_state import (
    commit_project_mutation,
    create_project_record,
    invalidate_derived_state,
    load_project_state,
)
from server.services.platform_catalog import list_product_family_manifests

router = APIRouter(prefix="/api/projects", tags=["projects"])


class CreateProjectRequest(BaseModel):
    name: str = "Untitled Project"
    template_id: Optional[str] = None
    product_family: str = "keyboard"
    product_domain: Optional[str] = None


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


def _get_supported_template(template_id: str):
    return next((template for template in SUPPORTED_TEMPLATES if template.template_id == template_id), None)


def _enabled_project_families() -> frozenset[ProductFamily]:
    return frozenset(
        manifest.family
        for manifest in list_product_family_manifests()
        if manifest.status == "enabled"
    )


def _public_project_payload(data: dict) -> dict:
    """Return project state without internal filesystem artifact paths."""
    payload = copy.deepcopy(data)
    exports = payload.get("exports")
    if isinstance(exports, dict):
        exports["bundle_path"] = None

    pcb = payload.get("pcb")
    if isinstance(pcb, dict):
        pcb["gerber_path"] = None
        pcb["kicad_project_path"] = None

    for asset in payload.get("keycap_assets", []) or []:
        if isinstance(asset, dict):
            asset["mesh_path"] = None
            asset["preview_mesh_path"] = None

    return payload


@router.post("/", status_code=201)
async def create_project(
    req: CreateProjectRequest,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Create a new keyboard project, optionally from a template."""
    project_id = _generate_id()
    now = datetime.now(timezone.utc)

    # Validate product family
    try:
        family = ProductFamily(req.product_family)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown product family: {req.product_family}")
    if family not in _enabled_project_families():
        raise HTTPException(
            status_code=400,
            detail=f"Product family '{family.value}' is not enabled for authenticated alpha projects",
        )

    default_domain = domain_for_family(family)
    if req.product_domain is not None:
        try:
            domain = ProductDomain(req.product_domain)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown product domain: {req.product_domain}")
        if domain != default_domain:
            raise HTTPException(
                status_code=400,
                detail=f"Family '{family.value}' belongs to domain '{default_domain.value}', not '{domain.value}'",
            )
    else:
        domain = default_domain

    if req.template_id:
        template = _get_supported_template(req.template_id)
        if template is None:
            raise HTTPException(status_code=400, detail=f"Unknown template: {req.template_id}")
        if template.product_family != family:
            raise HTTPException(
                status_code=400,
                detail=f"Template '{req.template_id}' belongs to family '{template.product_family.value}', not '{family.value}'",
            )

    project = KeyboardProject(
        project_id=project_id,
        product_domain=domain,
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

    return await create_project_record(
        db,
        project,
        change_summary="Project created",
        owner_user_id=user_scope_id(user),
    )


@router.get("/")
async def list_projects(
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """List authenticated user's projects (summary only)."""
    stmt = select(ProjectRow).order_by(ProjectRow.updated_at.desc())
    owner_user_id = user_scope_id(user)
    if owner_user_id is not None:
        stmt = stmt.where(ProjectRow.user_id == owner_user_id)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        {
            "project_id": r.project_id,
            "product_domain": r.data.get("product_domain") or domain_for_family(ProductFamily(r.product_family)).value,
            "product_family": r.product_family,
            "name": r.name,
            "revision": r.revision,
            "status": r.status,
            "template": r.template,
            "key_count": len(
                r.data.get("layout", {}).get("elements")
                or r.data.get("layout", {}).get("keys", [])
            ),
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Get full project data."""
    row, _ = await load_project_state(
        db,
        project_id,
        owner_user_id=user_scope_id(user),
    )
    return _public_project_payload(row.data)


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    req: UpdateProjectRequest,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Update project fields. Increments revision."""
    row, project = await load_project_state(
        db,
        project_id,
        expected_revision=req.expected_revision,
        owner_user_id=user_scope_id(user),
    )
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
        return _public_project_payload(project.model_dump(mode="json"))

    # Invalidate validation on material changes
    if any(c in changes for c in ["layout", "switch"]):
        invalidate_derived_state(project)
    payload = await commit_project_mutation(
        db,
        row,
        project,
        change_summary=f"Updated: {', '.join(changes)}",
    )
    return _public_project_payload(payload)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Delete a project and all its durable registry rows."""
    row, _ = await load_project_state(
        db,
        project_id,
        owner_user_id=user_scope_id(user),
    )

    for model in (ProjectRevisionRow, ProjectArtifactRow, ProjectJobRow):
        result = await db.execute(select(model).where(model.project_id == project_id))
        for related_row in result.scalars().all():
            await db.delete(related_row)

    delete_project_artifact_tree(project_id)
    await db.delete(row)
    await db.commit()
