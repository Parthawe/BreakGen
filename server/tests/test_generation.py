"""Tests for generation endpoint behavior in stub mode."""

from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.api.generation import (
    ApplyKeycapRequest,
    GenerateKeycapsRequest,
    UpdateKeycapAssetRequest,
    apply_keycap,
    generate_keycaps,
    update_keycap_asset_acceptance,
)
from server.db.models import Base, ProjectJobRow, ProjectRow
from server.models.project import (
    AcceptanceState,
    ElementType,
    KeyboardProject,
    KeycapAsset,
    LayoutSpec,
    PlacedElementSpec,
    ProjectStatus,
)
from server.services.project_state import create_project_record


async def _make_session(tmp_path: Path):
    db_path = tmp_path / "generation.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, session_factory


def test_generate_keycaps_request_bounds_variant_count():
    with pytest.raises(ValidationError):
        GenerateKeycapsRequest(prompt="too many", variant_count=9)

    with pytest.raises(ValidationError):
        GenerateKeycapsRequest(prompt="none", variant_count=0)


@pytest.mark.anyio
async def test_generate_keycaps_stub_persists_project_and_job(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            project = KeyboardProject(project_id="bg_generation_test")
            await create_project_record(db, project, change_summary="Project created")

            response = await generate_keycaps(
                "bg_generation_test",
                GenerateKeycapsRequest(prompt="industrial metal", variant_count=2),
                db,
            )

            row = (
                await db.execute(
                    select(ProjectRow).where(ProjectRow.project_id == project.project_id)
                )
            ).scalar_one()
            jobs = (
                await db.execute(
                    select(ProjectJobRow).where(ProjectJobRow.project_id == project.project_id)
                )
            ).scalars().all()

            assert response["status"] == "completed"
            assert response["revision"] == 1
            assert len(response["variants"]) == 2
            assert row.revision == 1
            assert row.status == ProjectStatus.PREVIEWABLE.value
            assert len(row.data["keycap_assets"]) == 2
            assert row.data["keycap_assets"][0]["acceptance_state"] == "preview_only"
            assert len(jobs) == 1
            assert jobs[0].status == "completed"
            assert jobs[0].revision == 1
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_accept_then_apply_keycap_uses_canonical_elements(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            project = KeyboardProject(
                project_id="bg_asset_accept_test",
                status=ProjectStatus.PREVIEWABLE,
                layout=LayoutSpec(
                    elements=[
                        PlacedElementSpec(
                            id="k00",
                            element_type=ElementType.KEY_SWITCH,
                            label="K00",
                            footprint_id="mx_switch",
                            x_mm=0,
                            y_mm=0,
                            w_mm=19.05,
                            h_mm=19.05,
                        )
                    ]
                ),
                keycap_assets=[
                    KeycapAsset(
                        asset_id="meshy_candidate",
                        source="generated",
                        provider="meshy",
                        prompt="ribbed industrial cap",
                        mesh_path="/tmp/mesh.stl",
                        preview_mesh_path="/tmp/mesh.glb",
                        normalized=True,
                        watertight=True,
                        acceptance_state=AcceptanceState.CANDIDATE,
                    )
                ],
            )
            await create_project_record(db, project, change_summary="Project created")

            accept_response = await update_keycap_asset_acceptance(
                project.project_id,
                "meshy_candidate",
                UpdateKeycapAssetRequest(
                    acceptance_state=AcceptanceState.ACCEPTED,
                    expected_revision=1,
                ),
                db,
            )
            apply_response = await apply_keycap(
                project.project_id,
                ApplyKeycapRequest(
                    asset_id="meshy_candidate",
                    expected_revision=2,
                ),
                db,
            )

            row = (
                await db.execute(
                    select(ProjectRow).where(ProjectRow.project_id == project.project_id)
                )
            ).scalar_one()

            assert accept_response["acceptance_state"] == "accepted"
            assert accept_response["revision"] == 2
            assert apply_response["asset_id"] == "meshy_candidate"
            assert apply_response["applied_to"] == 1
            assert apply_response["revision"] == 3
            assert row.revision == 3
            assert row.data["keycap_assets"][0]["acceptance_state"] == "accepted"
            assert row.data["layout"]["elements"][0]["keycap_asset_id"] == "meshy_candidate"
            assert row.data["layout"]["elements"][0]["appearance_ref"] == "meshy_candidate"
            assert row.data["layout"]["keys"][0]["keycap_asset_id"] == "meshy_candidate"
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_rejecting_candidate_asset_is_metadata_only(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            project = KeyboardProject(
                project_id="bg_asset_reject_test",
                status=ProjectStatus.PREVIEWABLE,
                keycap_assets=[
                    KeycapAsset(
                        asset_id="meshy_candidate",
                        source="generated",
                        provider="meshy",
                        prompt="soft matte",
                        mesh_path="/tmp/mesh.stl",
                        preview_mesh_path="/tmp/mesh.glb",
                        normalized=True,
                        watertight=True,
                        acceptance_state=AcceptanceState.CANDIDATE,
                    )
                ],
            )
            await create_project_record(db, project, change_summary="Project created")

            response = await update_keycap_asset_acceptance(
                project.project_id,
                "meshy_candidate",
                UpdateKeycapAssetRequest(
                    acceptance_state=AcceptanceState.REJECTED,
                    expected_revision=1,
                ),
                db,
            )

            row = (
                await db.execute(
                    select(ProjectRow).where(ProjectRow.project_id == project.project_id)
                )
            ).scalar_one()

            assert response["acceptance_state"] == "rejected"
            assert response["revision"] == 1
            assert row.revision == 1
            assert row.data["keycap_assets"][0]["acceptance_state"] == "rejected"
    finally:
        await engine.dispose()
