"""Artifact and job listing endpoints."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.auth import require_user, user_scope_id
from server.db.database import get_db
from server.db.models import UserRow
from server.models.validation_schema import ValidationReport
from server.services.artifact_registry import list_project_artifacts
from server.services.job_registry import list_project_jobs
from server.services.project_state import load_project_state
from server.services.quality_gate import QualityGateInput, build_quality_gate_summary

router = APIRouter(prefix="/api/projects", tags=["records"])


def _read_json_artifact(path: str | None) -> dict | None:
    if not path:
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
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
