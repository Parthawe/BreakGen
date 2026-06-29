"""Shared project lifecycle helpers.

This module centralizes the canonical mutation contract:
load project state, enforce optimistic locking, persist the current row,
and snapshot every committed revision.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.models import ProjectRevisionRow, ProjectRow
from server.models.project import KeyboardProject, ProjectStatus
from server.services.usage_registry import record_usage_event


async def load_project_state(
    db: AsyncSession,
    project_id: str,
    *,
    expected_revision: int | None = None,
    owner_user_id: int | None = None,
) -> tuple[ProjectRow, KeyboardProject]:
    """Load the current project row and canonical project state."""
    stmt = select(ProjectRow).where(ProjectRow.project_id == project_id)
    if owner_user_id is not None:
        stmt = stmt.where(ProjectRow.user_id == owner_user_id)
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    if expected_revision is not None and row.revision != expected_revision:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Revision conflict: expected {expected_revision}, "
                f"current is {row.revision}"
            ),
        )

    return row, KeyboardProject(**row.data)


async def create_project_record(
    db: AsyncSession,
    project: KeyboardProject,
    *,
    change_summary: str,
    owner_user_id: int | None = None,
) -> dict:
    """Persist a newly-created project and its initial immutable snapshot."""
    project_dict = project.model_dump(mode="json")

    row = ProjectRow(
        project_id=project.project_id,
        product_family=project.product_family.value,
        user_id=owner_user_id,
        name=project.name,
        revision=project.revision,
        status=project.status.value,
        template=project.template,
        data=project_dict,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )
    db.add(row)
    db.add(
        ProjectRevisionRow(
            project_id=project.project_id,
            revision=project.revision,
            data=project_dict,
            created_at=project.created_at,
            change_summary=change_summary,
        )
    )
    record_usage_event(
        db,
        event_type="project_created",
        user_id=owner_user_id,
        project_id=project.project_id,
        revision=project.revision,
        metadata={
            "family": project.product_family.value,
            "domain": project.product_domain.value,
            "template": project.template,
        },
    )

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Project could not be created because a database constraint was violated",
        ) from exc
    return project_dict


def invalidate_derived_state(project: KeyboardProject) -> None:
    """Clear validation/export metadata after a spec-changing mutation."""
    project.status = ProjectStatus.CONFIGURED
    project.pcb.drc_passed = None
    project.exports.validation_report_id = None
    project.exports.bundle_id = None
    project.exports.bundle_path = None
    project.exports.exported_at = None
    project.derived.pop("electronics", None)
    project.derived.pop("mechanical", None)


def _sync_project_row(
    row: ProjectRow,
    project: KeyboardProject,
    *,
    now: datetime,
    project_dict: dict,
) -> None:
    row.product_family = project.product_family.value
    row.name = project.name
    row.revision = project.revision
    row.status = project.status.value
    row.template = project.template
    row.data = project_dict
    row.updated_at = now


async def commit_project_mutation(
    db: AsyncSession,
    row: ProjectRow,
    project: KeyboardProject,
    *,
    change_summary: str,
    now: datetime | None = None,
    expected_revision: int | None = None,
) -> dict:
    """Bump revision, persist the current row, and write a snapshot."""
    now = now or datetime.now(timezone.utc)
    if expected_revision is not None:
        await db.refresh(row)
        if row.revision != expected_revision:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Revision conflict: expected {expected_revision}, "
                    f"current is {row.revision}"
                ),
            )
    project.revision += 1
    project.updated_at = now
    project_dict = project.model_dump(mode="json")

    _sync_project_row(row, project, now=now, project_dict=project_dict)

    db.add(
        ProjectRevisionRow(
            project_id=project.project_id,
            revision=project.revision,
            data=project_dict,
            created_at=now,
            change_summary=change_summary,
        )
    )

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Revision conflict: project was modified concurrently",
        ) from exc
    return project_dict


async def persist_project_metadata(
    db: AsyncSession,
    row: ProjectRow,
    project: KeyboardProject,
    *,
    now: datetime | None = None,
) -> dict:
    """Persist non-spec metadata without creating a new immutable revision."""
    now = now or datetime.now(timezone.utc)
    project.updated_at = now
    project_dict = project.model_dump(mode="json")
    _sync_project_row(row, project, now=now, project_dict=project_dict)
    await db.commit()
    return project_dict
