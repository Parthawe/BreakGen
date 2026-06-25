"""Tests for the unified mechanical compile and export endpoints."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.api.geometry import compile_mechanical, compile_shell, export_mechanical_artifact, export_plate_dxf
from server.db.models import Base, ProjectArtifactRow, ProjectRow
from server.models.project import KeyboardProject, LayoutSpec
from server.services.project_state import create_project_record


TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def _load_project(template_id: str, **overrides) -> KeyboardProject:
    with open(TEMPLATES_DIR / f"{template_id}.json") as f:
        data = json.load(f)
    payload = {
        "project_id": f"{template_id}_test",
        "name": template_id.replace("_", " ").title(),
        "product_domain": data.get("product_domain", "control_surface"),
        "product_family": data.get("product_family", "keyboard"),
        "template": template_id,
        "layout": LayoutSpec(**data["layout"]),
    }
    payload.update(overrides)
    return KeyboardProject(**payload)


async def _make_session(tmp_path: Path):
    db_path = tmp_path / "mechanical.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, session_factory


@pytest.mark.anyio
async def test_compile_mechanical_returns_panel_for_control_surfaces(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            project = _load_project("streamdeck_display_3x5")
            await create_project_record(db, project, change_summary="Project created")

            response = await compile_mechanical(project.project_id, None, db)
            stored_project = (
                await db.execute(
                    select(ProjectRow).where(ProjectRow.project_id == project.project_id)
                )
            ).scalar_one()
            artifact_rows = list(
                (
                    await db.execute(
                        select(ProjectArtifactRow).where(
                            ProjectArtifactRow.project_id == project.project_id
                        )
                    )
                ).scalars()
            )

            assert response["mechanical_kind"] == "panel"
            assert response["geometry_kind"] == "hybrid_control_panel"
            assert response["artifact_urls"]["panel_dxf"].endswith("/panel.dxf")
            assert len(response["artifact_ids"]) == 2
            assert response["compiled_at"] is not None
            assert response["plate_width_mm"] > 0
            assert response["cutout_summary"]["display"] == 1
            assert stored_project.data["derived"]["mechanical"]["summary"]["mechanical_kind"] == "panel"
            assert {row.kind for row in artifact_rows} == {
                "mechanical_panel_dxf",
                "mechanical_panel_summary",
            }
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_compile_mechanical_returns_shell_for_handheld_proof(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            project = _load_project(
                "handheld_companion_compact",
                product_family="handheld_companion",
                product_domain="handheld",
            )
            await create_project_record(db, project, change_summary="Project created")

            response = await compile_mechanical(project.project_id, None, db)
            artifact_rows = list(
                (
                    await db.execute(
                        select(ProjectArtifactRow).where(
                            ProjectArtifactRow.project_id == project.project_id
                        )
                    )
                ).scalars()
            )

            assert response["mechanical_kind"] == "shell"
            assert response["shell_kind"] == "two_piece_handheld_proof"
            assert response["artifact_urls"]["shell_spec_json"].endswith("/shell-spec.json")
            assert len(response["artifact_ids"]) == 3
            assert response["compiled_at"] is not None
            assert response["outer_shell"]["width_mm"] > 0
            assert response["control_summary"]["display"] == 1
            assert {row.kind for row in artifact_rows} == {
                "mechanical_front_shell_dxf",
                "mechanical_back_shell_dxf",
                "mechanical_shell_spec",
            }
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_compile_shell_rejects_non_handheld_family(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            project = _load_project("65_percent")
            await create_project_record(db, project, change_summary="Project created")

            with pytest.raises(HTTPException) as exc_info:
                await compile_shell(project.project_id, None, db)

            assert "handheld proof families" in exc_info.value.detail
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_export_mechanical_artifact_supports_panel_and_shell_files(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            panel_project = _load_project("gamepad_compact", product_family="gamepad")
            handheld_project = _load_project(
                "handheld_companion_compact",
                product_family="handheld_companion",
                product_domain="handheld",
            )
            await create_project_record(db, panel_project, change_summary="Project created")
            await create_project_record(db, handheld_project, change_summary="Project created")

            panel_response = await export_mechanical_artifact(
                panel_project.project_id,
                "panel.dxf",
                db,
            )
            shell_response = await export_mechanical_artifact(
                handheld_project.project_id,
                "shell-spec.json",
                db,
            )

            assert panel_response.filename.endswith("_panel.dxf")
            assert Path(panel_response.path).exists()
            assert shell_response.filename.endswith("_shell_spec.json")
            assert Path(shell_response.path).exists()
            assert "projects" in str(panel_response.path)
            assert "mechanical" in str(panel_response.path)
            assert "projects" in str(shell_response.path)
            assert "mechanical" in str(shell_response.path)
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_direct_plate_export_records_kerf_specific_artifacts(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            project = _load_project("65_percent")
            await create_project_record(db, project, change_summary="Project created")

            default_response = await export_plate_dxf(project.project_id, 0.0, db)
            kerf_response = await export_plate_dxf(project.project_id, 0.12, db)

            assert default_response.filename.endswith("_plate.dxf")
            assert kerf_response.filename.endswith("_plate.dxf")
            assert Path(default_response.path).exists()
            assert Path(kerf_response.path).exists()
            assert default_response.path != kerf_response.path

            artifact_rows = list(
                (
                    await db.execute(
                        select(ProjectArtifactRow).where(
                            ProjectArtifactRow.project_id == project.project_id,
                            ProjectArtifactRow.kind == "mechanical_panel_dxf",
                        )
                    )
                ).scalars()
            )
            configs = [row.details["compile_config"]["kerf_compensation_mm"] for row in artifact_rows]
            assert sorted(configs) == [0.0, 0.12]
            assert len({row.artifact_id for row in artifact_rows}) == 2
    finally:
        await engine.dispose()
