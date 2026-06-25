"""HTTP tests for public launch lead capture."""

from __future__ import annotations

from pathlib import Path

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.api import launch
from server.db.database import get_db
from server.db.models import Base, LaunchLeadRow
from server.main import app


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


async def _make_session(tmp_path: Path):
    db_path = tmp_path / "launch-leads.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, session_factory


@pytest.mark.anyio
async def test_launch_lead_capture_persists_normalized_payload(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    launch._rate_events.clear()

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)

    try:
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/api/launch/leads",
                headers={"user-agent": "pytest-browser"},
                json={
                    "email": "  Maker@Example.COM  ",
                    "role": "Maker",
                    "intent": "private_alpha",
                    "note": "Building a 16-key stream deck.",
                    "surface": "landing",
                    "path": "/",
                    "referrer": "https://example.com/source",
                    "timestamp": "2026-06-25T06:00:00.000Z",
                    "utm_source": "discord",
                    "utm_campaign": "alpha",
                },
            )
            assert response.status_code == 201
            assert response.json()["status"] == "received"

        async with session_factory() as session:
            result = await session.execute(select(LaunchLeadRow))
            lead = result.scalar_one()
            assert lead.email == "maker@example.com"
            assert lead.intent == "private_alpha"
            assert lead.surface == "landing"
            assert lead.source == {
                "client_timestamp": "2026-06-25T06:00:00.000Z",
                "utm_source": "discord",
                "utm_campaign": "alpha",
            }
            assert lead.user_agent == "pytest-browser"
    finally:
        app.dependency_overrides.pop(get_db, None)
        launch._rate_events.clear()
        await engine.dispose()


@pytest.mark.anyio
async def test_launch_lead_capture_rejects_invalid_payload(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    launch._rate_events.clear()

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)

    try:
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as client:
            bad_email = await client.post(
                "/api/launch/leads",
                json={
                    "email": "not-an-email",
                    "role": "Maker",
                    "intent": "private_alpha",
                    "surface": "landing",
                },
            )
            assert bad_email.status_code == 422

            bad_intent = await client.post(
                "/api/launch/leads",
                json={
                    "email": "maker@example.com",
                    "role": "Maker",
                    "intent": "billing_probe",
                    "surface": "landing",
                },
            )
            assert bad_intent.status_code == 422
    finally:
        app.dependency_overrides.pop(get_db, None)
        launch._rate_events.clear()
        await engine.dispose()


@pytest.mark.anyio
async def test_launch_lead_capture_rate_limits(tmp_path: Path, monkeypatch):
    engine, session_factory = await _make_session(tmp_path)
    launch._rate_events.clear()
    monkeypatch.setattr("server.api.launch.settings.launch_lead_rate_limit_per_minute", 1)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    payload = {
        "email": "maker@example.com",
        "role": "Maker",
        "intent": "private_alpha",
        "surface": "landing",
    }

    try:
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as client:
            first = await client.post("/api/launch/leads", json=payload)
            assert first.status_code == 201

            second = await client.post(
                "/api/launch/leads",
                json={**payload, "email": "other@example.com"},
            )
            assert second.status_code == 429
            assert second.json()["detail"] == "Too many lead submissions; try again later"
    finally:
        app.dependency_overrides.pop(get_db, None)
        launch._rate_events.clear()
        await engine.dispose()


@pytest.mark.anyio
async def test_launch_lead_capture_persists_rate_limit_across_process_memory(tmp_path: Path, monkeypatch):
    engine, session_factory = await _make_session(tmp_path)
    launch._rate_events.clear()
    monkeypatch.setattr("server.api.launch.settings.launch_lead_rate_limit_per_minute", 1)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    payload = {
        "email": "maker@example.com",
        "role": "Maker",
        "intent": "private_alpha",
        "surface": "landing",
    }

    try:
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as client:
            first = await client.post("/api/launch/leads", json=payload)
            assert first.status_code == 201

            launch._rate_events.clear()
            second = await client.post("/api/launch/leads", json=payload)
            assert second.status_code == 429
            assert second.json()["detail"] == "Too many lead submissions; try again later"
    finally:
        app.dependency_overrides.pop(get_db, None)
        launch._rate_events.clear()
        await engine.dispose()
