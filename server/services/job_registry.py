"""Persistent job registry helpers."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.models import ProjectJobRow

_TERMINAL_JOB_STATUSES = {
    "completed",
    "failed",
    "cancelled",
    "canceled",
    "succeeded",
    "expired",
}


def _generate_job_id() -> str:
    return f"job_{uuid.uuid4().hex[:12]}"


def normalize_job_status(status: str) -> str:
    return status.strip().lower().replace(" ", "_")


def is_terminal_job_status(status: str) -> bool:
    """Return whether a normalized or raw status represents a finished job."""
    return normalize_job_status(status) in _TERMINAL_JOB_STATUSES


def create_project_job(
    db: AsyncSession,
    *,
    project_id: str,
    revision: int,
    job_type: str,
    status: str,
    provider: str | None = None,
    external_ref: str | None = None,
    input_data: dict | None = None,
    output_data: dict | None = None,
    job_id: str | None = None,
) -> ProjectJobRow:
    """Create a persistent job row; commit is managed by the caller."""
    now = datetime.now(timezone.utc)
    normalized = normalize_job_status(status)
    row = ProjectJobRow(
        job_id=job_id or _generate_job_id(),
        project_id=project_id,
        revision=revision,
        job_type=job_type,
        status=normalized,
        provider=provider,
        external_ref=external_ref,
        input_data=input_data or {},
        output_data=output_data or {},
        created_at=now,
        updated_at=now,
        completed_at=now if is_terminal_job_status(normalized) else None,
    )
    db.add(row)
    return row


async def update_job_by_external_ref(
    db: AsyncSession,
    *,
    project_id: str,
    external_ref: str,
    status: str,
    output_data: dict | None = None,
) -> ProjectJobRow | None:
    """Update a job row based on a provider/external task identifier."""
    result = await db.execute(
        select(ProjectJobRow).where(
            ProjectJobRow.project_id == project_id,
            ProjectJobRow.external_ref == external_ref,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None

    now = datetime.now(timezone.utc)
    normalized = normalize_job_status(status)
    row.status = normalized
    row.updated_at = now
    if output_data is not None:
        row.output_data = output_data
    if is_terminal_job_status(normalized):
        row.completed_at = now
    return row


async def get_project_job_by_external_ref(
    db: AsyncSession,
    project_id: str,
    external_ref: str,
) -> ProjectJobRow | None:
    """Look up a persistent job row by provider task id."""
    result = await db.execute(
        select(ProjectJobRow).where(
            ProjectJobRow.project_id == project_id,
            ProjectJobRow.external_ref == external_ref,
        )
    )
    return result.scalar_one_or_none()


async def list_project_jobs(
    db: AsyncSession,
    project_id: str,
) -> list[ProjectJobRow]:
    """List persistent jobs for a project."""
    result = await db.execute(
        select(ProjectJobRow)
        .where(ProjectJobRow.project_id == project_id)
        .order_by(ProjectJobRow.created_at.desc())
    )
    return list(result.scalars().all())
