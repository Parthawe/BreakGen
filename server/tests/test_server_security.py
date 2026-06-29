"""Tests for server-level security hardening."""

from __future__ import annotations

from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI, Request

from server.main import (
    RequestBodyLimitMiddleware,
    _resolve_frontend_file,
    app,
    content_security_policy,
)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def test_frontend_file_resolution_blocks_path_traversal(tmp_path: Path, monkeypatch):
    index = tmp_path / "index.html"
    index.write_text("<html></html>")
    secret = tmp_path.parent / "secret.txt"
    secret.write_text("secret")

    monkeypatch.setattr("server.main.FRONTEND_DIR", tmp_path)

    assert _resolve_frontend_file("index.html") == index.resolve()
    assert _resolve_frontend_file("../secret.txt") is None


@pytest.mark.anyio
async def test_security_headers_are_set_on_api_responses():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/health", headers={"X-Request-ID": "test-request-1"})

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "test-request-1"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


@pytest.mark.anyio
async def test_invalid_request_id_header_is_replaced():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/health", headers={"X-Request-ID": "x" * 140})

    assert response.status_code == 200
    assert response.headers["x-request-id"] != "x" * 140
    assert len(response.headers["x-request-id"]) == 32


@pytest.mark.anyio
async def test_request_body_limit_rejects_large_payloads():
    limited_app = FastAPI()
    limited_app.add_middleware(RequestBodyLimitMiddleware, max_body_bytes=16)

    @limited_app.post("/echo")
    async def echo(request: Request):
        return {"size": len(await request.body())}

    transport = httpx.ASGITransport(app=limited_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        accepted = await client.post("/echo", content=b"small")
        rejected = await client.post("/echo", content=b"x" * 17)

    assert accepted.status_code == 200
    assert accepted.json()["size"] == 5
    assert rejected.status_code == 413
    assert rejected.json()["detail"] == "Request body too large"


def test_production_csp_does_not_include_hardcoded_localhost(monkeypatch):
    monkeypatch.setattr("server.main.settings.debug", False)
    monkeypatch.setattr(
        "server.main.settings.cors_origins",
        "http://localhost:5173,https://breakgen.example",
    )

    csp = content_security_policy()

    assert "https://breakgen.example" in csp
    assert "http://localhost:5173" not in csp
    assert "ws://localhost:5173" not in csp


@pytest.mark.anyio
async def test_health_reports_unhealthy_when_database_check_fails(monkeypatch):
    async def fail_database_check() -> None:
        raise RuntimeError("database unavailable")

    monkeypatch.setattr("server.main._check_database", fail_database_check)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/health")

    assert response.status_code == 503
    assert response.json()["status"] == "unhealthy"
    assert response.json()["checks"]["database"] == "unavailable"
