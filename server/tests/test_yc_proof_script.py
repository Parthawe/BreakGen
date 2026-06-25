"""Tests for the deterministic YC proof script."""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.db.models import Base
from server.scripts.run_yc_proof import run_proof


async def _make_session(tmp_path: Path):
    db_path = tmp_path / "yc-proof.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, session_factory


@pytest.mark.anyio
async def test_run_yc_proof_creates_real_bundle_and_artifacts(tmp_path: Path, monkeypatch):
    engine, session_factory = await _make_session(tmp_path)
    artifacts_dir = tmp_path / "artifacts"
    monkeypatch.setattr("server.scripts.run_yc_proof.async_session", session_factory)
    monkeypatch.setattr("server.services.artifact_registry.settings.artifacts_dir", str(artifacts_dir))
    monkeypatch.setattr("server.export.bundler.settings.artifacts_dir", str(artifacts_dir))

    try:
        summary = await run_proof(
            project_id="yc_proof_test",
            template_id="streamdeck_display_3x5",
            name="YC Proof Test",
            reset=True,
        )

        assert summary["project_id"] == "yc_proof_test"
        assert summary["product_family"] == "streamdeck"
        assert summary["revision"] == 2
        assert summary["status"] == "exported"
        assert summary["electronics"]["firmware_target"] == "hid_control_surface"
        assert summary["mechanical"]["kind"] == "panel"
        assert summary["validation"]["status"] == "pass"
        assert summary["export"]["readiness"] == "prototype_ready"
        assert summary["export"]["sha256"] and len(summary["export"]["sha256"]) == 64
        assert Path(summary["export"]["path"]).exists()
        assert [artifact["kind"] for artifact in summary["artifacts"]].count("validation_report") == 1
        assert {artifact["kind"] for artifact in summary["artifacts"]} >= {
            "mechanical_panel_dxf",
            "mechanical_panel_summary",
            "validation_report",
            "export_bundle",
        }
    finally:
        await engine.dispose()
