"""Artifact and job listing endpoints."""

from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.auth import require_user, user_scope_id
from server.db.database import get_db
from server.db.models import UserRow
from server.models.validation_schema import ValidationReport
from server.services.artifact_registry import get_project_artifact, list_project_artifacts
from server.services.artifact_storage import artifact_exists, artifact_storage_config, read_artifact_bytes
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
    return Response(
        content=read_artifact_bytes(row.path),
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
