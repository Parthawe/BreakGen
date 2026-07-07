"""Print a read-only private-alpha operator snapshot."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.database import async_session, engine
from server.db.models import (
    LaunchLeadRow,
    ProjectArtifactRow,
    ProjectJobRow,
    ProjectRow,
    ProjectUsageEventRow,
    UserRow,
)


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if not domain:
        return "***"
    if len(local) <= 2:
        masked_local = f"{local[:1]}***"
    else:
        masked_local = f"{local[:2]}***{local[-1:]}"
    return f"{masked_local}@{domain}"


async def _counts_by(db: AsyncSession, model: type, *columns: Any) -> list[dict[str, Any]]:
    result = await db.execute(
        select(*columns, func.count().label("count"))
        .select_from(model)
        .group_by(*columns)
        .order_by(desc("count"))
    )
    rows: list[dict[str, Any]] = []
    for row in result.all():
        values = row._mapping
        item = {column.key: values[column.key] for column in columns}
        item["count"] = values["count"]
        rows.append(item)
    return rows


def _seconds_between(start: datetime | None, end: datetime | None) -> float | None:
    if not start or not end:
        return None
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    seconds = (end - start).total_seconds()
    return seconds if seconds >= 0 else None


async def _funnel_metrics(db: AsyncSession) -> dict[str, Any]:
    usage_result = await db.execute(
        select(ProjectUsageEventRow).where(
            ProjectUsageEventRow.event_type.in_(
                [
                    "project_created",
                    "first_validation_passed",
                    "export_created",
                    "billing_intent",
                ]
            )
        )
    )
    events = list(usage_result.scalars().all())
    by_project: dict[str, dict[str, list[ProjectUsageEventRow]]] = defaultdict(lambda: defaultdict(list))
    event_counts: dict[str, int] = defaultdict(int)
    for event in events:
        event_counts[event.event_type] += event.quantity
        if event.project_id:
            by_project[event.project_id][event.event_type].append(event)

    ttfb_seconds: list[float] = []
    for project_events in by_project.values():
        created = min(
            (event.created_at for event in project_events.get("project_created", []) if event.created_at),
            default=None,
        )
        exported = min(
            (event.created_at for event in project_events.get("export_created", []) if event.created_at),
            default=None,
        )
        seconds = _seconds_between(created, exported)
        if seconds is not None:
            ttfb_seconds.append(seconds)

    revision_result = await db.execute(select(ProjectRow.revision))
    revisions = [int(value) for value in revision_result.scalars().all()]
    return {
        "activation_count": event_counts.get("first_validation_passed", 0),
        "export_count": event_counts.get("export_created", 0),
        "billing_intent_count": event_counts.get("billing_intent", 0),
        "projects_with_revisions": len(revisions),
        "average_revision_depth": round(sum(revisions) / len(revisions), 2) if revisions else 0,
        "ttfb_seconds": {
            "count": len(ttfb_seconds),
            "average": round(sum(ttfb_seconds) / len(ttfb_seconds), 2) if ttfb_seconds else None,
            "minimum": round(min(ttfb_seconds), 2) if ttfb_seconds else None,
        },
    }


async def build_operator_snapshot(
    db: AsyncSession,
    *,
    include_emails: bool = False,
    recent_limit: int = 10,
) -> dict[str, Any]:
    """Return launch, project, artifact, job, and usage signals for operators."""
    recent_limit = max(1, min(recent_limit, 50))
    totals = {
        "users": await db.scalar(select(func.count()).select_from(UserRow)) or 0,
        "projects": await db.scalar(select(func.count()).select_from(ProjectRow)) or 0,
        "launch_leads": await db.scalar(select(func.count()).select_from(LaunchLeadRow)) or 0,
        "artifacts": await db.scalar(select(func.count()).select_from(ProjectArtifactRow)) or 0,
        "jobs": await db.scalar(select(func.count()).select_from(ProjectJobRow)) or 0,
        "usage_events": await db.scalar(select(func.count()).select_from(ProjectUsageEventRow)) or 0,
    }

    recent_leads_result = await db.execute(
        select(LaunchLeadRow)
        .order_by(LaunchLeadRow.created_at.desc())
        .limit(recent_limit)
    )
    recent_leads = []
    for lead in recent_leads_result.scalars().all():
        recent_leads.append(
            {
                "id": lead.id,
                "email": lead.email if include_emails else _mask_email(lead.email),
                "role": lead.role,
                "intent": lead.intent,
                "surface": lead.surface,
                "path": lead.path,
                "utm_source": lead.source.get("utm_source") if isinstance(lead.source, dict) else None,
                "created_at": lead.created_at.isoformat() if lead.created_at else None,
            }
        )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "totals": totals,
        "launch_leads_by_intent": await _counts_by(db, LaunchLeadRow, LaunchLeadRow.intent),
        "launch_leads_by_surface": await _counts_by(db, LaunchLeadRow, LaunchLeadRow.surface),
        "projects_by_family_status": await _counts_by(
            db,
            ProjectRow,
            ProjectRow.product_family,
            ProjectRow.status,
        ),
        "artifacts_by_kind": await _counts_by(db, ProjectArtifactRow, ProjectArtifactRow.kind),
        "jobs_by_type_status": await _counts_by(
            db,
            ProjectJobRow,
            ProjectJobRow.job_type,
            ProjectJobRow.status,
        ),
        "funnel_metrics": await _funnel_metrics(db),
        "usage_by_event_type": await _counts_by(
            db,
            ProjectUsageEventRow,
            ProjectUsageEventRow.event_type,
        ),
        "recent_leads": recent_leads,
    }


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Print a private-alpha operator snapshot.")
    parser.add_argument("--show-emails", action="store_true", help="Include raw lead emails in output.")
    parser.add_argument("--recent-limit", type=int, default=10, help="Recent lead rows to include, capped at 50.")
    args = parser.parse_args()

    engine.echo = False
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    async with async_session() as db:
        snapshot = await build_operator_snapshot(
            db,
            include_emails=args.show_emails,
            recent_limit=args.recent_limit,
        )
    print(json.dumps(snapshot, indent=2, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(_main())
