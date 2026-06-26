"""Export and validation endpoints."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.auth import require_user, user_scope_id
from server.config import settings
from server.db.database import get_db
from server.db.models import ProjectArtifactRow, UserRow
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
from server.services.rate_limit import enforce_rate_limit
from server.services.usage_registry import record_usage_event, usage_total
from server.validation.engine import validate_project

router = APIRouter(prefix="/api/projects", tags=["export"])


async def enforce_validation_rate_limit(
    request: Request,
    user: UserRow = Depends(require_user),
) -> None:
    enforce_rate_limit(
        request,
        scope="project:validate",
        limit=settings.validation_rate_limit_per_minute,
        identity=f"user:{user.id}",
    )


async def enforce_export_rate_limit(
    request: Request,
    user: UserRow = Depends(require_user),
) -> None:
    enforce_rate_limit(
        request,
        scope="project:export",
        limit=settings.export_rate_limit_per_minute,
        identity=f"user:{user.id}",
    )


def _export_readiness(report_status: CheckStatus) -> str:
    return "review_ready" if report_status == CheckStatus.PASS else "candidate"


def _stable_export_created_at(project_created_at: datetime, revision: int) -> datetime:
    if project_created_at.tzinfo is None:
        project_created_at = project_created_at.replace(tzinfo=timezone.utc)
    return project_created_at.astimezone(timezone.utc).replace(microsecond=0)


def _stable_export_digest(
    *,
    project_id: str,
    revision: int,
    spec_hash: str,
    readiness: str,
    validation_status: str,
    purpose: str,
) -> str:
    payload = {
        "project_id": project_id,
        "revision": revision,
        "source_spec_hash": spec_hash,
        "readiness": readiness,
        "validation_status": validation_status,
        "purpose": purpose,
    }
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


async def _replace_artifact_ids(db: AsyncSession, artifact_ids: list[str]) -> None:
    if not artifact_ids:
        return
    result = await db.execute(
        select(ProjectArtifactRow).where(ProjectArtifactRow.artifact_id.in_(artifact_ids))
    )
    for row in result.scalars().all():
        await db.delete(row)
    await db.flush()


@router.post("/{project_id}/validate")
async def run_validation(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
    _rate_limit: None = Depends(enforce_validation_rate_limit),
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
    record_usage_event(
        db,
        event_type="validation_run",
        user_id=user_scope_id(user),
        project_id=project.project_id,
        revision=project.revision,
        quantity=len(report.checks),
        unit="check",
        metadata={
            "status": report.status.value,
            "report_id": report.report_id,
            "family": project.product_family.value,
        },
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
    export_count = await usage_total(
        db,
        event_type="export_bundle",
        user_id=owner_user_id,
        project_id=project_id,
    )
    if export_count >= settings.free_export_bundles_per_project:
        raise HTTPException(
            status_code=403,
            detail=(
                "Free alpha export limit reached for this project. "
                "Record pricing interest or contact the operator for a higher limit."
            ),
        )

    # Run validation — block export on hard failures
    report = validate_project(project)
    if report.status == CheckStatus.FAIL:
        raise HTTPException(
            status_code=400,
            detail=f"Validation failed. Fix issues before exporting: {[c.details for c in report.checks if c.status == CheckStatus.FAIL]}",
        )
    readiness = _export_readiness(report.status)

    spec_hash = project_state_fingerprint(project)
    export_created_at = _stable_export_created_at(project.created_at, project.revision)
    report = report.model_copy(
        update={
            "report_id": f"vr_{_stable_export_digest(project_id=project.project_id, revision=project.revision, spec_hash=spec_hash, readiness=readiness, validation_status=report.status.value, purpose='validation')[:12]}",
            "created_at": export_created_at,
        }
    )
    bundle_id = f"bundle_{_stable_export_digest(project_id=project.project_id, revision=project.revision, spec_hash=spec_hash, readiness=readiness, validation_status=report.status.value, purpose='bundle')[:12]}"
    await _replace_artifact_ids(db, [report.report_id, bundle_id])
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
        bundle_id=bundle_id,
        created_at=export_created_at,
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
    record_usage_event(
        db,
        event_type="export_bundle",
        user_id=owner_user_id,
        project_id=project.project_id,
        revision=project.revision,
        quantity=1,
        unit="bundle",
        metadata={
            "bundle_id": bundle_id,
            "readiness": readiness,
            "validation_status": report.status.value,
            "family": project.product_family.value,
        },
    )

    # Store export metadata on the project
    now = datetime.now(timezone.utc)
    project.exports.bundle_id = bundle_id
    project.exports.bundle_path = str(zip_path)
    project.exports.validation_report_id = report.report_id
    project.exports.exported_at = now
    project.status = ProjectStatus.VALIDATED
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
    _rate_limit: None = Depends(enforce_export_rate_limit),
):
    """Generate and download the export bundle as a ZIP."""
    return await export_project_bundle(
        project_id,
        db,
        owner_user_id=user_scope_id(user),
    )
