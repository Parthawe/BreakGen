"""Export and validation endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.database import get_db
from server.db.models import ProjectRow
from server.export.bundler import create_export_bundle
from server.models.project import KeyboardProject
from server.validation.engine import validate_project

router = APIRouter(prefix="/api/projects", tags=["export"])


@router.post("/{project_id}/validate")
async def run_validation(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Run validation checks on the current project revision."""
    result = await db.execute(
        select(ProjectRow).where(ProjectRow.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    project = KeyboardProject(**row.data)
    report = validate_project(project)
    return report.model_dump(mode="json")


@router.post("/{project_id}/export")
async def export_bundle(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Generate and download the complete export bundle as a ZIP."""
    result = await db.execute(
        select(ProjectRow).where(ProjectRow.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    project = KeyboardProject(**row.data)
    if not project.layout.keys:
        raise HTTPException(status_code=400, detail="Layout has no keys")

    bundle_id, zip_path = create_export_bundle(project)

    filename = f"{project.name.replace(' ', '_')}_export.zip"

    return FileResponse(
        str(zip_path),
        media_type="application/zip",
        filename=filename,
        headers={"X-Bundle-Id": bundle_id},
    )
