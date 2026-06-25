"""Export and validation endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.auth import require_user, user_scope_id
from server.db.database import get_db
from server.db.models import UserRow
from server.export.bundler import build_export_preview, create_export_bundle
from server.models.project import ProjectStatus
from server.models.validation_schema import CheckStatus
from server.services.artifact_registry import (
    project_state_fingerprint,
    record_export_bundle,
    record_validation_report,
)
from server.services.project_state import (
    load_project_state,
    persist_project_metadata,
)
from server.validation.engine import validate_project

router = APIRouter(prefix="/api/projects", tags=["export"])


def _export_readiness(report_status: CheckStatus) -> str:
    return "review_ready" if report_status == CheckStatus.PASS else "candidate"


@router.post("/{project_id}/validate")
async def run_validation(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Run validation checks and persist the result on the project."""
    row, project = await load_project_state(
        db,
        project_id,
        owner_user_id=user_scope_id(user),
    )
    report = validate_project(project)

    # Update project status based on validation
    if report.status == CheckStatus.FAIL:
        project.status = ProjectStatus.CONFIGURED
    else:
        project.status = ProjectStatus.VALIDATED

    now = datetime.now(timezone.utc)
    record_validation_report(
        db,
        report=report,
        domain=project.product_domain.value,
        family=project.product_family.value,
        source_spec_hash=project_state_fingerprint(project),
    )
    project.exports.validation_report_id = report.report_id
    await persist_project_metadata(
        db,
        row,
        project,
        now=now,
    )

    return report.model_dump(mode="json")


@router.get("/{project_id}/export/preview")
async def preview_export_bundle(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Return the current revision's export contents, BOM, and build-guide preview."""
    _, project = await load_project_state(
        db,
        project_id,
        owner_user_id=user_scope_id(user),
    )
    return build_export_preview(project)


async def export_project_bundle(
    project_id: str,
    db: AsyncSession,
    *,
    owner_user_id: int | None,
):
    """Generate and download the export bundle as a ZIP (panel DXF/specs, firmware metadata, validation)."""
    row, project = await load_project_state(
        db,
        project_id,
        owner_user_id=owner_user_id,
    )
    if not project.layout.elements:
        raise HTTPException(status_code=400, detail="Layout has no placed elements")

    # Run validation — block export on hard failures
    report = validate_project(project)
    if report.status == CheckStatus.FAIL:
        raise HTTPException(
            status_code=400,
            detail=f"Validation failed. Fix issues before exporting: {[c.details for c in report.checks if c.status == CheckStatus.FAIL]}",
        )
    readiness = _export_readiness(report.status)

    spec_hash = project_state_fingerprint(project)
    record_validation_report(
        db,
        report=report,
        domain=project.product_domain.value,
        family=project.product_family.value,
        source_spec_hash=spec_hash,
    )
    bundle_id, zip_path = create_export_bundle(
        project,
        validation_report=report,
        export_readiness=readiness,
    )
    record_export_bundle(
        db,
        project_id=project.project_id,
        revision=project.revision,
        bundle_id=bundle_id,
        zip_path=zip_path,
        validation_report_id=report.report_id,
        validation_status=report.status.value,
        acceptance_state=readiness,
        domain=project.product_domain.value,
        family=project.product_family.value,
        source_spec_hash=spec_hash,
    )

    # Store export metadata on the project
    now = datetime.now(timezone.utc)
    project.exports.bundle_id = bundle_id
    project.exports.bundle_path = str(zip_path)
    project.exports.validation_report_id = report.report_id
    project.exports.exported_at = now
    project.status = (
        ProjectStatus.EXPORTED
        if readiness == "review_ready"
        else ProjectStatus.VALIDATED
    )
    await persist_project_metadata(
        db,
        row,
        project,
        now=now,
    )

    filename = f"{project.name.replace(' ', '_')}_export.zip"

    return FileResponse(
        str(zip_path),
        media_type="application/zip",
        filename=filename,
        headers={
            "X-Bundle-Id": bundle_id,
            "X-Validation-Status": report.status.value,
            "X-Export-Readiness": readiness,
        },
    )


@router.post("/{project_id}/export")
async def export_bundle(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Generate and download the export bundle as a ZIP."""
    return await export_project_bundle(
        project_id,
        db,
        owner_user_id=user_scope_id(user),
    )
