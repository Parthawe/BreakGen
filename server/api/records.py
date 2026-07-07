"""Artifact and job listing endpoints."""

from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.auth import require_user, user_scope_id
from server.db.database import get_db
from server.db.models import ProjectRevisionRow, UserRow
from server.export.bundler import _missing_outputs
from server.models.validation_schema import ValidationReport
from server.services.artifact_registry import get_project_artifact, list_project_artifacts
from server.services.artifact_storage import (
    artifact_exists,
    artifact_storage_config,
    iter_artifact_bytes,
    read_artifact_bytes,
)
from server.services.job_registry import list_project_jobs
from server.services.project_state import load_project_state
from server.services.quality_gate import QualityGateInput, build_quality_gate_summary
from server.services.usage_registry import (
    record_usage_event,
    serialize_usage_event,
    summarize_usage_events,
)

router = APIRouter(prefix="/api/projects", tags=["records"])

_SAFE_DOWNLOAD_CHARS = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")


class BillingIntentRequest(BaseModel):
    trigger: str = Field(min_length=1, max_length=64)
    plan: str | None = Field(default=None, max_length=64)
    note: str | None = Field(default=None, max_length=500)
    metadata: dict = Field(default_factory=dict)


def _read_json_artifact(path: str | None) -> dict | None:
    if not path:
        return None
    try:
        return json.loads(read_artifact_bytes(path).decode("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError, UnicodeDecodeError):
        return None


def _read_validation_report(path: str | None) -> ValidationReport | None:
    payload = _read_json_artifact(path)
    if payload is None:
        return None
    try:
        return ValidationReport(**payload)
    except ValidationError:
        return None


def _serialize_artifact(row) -> dict:
    return {
        "artifact_id": row.artifact_id,
        "project_id": row.project_id,
        "revision": row.revision,
        "kind": row.kind,
        "artifact_role": row.details.get("artifact_role", row.kind),
        "domain": row.details.get("domain"),
        "family": row.details.get("family"),
        "source_revision": row.details.get("source_revision", row.revision),
        "source_spec_hash": row.details.get("source_spec_hash"),
        "producer_kind": row.details.get("producer_kind"),
        "producer_id": row.details.get("producer_id"),
        "lineage": row.details.get("lineage", {}),
        "acceptance_state": row.details.get("acceptance_state"),
        "file_name": Path(row.path).name if row.path else None,
        "path": None,
        "sha256": row.sha256,
        "content_type": row.content_type,
        "details": row.details,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _serialize_job(row) -> dict:
    return {
        "job_id": row.job_id,
        "project_id": row.project_id,
        "revision": row.revision,
        "job_type": row.job_type,
        "status": row.status,
        "provider": row.provider,
        "external_ref": row.external_ref,
        "input_data": row.input_data,
        "output_data": row.output_data,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "completed_at": row.completed_at.isoformat() if row.completed_at else None,
    }


def _sort_time(value: str | None) -> str:
    return value or ""


def _short_sha(value: str | None) -> str | None:
    return value[:12] if value else None


def _event_readiness(artifact: dict | None, validation_report: dict | None = None) -> str:
    if validation_report and validation_report.get("status"):
        return str(validation_report["status"])
    if artifact and artifact.get("acceptance_state"):
        return str(artifact["acceptance_state"])
    return "recorded"


def _artifact_summary(artifact: dict) -> dict:
    return {
        "artifact_id": artifact["artifact_id"],
        "kind": artifact["kind"],
        "artifact_role": artifact["artifact_role"],
        "revision": artifact["revision"],
        "source_revision": artifact["source_revision"],
        "file_name": artifact["file_name"],
        "sha256": artifact["sha256"],
        "short_sha256": _short_sha(artifact["sha256"]),
        "content_type": artifact["content_type"],
        "acceptance_state": artifact["acceptance_state"],
        "producer_id": artifact["producer_id"],
        "created_at": artifact["created_at"],
    }


def _build_evidence_timeline(
    *,
    project_id: str,
    current_revision: int,
    revisions: list[ProjectRevisionRow],
    artifacts: list[dict],
    jobs: list[dict],
    validation_reports: dict[str, dict],
) -> dict:
    events: list[dict] = []

    artifacts_by_revision: dict[int, list[dict]] = {}
    for artifact in artifacts:
        source_revision = int(artifact.get("source_revision") or artifact["revision"])
        artifacts_by_revision.setdefault(source_revision, []).append(artifact)

    jobs_by_revision: dict[int, list[dict]] = {}
    for job in jobs:
        jobs_by_revision.setdefault(job["revision"], []).append(job)

    validation_report_by_revision: dict[int, dict] = {}
    for report in validation_reports.values():
        revision = report.get("revision")
        if isinstance(revision, int):
            validation_report_by_revision[revision] = report

    for revision in revisions:
        revision_artifacts = sorted(
            artifacts_by_revision.get(revision.revision, []),
            key=lambda item: _sort_time(item["created_at"]),
        )
        revision_jobs = sorted(
            jobs_by_revision.get(revision.revision, []),
            key=lambda item: _sort_time(item["created_at"]),
        )
        events.append(
            {
                "event_id": f"revision-{revision.revision}",
                "event_type": "revision",
                "revision": revision.revision,
                "created_at": revision.created_at.isoformat() if revision.created_at else None,
                "title": f"Revision r{revision.revision}",
                "summary": revision.change_summary or "Project revision snapshot",
                "readiness": "current" if revision.revision == current_revision else "superseded",
                "artifacts": [_artifact_summary(item) for item in revision_artifacts],
                "jobs": revision_jobs,
                "validation_report": validation_report_by_revision.get(revision.revision),
            }
        )

    for artifact in artifacts:
        validation_report = validation_reports.get(artifact["artifact_id"])
        events.append(
            {
                "event_id": f"artifact-{artifact['artifact_id']}",
                "event_type": artifact["kind"],
                "revision": artifact["source_revision"],
                "created_at": artifact["created_at"],
                "title": artifact["artifact_role"].replace("_", " ").title(),
                "summary": (
                    "Review-ready evidence bundle; not a complete fabrication package."
                    if artifact["kind"] == "export_bundle"
                    else f"{artifact['kind'].replace('_', ' ')} artifact recorded."
                ),
                "readiness": _event_readiness(artifact, validation_report),
                "artifacts": [_artifact_summary(artifact)],
                "jobs": [],
                "validation_report": validation_report,
            }
        )

    for job in jobs:
        events.append(
            {
                "event_id": f"job-{job['job_id']}",
                "event_type": "job",
                "revision": job["revision"],
                "created_at": job["created_at"],
                "title": job["job_type"].replace("_", " ").title(),
                "summary": f"{(job['provider'] or 'system').replace('_', ' ')} job is {job['status']}.",
                "readiness": job["status"],
                "artifacts": [],
                "jobs": [job],
                "validation_report": None,
            }
        )

    events.sort(
        key=lambda item: (
            _sort_time(item["created_at"]),
            item["revision"],
            item["event_type"],
        ),
        reverse=True,
    )

    return {
        "project_id": project_id,
        "current_revision": current_revision,
        "missing_outputs": _missing_outputs(),
        "events": events,
    }


def _download_filename(row) -> str:
    path_name = Path(row.path).name if row.path else ""
    fallback = f"{row.artifact_id}.bin"
    raw_name = path_name or fallback
    cleaned = "".join(char if char in _SAFE_DOWNLOAD_CHARS else "_" for char in raw_name)
    return cleaned or fallback


@router.get("/{project_id}/artifacts")
async def get_project_artifacts(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """List durable artifacts registered for a project."""
    await load_project_state(db, project_id, owner_user_id=user_scope_id(user))
    rows = await list_project_artifacts(db, project_id)
    return [_serialize_artifact(row) for row in rows]


@router.get("/{project_id}/jobs")
async def get_project_jobs(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """List persistent jobs for a project."""
    await load_project_state(db, project_id, owner_user_id=user_scope_id(user))
    rows = await list_project_jobs(db, project_id)
    return [_serialize_job(row) for row in rows]


@router.get("/{project_id}/artifacts/{artifact_id}/download")
async def download_project_artifact(
    project_id: str,
    artifact_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Download a registered artifact after project-owner authorization."""
    await load_project_state(db, project_id, owner_user_id=user_scope_id(user))
    row = await get_project_artifact(db, project_id, artifact_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Artifact not found")

    if not artifact_exists(row.path):
        raise HTTPException(status_code=404, detail="Artifact file not found")

    filename = _download_filename(row)
    record_usage_event(
        db,
        event_type="artifact_download",
        user_id=user_scope_id(user),
        project_id=project_id,
        revision=row.revision,
        quantity=1,
        unit="download",
        metadata={
            "artifact_id": row.artifact_id,
            "kind": row.kind,
            "content_type": row.content_type,
        },
    )
    await db.commit()
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
        "X-BreakGen-Artifact-Id": row.artifact_id,
    }
    media_type = row.content_type or "application/octet-stream"
    if artifact_storage_config().backend == "local":
        return FileResponse(
            Path(row.path),
            media_type=media_type,
            filename=filename,
            headers=headers,
        )
    return StreamingResponse(
        iter_artifact_bytes(row.path),
        media_type=media_type,
        headers=headers,
    )


@router.get("/{project_id}/records")
async def get_project_records(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Return jobs and artifacts in one provenance-oriented payload."""
    await load_project_state(db, project_id, owner_user_id=user_scope_id(user))
    artifact_rows = await list_project_artifacts(db, project_id)
    artifacts = [_serialize_artifact(row) for row in artifact_rows]
    jobs = [_serialize_job(row) for row in await list_project_jobs(db, project_id)]
    latest_validation = next((item for item in artifacts if item["kind"] == "validation_report"), None)
    latest_validation_row = next((row for row in artifact_rows if row.kind == "validation_report"), None)
    latest_export = next((item for item in artifacts if item["kind"] == "export_bundle"), None)
    return {
        "project_id": project_id,
        "jobs": jobs,
        "artifacts": artifacts,
        "latest_validation": latest_validation,
        "latest_validation_report": _read_json_artifact(latest_validation_row.path) if latest_validation_row else None,
        "latest_export": latest_export,
        "usage": await summarize_usage_events(
            db,
            user_id=user_scope_id(user),
            project_id=project_id,
        ),
    }


@router.get("/{project_id}/evidence")
async def get_project_evidence(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Return a revision-oriented evidence ledger for the current project."""
    _, project = await load_project_state(
        db,
        project_id,
        owner_user_id=user_scope_id(user),
    )
    artifact_rows = await list_project_artifacts(db, project_id)
    artifacts = [_serialize_artifact(row) for row in artifact_rows]
    jobs = [_serialize_job(row) for row in await list_project_jobs(db, project_id)]
    validation_reports = {
        row.artifact_id: report
        for row in artifact_rows
        if row.kind == "validation_report"
        if (report := _read_json_artifact(row.path)) is not None
    }
    revision_rows = (
        await db.execute(
            select(ProjectRevisionRow)
            .where(ProjectRevisionRow.project_id == project_id)
            .order_by(ProjectRevisionRow.revision.asc())
        )
    ).scalars().all()

    return _build_evidence_timeline(
        project_id=project_id,
        current_revision=project.revision,
        revisions=list(revision_rows),
        artifacts=artifacts,
        jobs=jobs,
        validation_reports=validation_reports,
    )


@router.get("/{project_id}/quality-gate")
async def get_project_quality_gate(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Return an operator-readable quality gate for the current project revision."""
    _, project = await load_project_state(
        db,
        project_id,
        owner_user_id=user_scope_id(user),
    )
    artifact_rows = await list_project_artifacts(db, project_id)
    latest_validation_row = next(
        (row for row in artifact_rows if row.kind == "validation_report"),
        None,
    )
    latest_validation_report = _read_validation_report(
        latest_validation_row.path if latest_validation_row else None
    )
    jobs = await list_project_jobs(db, project_id)
    return build_quality_gate_summary(
        QualityGateInput(
            project=project,
            artifacts=artifact_rows,
            jobs=jobs,
            latest_validation_report=latest_validation_report,
        )
    )


@router.get("/{project_id}/usage")
async def get_project_usage(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Return owner-scoped usage and billing-intent telemetry for this project."""
    await load_project_state(db, project_id, owner_user_id=user_scope_id(user))
    return await summarize_usage_events(
        db,
        user_id=user_scope_id(user),
        project_id=project_id,
    )


@router.post("/{project_id}/billing-intent", status_code=201)
async def create_project_billing_intent(
    project_id: str,
    req: BillingIntentRequest,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Record pricing interest without enabling billing or plan enforcement."""
    _, project = await load_project_state(
        db,
        project_id,
        owner_user_id=user_scope_id(user),
    )
    row = record_usage_event(
        db,
        event_type="billing_intent",
        user_id=user_scope_id(user),
        project_id=project_id,
        revision=project.revision,
        quantity=1,
        unit="intent",
        source="client",
        metadata={
            "trigger": req.trigger,
            "plan": req.plan,
            "note": req.note,
            **req.metadata,
        },
    )
    await db.commit()
    return serialize_usage_event(row)
