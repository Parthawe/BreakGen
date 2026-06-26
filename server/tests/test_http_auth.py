"""HTTP-level authorization regression tests."""

from __future__ import annotations

from pathlib import Path
from typing import Any
from datetime import datetime, timedelta, timezone

import httpx
import jwt
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.db.database import get_db
from server.db.models import Base
from server.main import app
from server.api.auth import MAX_BCRYPT_PASSWORD_BYTES, settings as auth_settings
from server.models.project import MAX_LAYOUT_ELEMENTS
from server.services.rate_limit import reset_rate_limits


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


async def _make_session(tmp_path: Path):
    db_path = tmp_path / "http-auth.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, session_factory


async def _signup(client: httpx.AsyncClient, email: str) -> str:
    response = await client.post(
        "/api/auth/signup",
        json={
            "email": email,
            "name": email.split("@")[0],
            "password": "strong-password",
        },
    )
    assert response.status_code == 200
    return response.json()["token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.anyio
async def test_auth_providers_describe_active_and_planned_methods(monkeypatch):
    monkeypatch.setattr("server.api.auth.settings.google_oauth_client_id", "")
    monkeypatch.setattr("server.api.auth.settings.google_oauth_client_secret", "")
    monkeypatch.setattr("server.api.auth.settings.apple_oauth_client_id", "")
    monkeypatch.setattr("server.api.auth.settings.apple_oauth_team_id", "")
    monkeypatch.setattr("server.api.auth.settings.apple_oauth_key_id", "")
    monkeypatch.setattr("server.api.auth.settings.apple_oauth_private_key", "")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/auth/providers")

    assert response.status_code == 200
    data = response.json()
    assert data["password"]["enabled"] is True
    assert data["password"]["status"] == "active"

    providers = {provider["id"]: provider for provider in data["providers"]}
    assert providers["google"]["enabled"] is False
    assert providers["google"]["configured"] is False
    assert providers["google"]["status"] == "credentials_required"
    assert providers["apple"]["enabled"] is False
    assert providers["apple"]["configured"] is False
    assert providers["apple"]["status"] == "credentials_required"


@pytest.mark.anyio
async def test_auth_providers_do_not_enable_oauth_until_callbacks_exist(monkeypatch):
    monkeypatch.setattr("server.api.auth.settings.google_oauth_client_id", "google-client")
    monkeypatch.setattr("server.api.auth.settings.google_oauth_client_secret", "google-secret")
    monkeypatch.setattr("server.api.auth.settings.apple_oauth_client_id", "apple-service-id")
    monkeypatch.setattr("server.api.auth.settings.apple_oauth_team_id", "apple-team")
    monkeypatch.setattr("server.api.auth.settings.apple_oauth_key_id", "apple-key")
    monkeypatch.setattr("server.api.auth.settings.apple_oauth_private_key", "apple-private-key")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/auth/providers")

    assert response.status_code == 200
    providers = {provider["id"]: provider for provider in response.json()["providers"]}
    assert providers["google"]["configured"] is True
    assert providers["google"]["enabled"] is False
    assert providers["google"]["status"] == "server_callback_required"
    assert providers["apple"]["configured"] is True
    assert providers["apple"]["enabled"] is False
    assert providers["apple"]["status"] == "server_callback_required"


@pytest.mark.anyio
async def test_project_routes_require_auth_and_enforce_owner_scope(tmp_path: Path, monkeypatch):
    engine, session_factory = await _make_session(tmp_path)
    artifacts_dir = tmp_path / "artifacts"
    monkeypatch.setattr("server.services.artifact_registry.settings.artifacts_dir", str(artifacts_dir))
    monkeypatch.setattr("server.export.bundler.settings.artifacts_dir", str(artifacts_dir))
    monkeypatch.setattr("server.api.auth.settings.public_signup_enabled", True)
    monkeypatch.setattr("server.api.auth.settings.signup_invite_code", "")

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)

    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            owner_token = await _signup(client, "owner@example.com")
            other_token = await _signup(client, "other@example.com")

            proof_family = await client.post(
                "/api/projects/",
                headers=_auth(owner_token),
                json={
                    "name": "Proof Pedal",
                    "template_id": "pedal_controller_3switch",
                    "product_family": "pedal_controller",
                },
            )
            assert proof_family.status_code == 400
            assert "not enabled" in proof_family.json()["detail"]

            created = await client.post(
                "/api/projects/",
                headers=_auth(owner_token),
                json={
                    "name": "Owner Stream Deck",
                    "template_id": "streamdeck_3x5",
                    "product_family": "streamdeck",
                },
            )
            assert created.status_code == 201
            project_id = created.json()["project_id"]

            unauthenticated: list[tuple[str, str, dict[str, Any] | None]] = [
                ("GET", "/api/projects/", None),
                ("POST", "/api/projects/", {"name": "No Auth"}),
                ("GET", f"/api/projects/{project_id}", None),
                ("PATCH", f"/api/projects/{project_id}", {"name": "No Auth"}),
                ("DELETE", f"/api/projects/{project_id}", None),
                ("POST", f"/api/projects/{project_id}/compile/pcb", None),
                ("POST", f"/api/projects/{project_id}/compile/mechanical", None),
                ("POST", f"/api/projects/{project_id}/validate", None),
                ("GET", f"/api/projects/{project_id}/export/preview", None),
                ("POST", f"/api/projects/{project_id}/export", None),
                ("GET", f"/api/projects/{project_id}/records", None),
                ("GET", f"/api/projects/{project_id}/artifacts", None),
                ("GET", f"/api/projects/{project_id}/artifacts/missing_artifact/download", None),
                ("GET", f"/api/projects/{project_id}/jobs", None),
                ("GET", f"/api/projects/{project_id}/usage", None),
                ("POST", f"/api/projects/{project_id}/billing-intent", {"trigger": "export_limits"}),
                ("GET", f"/api/projects/{project_id}/quality-gate", None),
                ("GET", f"/api/projects/{project_id}/firmware/info.json", None),
            ]
            for method, path, body in unauthenticated:
                response = await client.request(method, path, json=body)
                assert response.status_code == 401, f"{method} {path}"

            other_projects = await client.get("/api/projects/", headers=_auth(other_token))
            assert other_projects.status_code == 200
            assert other_projects.json() == []

            cross_user: list[tuple[str, str, dict[str, Any] | None]] = [
                ("GET", f"/api/projects/{project_id}", None),
                ("PATCH", f"/api/projects/{project_id}", {"name": "Wrong owner", "expected_revision": 1}),
                ("DELETE", f"/api/projects/{project_id}", None),
                ("POST", f"/api/projects/{project_id}/compile/pcb", None),
                ("POST", f"/api/projects/{project_id}/compile/mechanical", None),
                ("POST", f"/api/projects/{project_id}/validate", None),
                ("GET", f"/api/projects/{project_id}/export/preview", None),
                ("POST", f"/api/projects/{project_id}/export", None),
                ("GET", f"/api/projects/{project_id}/records", None),
                ("GET", f"/api/projects/{project_id}/artifacts", None),
                ("GET", f"/api/projects/{project_id}/artifacts/missing_artifact/download", None),
                ("GET", f"/api/projects/{project_id}/jobs", None),
                ("GET", f"/api/projects/{project_id}/usage", None),
                ("POST", f"/api/projects/{project_id}/billing-intent", {"trigger": "export_limits"}),
                ("GET", f"/api/projects/{project_id}/quality-gate", None),
                ("GET", f"/api/projects/{project_id}/firmware/info.json", None),
            ]
            for method, path, body in cross_user:
                response = await client.request(method, path, headers=_auth(other_token), json=body)
                assert response.status_code == 404, f"{method} {path}: {response.text}"

            owner_read = await client.get(f"/api/projects/{project_id}", headers=_auth(owner_token))
            assert owner_read.status_code == 200
            assert owner_read.json()["name"] == "Owner Stream Deck"

            exported = await client.post(f"/api/projects/{project_id}/export", headers=_auth(owner_token))
            assert exported.status_code == 200
            monkeypatch.setattr("server.api.export.settings.free_export_bundles_per_project", 1)
            quota_blocked = await client.post(f"/api/projects/{project_id}/export", headers=_auth(owner_token))
            assert quota_blocked.status_code == 403
            assert "export limit" in quota_blocked.json()["detail"]
            monkeypatch.setattr("server.api.export.settings.free_export_bundles_per_project", 10)

            preview = await client.get(f"/api/projects/{project_id}/export/preview", headers=_auth(owner_token))
            assert preview.status_code == 200
            preview_payload = preview.json()
            assert preview_payload["project_id"] == project_id
            assert any(item["path"] == "BOM.md" for item in preview_payload["included_files"])
            assert preview_payload["bom"]["items"]

            records = await client.get(f"/api/projects/{project_id}/records", headers=_auth(owner_token))
            assert records.status_code == 200
            export_artifact = records.json()["latest_export"]
            assert export_artifact["artifact_id"]
            assert export_artifact["path"] is None
            assert records.json()["usage"]["metering_state"] == "instrumented_not_billed"
            assert {
                item["event_type"] for item in records.json()["usage"]["totals"]
            } >= {"project_created", "export_bundle"}

            billing_intent = await client.post(
                f"/api/projects/{project_id}/billing-intent",
                headers=_auth(owner_token),
                json={"trigger": "export_limits", "plan": "maker"},
            )
            assert billing_intent.status_code == 201
            assert billing_intent.json()["event_type"] == "billing_intent"

            unauth_download = await client.get(
                f"/api/projects/{project_id}/artifacts/{export_artifact['artifact_id']}/download",
            )
            assert unauth_download.status_code == 401

            cross_user_download = await client.get(
                f"/api/projects/{project_id}/artifacts/{export_artifact['artifact_id']}/download",
                headers=_auth(other_token),
            )
            assert cross_user_download.status_code == 404

            owner_download = await client.get(
                f"/api/projects/{project_id}/artifacts/{export_artifact['artifact_id']}/download",
                headers=_auth(owner_token),
            )
            assert owner_download.status_code == 200
            assert owner_download.headers["x-breakgen-artifact-id"] == export_artifact["artifact_id"]
            assert "server/" not in owner_download.headers.get("content-disposition", "")
            assert owner_download.content.startswith(b"PK")

            owner_read_after_export = await client.get(
                f"/api/projects/{project_id}",
                headers=_auth(owner_token),
            )
            assert owner_read_after_export.status_code == 200
            exports = owner_read_after_export.json()["exports"]
            assert exports["bundle_id"]
            assert exports["bundle_path"] is None

            project_artifact_dir = artifacts_dir / "projects" / project_id
            assert project_artifact_dir.exists()

            deleted = await client.delete(f"/api/projects/{project_id}", headers=_auth(owner_token))
            assert deleted.status_code == 204
            assert not project_artifact_dir.exists()

            owner_projects_after_delete = await client.get("/api/projects/", headers=_auth(owner_token))
            assert owner_projects_after_delete.status_code == 200
            assert owner_projects_after_delete.json() == []
    finally:
        app.dependency_overrides.pop(get_db, None)
        await engine.dispose()


