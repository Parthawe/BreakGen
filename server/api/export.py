"""Export and validation endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.database import get_db
from server.db.models import ProjectRevisionRow, ProjectRow
from server.export.bundler import create_export_bundle
from server.models.project import KeyboardProject, ProjectStatus
from server.models.validation_schema import CheckStatus
from server.validation.engine import validate_project

router = APIRouter(prefix="/api/projects", tags=["export"])


@router.post("/{project_id}/validate")
async def run_validation(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Run validation checks and persist the result on the project."""
    result = await db.execute(
        select(ProjectRow).where(ProjectRow.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    project = KeyboardProject(**row.data)
    report = validate_project(project)

    # Update project status based on validation
    if report.status == CheckStatus.FAIL:
        project.status = ProjectStatus.CONFIGURED
    else:
        project.status = ProjectStatus.VALIDATED

    now = datetime.now(timezone.utc)
    project.exports.validation_report_id = report.report_id
    project.revision += 1
    project.updated_at = now

    project_dict = project.model_dump(mode="json")
    row.revision = project.revision
    row.data = project_dict
    row.status = project.status.value
    row.updated_at = now

    db.add(ProjectRevisionRow(
        project_id=project_id,
        revision=project.revision,
        data=project_dict,
        created_at=now,
        change_summary=f"Validation: {report.status.value} ({len(report.checks)} checks)",
    ))

    await db.commit()

    return report.model_dump(mode="json")


@router.post("/{project_id}/export")
async def export_bundle(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Generate and download the export bundle as a ZIP (plate DXF, firmware, validation)."""
    result = await db.execute(
        select(ProjectRow).where(ProjectRow.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    project = KeyboardProject(**row.data)
    if not project.layout.keys:
        raise HTTPException(status_code=400, detail="Layout has no keys")

    # Run validation — block export on hard failures
    report = validate_project(project)
    if report.status == CheckStatus.FAIL:
        raise HTTPException(
            status_code=400,
            detail=f"Validation failed. Fix issues before exporting: {[c.details for c in report.checks if c.status == CheckStatus.FAIL]}",
        )

    bundle_id, zip_path = create_export_bundle(project)

    # Store export metadata on the project
    now = datetime.now(timezone.utc)
    project.exports.bundle_id = bundle_id
    project.exports.validation_report_id = report.report_id
    project.exports.exported_at = now
    project.status = ProjectStatus.EXPORTED
    project.revision += 1
    project.updated_at = now

    project_dict = project.model_dump(mode="json")
    row.revision = project.revision
    row.status = project.status.value
    row.data = project_dict
    row.updated_at = now

    db.add(ProjectRevisionRow(
        project_id=project_id,
        revision=project.revision,
        data=project_dict,
        created_at=now,
        change_summary=f"Exported bundle {bundle_id}",
    ))

    await db.commit()

    filename = f"{project.name.replace(' ', '_')}_export.zip"

    return FileResponse(
        str(zip_path),
        media_type="application/zip",
        filename=filename,
        headers={
            "X-Bundle-Id": bundle_id,
            "X-Validation-Status": report.status.value,
        },
    )
