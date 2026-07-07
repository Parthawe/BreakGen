"""Usage and billing-intent event helpers."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.models import ProjectUsageEventRow


def record_usage_event(
    db: AsyncSession,
    *,
    event_type: str,
    user_id: int | None = None,
    project_id: str | None = None,
    revision: int | None = None,
    provider: str | None = None,
    quantity: int = 1,
    unit: str = "event",
    source: str = "server",
    metadata: dict[str, Any] | None = None,
    created_at: datetime | None = None,
) -> ProjectUsageEventRow:
    """Create a durable usage event row; commit is managed by the caller."""
    row = ProjectUsageEventRow(
        user_id=user_id,
        project_id=project_id,
        revision=revision,
        event_type=event_type.strip().lower(),
        provider=provider,
        quantity=max(int(quantity), 0),
        unit=unit.strip().lower() or "event",
        source=source.strip().lower() or "server",
        event_metadata=metadata or {},
        created_at=created_at or datetime.now(timezone.utc),
    )
    db.add(row)
    return row


async def usage_event_exists(
    db: AsyncSession,
    *,
    event_type: str,
    user_id: int | None = None,
    project_id: str | None = None,
    revision: int | None = None,
) -> bool:
    """Return whether a matching usage event already exists."""
    normalized = event_type.strip().lower()
    stmt = select(func.count()).select_from(ProjectUsageEventRow).where(
        ProjectUsageEventRow.event_type == normalized
    )
    if user_id is not None:
        stmt = stmt.where(ProjectUsageEventRow.user_id == user_id)
    if project_id is not None:
        stmt = stmt.where(ProjectUsageEventRow.project_id == project_id)
    if revision is not None:
        stmt = stmt.where(ProjectUsageEventRow.revision == revision)
    result = await db.execute(stmt)
    return int(result.scalar_one()) > 0


async def record_usage_event_once(
    db: AsyncSession,
    *,
    event_type: str,
    user_id: int | None = None,
    project_id: str | None = None,
    revision: int | None = None,
    dedupe_revision: bool = True,
    provider: str | None = None,
    quantity: int = 1,
    unit: str = "event",
    source: str = "server",
    metadata: dict[str, Any] | None = None,
    created_at: datetime | None = None,
) -> ProjectUsageEventRow | None:
    """Create one durable usage event for a project/revision transition."""
    exists = await usage_event_exists(
        db,
        event_type=event_type,
        user_id=user_id,
        project_id=project_id,
        revision=revision if dedupe_revision else None,
    )
    if exists:
        return None
    return record_usage_event(
        db,
        event_type=event_type,
        user_id=user_id,
        project_id=project_id,
        revision=revision,
        provider=provider,
        quantity=quantity,
        unit=unit,
        source=source,
        metadata=metadata,
        created_at=created_at,
    )


async def list_usage_events(
    db: AsyncSession,
    *,
    user_id: int | None = None,
    project_id: str | None = None,
    limit: int = 100,
) -> list[ProjectUsageEventRow]:
    """List newest usage events, optionally scoped by user and project."""
    stmt = select(ProjectUsageEventRow)
    if user_id is not None:
        stmt = stmt.where(ProjectUsageEventRow.user_id == user_id)
    if project_id is not None:
        stmt = stmt.where(ProjectUsageEventRow.project_id == project_id)
    result = await db.execute(
        stmt.order_by(ProjectUsageEventRow.created_at.desc()).limit(max(1, min(limit, 500)))
    )
    return list(result.scalars().all())


async def summarize_usage_events(
    db: AsyncSession,
    *,
    user_id: int | None = None,
    project_id: str | None = None,
) -> dict[str, Any]:
    """Return a Stripe-compatible usage summary without billing anyone."""
    rows = await list_usage_events(
        db,
        user_id=user_id,
        project_id=project_id,
        limit=500,
    )
    totals: dict[str, int] = defaultdict(int)
    units: dict[str, str] = {}
    last_seen: dict[str, str] = {}
    billing_intents: list[dict[str, Any]] = []

    for row in rows:
        totals[row.event_type] += row.quantity
        units[row.event_type] = row.unit
        if row.event_type not in last_seen and row.created_at:
            last_seen[row.event_type] = row.created_at.isoformat()
        if row.event_type == "billing_intent":
            billing_intents.append(serialize_usage_event(row))

    return {
        "project_id": project_id,
        "user_id": user_id,
        "totals": [
            {
                "event_type": event_type,
                "quantity": quantity,
                "unit": units.get(event_type, "event"),
                "last_seen_at": last_seen.get(event_type),
            }
            for event_type, quantity in sorted(totals.items())
        ],
        "billing_intents": billing_intents[:20],
        "metering_state": "instrumented_not_billed",
    }


async def usage_total(
    db: AsyncSession,
    *,
    event_type: str,
    user_id: int | None = None,
    project_id: str | None = None,
) -> int:
    """Return total recorded quantity for one usage event type."""
    normalized = event_type.strip().lower()
    stmt = select(func.coalesce(func.sum(ProjectUsageEventRow.quantity), 0)).where(
        ProjectUsageEventRow.event_type == normalized
    )
    if user_id is not None:
        stmt = stmt.where(ProjectUsageEventRow.user_id == user_id)
    if project_id is not None:
        stmt = stmt.where(ProjectUsageEventRow.project_id == project_id)
    result = await db.execute(stmt)
    return int(result.scalar_one())


def serialize_usage_event(row: ProjectUsageEventRow) -> dict[str, Any]:
    """Serialize a usage event without exposing unrelated internal state."""
    return {
        "id": row.id,
        "user_id": row.user_id,
        "project_id": row.project_id,
        "revision": row.revision,
        "event_type": row.event_type,
        "provider": row.provider,
        "quantity": row.quantity,
        "unit": row.unit,
        "source": row.source,
        "metadata": row.event_metadata,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