@pytest.mark.anyio
async def test_project_update_rejects_oversized_layout_payload(tmp_path: Path, monkeypatch):
    engine, session_factory = await _make_session(tmp_path)
    monkeypatch.setattr("server.api.auth.settings.public_signup_enabled", True)
    monkeypatch.setattr("server.api.auth.settings.signup_invite_code", "")

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)

    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            token = await _signup(client, "payload-cap@example.com")
            created = await client.post(
                "/api/projects/",
                headers=_auth(token),
                json={
                    "name": "Payload Cap",
                    "template_id": "macropad_3x3",
                    "product_family": "macropad",
                },
            )
            assert created.status_code == 201
            project = created.json()

            oversized_layout = {
                "unit_pitch_mm": 19.05,
                "elements": [
                    {
                        "id": f"pad_{i}",
                        "element_type": "pad",
                        "label": str(i),
                        "x_mm": float(i),
                        "y_mm": 0.0,
                        "w_mm": 24.0,
                        "h_mm": 24.0,
                    }
                    for i in range(MAX_LAYOUT_ELEMENTS + 1)
                ],
            }
            rejected = await client.patch(
                f"/api/projects/{project['project_id']}",
                headers=_auth(token),
                json={
                    "expected_revision": project["revision"],
                    "layout": oversized_layout,
                },
            )

            assert rejected.status_code == 422
            assert "layout elements cannot exceed" in rejected.text
    finally:
        app.dependency_overrides.pop(get_db, None)
        await engine.dispose()


