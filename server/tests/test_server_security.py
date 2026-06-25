"""Tests for server-level security hardening."""

from __future__ import annotations

from pathlib import Path

import httpx
import pytest

from server.main import _resolve_frontend_file, app


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
        response = await client.get("/api/health")

    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
