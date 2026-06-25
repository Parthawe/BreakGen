"""Public launch funnel endpoints."""

from __future__ import annotations

import re
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Deque

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.config import settings
from server.db.database import get_db
from server.db.models import LaunchLeadRow

router = APIRouter(prefix="/api/launch", tags=["launch"])

_ALLOWED_INTENTS = {"private_alpha", "community", "research"}
_ALLOWED_SURFACES = {"landing", "demo"}
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_RATE_WINDOW = timedelta(minutes=1)
_rate_events: dict[str, Deque[datetime]] = defaultdict(deque)


class LaunchLeadRequest(BaseModel):
    email: str = Field(max_length=320)
    role: str = Field(max_length=64)
    intent: str = Field(max_length=32)
    note: str = Field(default="", max_length=1000)
    surface: str = Field(max_length=32)
    path: str = Field(default="", max_length=512)
    referrer: str = Field(default="", max_length=1024)
    timestamp: str | None = Field(default=None, max_length=64)
    utm_source: str | None = Field(default=None, max_length=128)
    utm_medium: str | None = Field(default=None, max_length=128)
    utm_campaign: str | None = Field(default=None, max_length=128)
    utm_content: str | None = Field(default=None, max_length=128)
    utm_term: str | None = Field(default=None, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.strip().lower()
        if not _EMAIL_RE.match(email):
            raise ValueError("Enter a valid email address")
        return email

    @field_validator("role", "intent", "surface", "path", "referrer", mode="before")
    @classmethod
    def strip_string(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str) -> str:
        note = value.strip()
        if len(note) > settings.launch_lead_note_max_length:
            raise ValueError(
                f"Note must be {settings.launch_lead_note_max_length} characters or fewer"
            )
        return note

    @model_validator(mode="after")
    def validate_launch_context(self) -> "LaunchLeadRequest":
        if self.intent not in _ALLOWED_INTENTS:
            raise ValueError("Unsupported launch intent")
        if self.surface not in _ALLOWED_SURFACES:
            raise ValueError("Unsupported launch surface")
        if not self.role:
            raise ValueError("Role is required")
        if self.path and not (self.path.startswith("/") or self.path.startswith("http")):
            raise ValueError("Path must be a route path or URL")
        return self


class LaunchLeadResponse(BaseModel):
    lead_id: int
    status: str


def _client_rate_key(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _enforce_rate_limit(request: Request) -> None:
    now = datetime.now(timezone.utc)
    window_start = now - _RATE_WINDOW
    key = _client_rate_key(request)
    events = _rate_events[key]
    while events and events[0] < window_start:
        events.popleft()
    if len(events) >= settings.launch_lead_rate_limit_per_minute:
        raise HTTPException(
            status_code=429,
            detail="Too many lead submissions; try again later",
        )
    events.append(now)


async def _enforce_persisted_email_rate_limit(db: AsyncSession, email: str) -> None:
    window_start = datetime.now(timezone.utc) - _RATE_WINDOW
    result = await db.execute(
        select(func.count())
        .select_from(LaunchLeadRow)
        .where(
            LaunchLeadRow.email == email,
            LaunchLeadRow.created_at >= window_start,
        )
    )
    if int(result.scalar_one()) >= settings.launch_lead_rate_limit_per_minute:
        raise HTTPException(
            status_code=429,
            detail="Too many lead submissions; try again later",
        )


@router.post("/leads", response_model=LaunchLeadResponse, status_code=201)
async def create_launch_lead(
    req: LaunchLeadRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> LaunchLeadResponse:
    """Capture a consented public-launch lead without requiring an account."""
    _enforce_rate_limit(request)
    await _enforce_persisted_email_rate_limit(db, req.email)

    source = {
        "client_timestamp": req.timestamp,
        "utm_source": req.utm_source,
        "utm_medium": req.utm_medium,
        "utm_campaign": req.utm_campaign,
        "utm_content": req.utm_content,
        "utm_term": req.utm_term,
    }
    row = LaunchLeadRow(
        email=req.email,
        role=req.role,
        intent=req.intent,
        note=req.note,
        surface=req.surface,
        path=req.path,
        referrer=req.referrer,
        source={key: value for key, value in source.items() if value},
        user_agent=(request.headers.get("user-agent") or "")[:512],
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return LaunchLeadResponse(lead_id=row.id, status="received")