@pytest.mark.anyio
async def test_signup_can_be_disabled_or_invite_gated(tmp_path: Path, monkeypatch):
    engine, session_factory = await _make_session(tmp_path)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    signup_payload = {
        "email": "reviewer@example.com",
        "name": "Reviewer",
        "password": "strong-password",
    }

    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            monkeypatch.setattr("server.api.auth.settings.public_signup_enabled", False)
            disabled = await client.post("/api/auth/signup", json=signup_payload)
            assert disabled.status_code == 403
            assert disabled.json()["detail"] == "Signup is disabled"

            monkeypatch.setattr("server.api.auth.settings.public_signup_enabled", True)
            monkeypatch.setattr("server.api.auth.settings.signup_invite_code", "alpha-code")
            missing_invite = await client.post("/api/auth/signup", json=signup_payload)
            assert missing_invite.status_code == 403
            assert missing_invite.json()["detail"] == "Invalid invite code"

            invited = await client.post(
                "/api/auth/signup",
                json={**signup_payload, "invite_code": "alpha-code"},
            )
            assert invited.status_code == 200
            assert invited.json()["user"]["email"] == "reviewer@example.com"
    finally:
        app.dependency_overrides.pop(get_db, None)
        await engine.dispose()


@pytest.mark.anyio
async def test_signed_token_missing_required_claims_returns_unauthorized(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    token = jwt.encode(
        {
            "email": "reviewer@example.com",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        auth_settings.jwt_secret,
        algorithm=auth_settings.jwt_algorithm,
    )

    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/api/auth/me", headers=_auth(token))
            assert response.status_code == 401
    finally:
        app.dependency_overrides.pop(get_db, None)
        await engine.dispose()


@pytest.mark.anyio
async def test_auth_rejects_oversized_bcrypt_password_inputs(tmp_path: Path, monkeypatch):
    engine, session_factory = await _make_session(tmp_path)
    monkeypatch.setattr("server.api.auth.settings.public_signup_enabled", True)
    monkeypatch.setattr("server.api.auth.settings.signup_invite_code", "")

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    long_password = "a" * (MAX_BCRYPT_PASSWORD_BYTES + 1)

    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            signup = await client.post(
                "/api/auth/signup",
                json={
                    "email": "long@example.com",
                    "name": "Long Password",
                    "password": long_password,
                },
            )
            assert signup.status_code == 400
            assert "bytes or fewer" in signup.json()["detail"]

            token = await _signup(client, "normal@example.com")
            assert token

            login = await client.post(
                "/api/auth/login",
                json={
                    "email": "normal@example.com",
                    "password": long_password,
                },
            )
            assert login.status_code == 401
    finally:
        app.dependency_overrides.pop(get_db, None)
        await engine.dispose()


@pytest.mark.anyio
async def test_login_attempts_are_rate_limited(tmp_path: Path, monkeypatch):
    reset_rate_limits()
    engine, session_factory = await _make_session(tmp_path)
    monkeypatch.setattr("server.api.auth.settings.public_signup_enabled", True)
    monkeypatch.setattr("server.api.auth.settings.signup_invite_code", "")
    monkeypatch.setattr("server.api.auth.settings.auth_rate_limit_per_minute", 2)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)

    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            await _signup(client, "limited@example.com")
            payload = {"email": "limited@example.com", "password": "wrong-password"}

            first = await client.post("/api/auth/login", json=payload)
            second = await client.post("/api/auth/login", json=payload)
            third = await client.post("/api/auth/login", json=payload)

            assert first.status_code == 401
            assert second.status_code == 401
            assert third.status_code == 429
            assert third.headers["retry-after"]
    finally:
        reset_rate_limits()
        app.dependency_overrides.pop(get_db, None)
        await engine.dispose()


@pytest.mark.anyio
async def test_expensive_project_routes_are_rate_limited(tmp_path: Path, monkeypatch):
    reset_rate_limits()
    engine, session_factory = await _make_session(tmp_path)
    artifacts_dir = tmp_path / "artifacts"
    monkeypatch.setattr("server.services.artifact_registry.settings.artifacts_dir", str(artifacts_dir))
    monkeypatch.setattr("server.export.bundler.settings.artifacts_dir", str(artifacts_dir))
    monkeypatch.setattr("server.api.auth.settings.public_signup_enabled", True)
    monkeypatch.setattr("server.api.auth.settings.signup_invite_code", "")
    monkeypatch.setattr("server.api.generation.settings.generation_rate_limit_per_minute", 1)
    monkeypatch.setattr("server.api.pcb.settings.compile_rate_limit_per_minute", 1)
    monkeypatch.setattr("server.api.geometry.settings.compile_rate_limit_per_minute", 1)
    monkeypatch.setattr("server.api.export.settings.export_rate_limit_per_minute", 1)
    monkeypatch.setattr("server.api.export.settings.free_export_bundles_per_project", 10)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)

    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            token = await _signup(client, "expensive@example.com")
            created = await client.post(
                "/api/projects/",
                headers=_auth(token),
                json={
                    "name": "Expensive Route Limit",
                    "template_id": "macropad_3x3",
                    "product_family": "macropad",
                },
            )
            assert created.status_code == 201
            project_id = created.json()["project_id"]

            first_compile = await client.post(
                f"/api/projects/{project_id}/compile/pcb",
                headers=_auth(token),
            )
            second_compile = await client.post(
                f"/api/projects/{project_id}/compile/pcb",
                headers=_auth(token),
            )
            assert first_compile.status_code == 200
            assert second_compile.status_code == 429

            first_generate = await client.post(
                f"/api/projects/{project_id}/generate-keycaps",
                headers=_auth(token),
                json={"prompt": "machined aluminum", "variant_count": 1},
            )
            second_generate = await client.post(
                f"/api/projects/{project_id}/generate-keycaps",
                headers=_auth(token),
                json={"prompt": "machined aluminum", "variant_count": 1},
            )
            assert first_generate.status_code == 200
            assert second_generate.status_code == 429

            first_export = await client.post(
                f"/api/projects/{project_id}/export",
                headers=_auth(token),
            )
            second_export = await client.post(
                f"/api/projects/{project_id}/export",
                headers=_auth(token),
            )
            assert first_export.status_code == 200
            assert second_export.status_code == 429
    finally:
        reset_rate_limits()
        app.dependency_overrides.pop(get_db, None)
        await engine.dispose()
