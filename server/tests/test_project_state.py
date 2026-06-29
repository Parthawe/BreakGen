"""Tests for the shared project persistence contract."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.db.models import Base, ProjectRevisionRow, ProjectRow
from server.models.project import KeyboardProject, ProductFamily, ProjectStatus
from server.services.project_state import (
    commit_project_mutation,
    create_project_record,
    invalidate_derived_state,
    load_project_state,
    persist_project_metadata,
)


async def _make_session(tmp_path: Path):
    db_path = tmp_path / "project-state.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, session_factory


@pytest.mark.anyio
async def test_create_project_record_persists_current_and_initial_revision(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    created_at = datetime.now(timezone.utc)
    try:
        async with session_factory() as db:
            project = KeyboardProject(
                project_id="bg_test_create",
                product_family=ProductFamily.MACROPAD,
                name="Macro 4x4",
                status=ProjectStatus.CONFIGURED,
                created_at=created_at,
                updated_at=created_at,
            )

            payload = await create_project_record(
                db,
                project,
                change_summary="Project created",
            )

            row = (
                await db.execute(
                    select(ProjectRow).where(ProjectRow.project_id == project.project_id)
                )
            ).scalar_one()
            revisions = (
                await db.execute(
                    select(ProjectRevisionRow).where(
                        ProjectRevisionRow.project_id == project.project_id
                    )
                )
            ).scalars().all()

            assert payload["project_id"] == project.project_id
            assert row.product_family == ProductFamily.MACROPAD.value
            assert row.revision == 1
            assert len(revisions) == 1
            assert revisions[0].revision == 1
            assert revisions[0].change_summary == "Project created"
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_commit_project_mutation_bumps_revision_and_snapshots(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            project = KeyboardProject(project_id="bg_test_update", name="Before")
            await create_project_record(db, project, change_summary="Project created")

            row, loaded = await load_project_state(db, project.project_id, expected_revision=1)
            loaded.name = "After"
            loaded.status = ProjectStatus.CONFIGURED

            payload = await commit_project_mutation(
                db,
                row,
                loaded,
                change_summary="Updated: name",
            )

            refreshed = (
                await db.execute(
                    select(ProjectRow).where(ProjectRow.project_id == project.project_id)
                )
            ).scalar_one()
            revisions = (
                await db.execute(
                    select(ProjectRevisionRow)
                    .where(ProjectRevisionRow.project_id == project.project_id)
                    .order_by(ProjectRevisionRow.revision.asc())
                )
            ).scalars().all()

            assert payload["name"] == "After"
            assert refreshed.name == "After"
            assert refreshed.status == ProjectStatus.CONFIGURED.value
            assert refreshed.revision == 2
            assert len(revisions) == 2
            assert revisions[-1].revision == 2
            assert revisions[-1].change_summary == "Updated: name"
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_load_project_state_rejects_missing_and_stale_revision(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            project = KeyboardProject(project_id="bg_test_lock")
            await create_project_record(db, project, change_summary="Project created")

            with pytest.raises(HTTPException) as missing_exc:
                await load_project_state(db, "bg_missing")
            assert missing_exc.value.status_code == 404

            with pytest.raises(HTTPException) as stale_exc:
                await load_project_state(db, project.project_id, expected_revision=2)
            assert stale_exc.value.status_code == 409
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_commit_project_mutation_rechecks_expected_revision_before_commit(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as setup_db:
            project = KeyboardProject(project_id="bg_test_toctou", name="Original")
            await create_project_record(setup_db, project, change_summary="Project created")

        async with session_factory() as stale_db:
            stale_row, stale_project = await load_project_state(
                stale_db,
                "bg_test_toctou",
                expected_revision=1,
            )

            async with session_factory() as fresh_db:
                fresh_row, fresh_project = await load_project_state(
                    fresh_db,
                    "bg_test_toctou",
                    expected_revision=1,
                )
                fresh_project.name = "Fresh"
                await commit_project_mutation(
                    fresh_db,
                    fresh_row,
                    fresh_project,
                    change_summary="Fresh update",
                    expected_revision=1,
                )

            stale_project.name = "Stale"
            with pytest.raises(HTTPException) as stale_exc:
                await commit_project_mutation(
                    stale_db,
                    stale_row,
                    stale_project,
                    change_summary="Stale update",
                    expected_revision=1,
                )
            assert stale_exc.value.status_code == 409

        async with session_factory() as check_db:
            row = (
                await check_db.execute(
                    select(ProjectRow).where(ProjectRow.project_id == "bg_test_toctou")
                )
            ).scalar_one()
            assert row.name == "Fresh"
            assert row.revision == 2
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_commit_project_mutation_maps_integrity_collision_to_conflict(
    tmp_path: Path,
    monkeypatch,
):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            project = KeyboardProject(project_id="bg_test_integrity", name="Before")
            await create_project_record(db, project, change_summary="Project created")

            row, loaded = await load_project_state(db, project.project_id, expected_revision=1)
            loaded.name = "After"

            async def fail_commit():
                raise IntegrityError("insert", {}, Exception("unique revision collision"))

            monkeypatch.setattr(db, "commit", fail_commit)

            with pytest.raises(HTTPException) as conflict_exc:
                await commit_project_mutation(
                    db,
                    row,
                    loaded,
                    change_summary="Updated: name",
                    expected_revision=1,
                )

            assert conflict_exc.value.status_code == 409
            assert "Revision conflict" in conflict_exc.value.detail
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_project_state_enforces_owner_scope(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            project = KeyboardProject(project_id="bg_test_owner_scope")
            await create_project_record(
                db,
                project,
                change_summary="Project created",
                owner_user_id=10,
            )

            row, loaded = await load_project_state(
                db,
                project.project_id,
                owner_user_id=10,
            )
            assert row.user_id == 10
            assert loaded.project_id == project.project_id

            with pytest.raises(HTTPException) as wrong_owner_exc:
                await load_project_state(
                    db,
                    project.project_id,
                    owner_user_id=11,
                )
            assert wrong_owner_exc.value.status_code == 404
    finally:
        await engine.dispose()


@pytest.mark.anyio
async def test_persist_project_metadata_updates_row_without_new_revision(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            project = KeyboardProject(project_id="bg_test_metadata")
            await create_project_record(db, project, change_summary="Project created")

            row, loaded = await load_project_state(db, project.project_id, expected_revision=1)
            loaded.status = ProjectStatus.VALIDATED
            loaded.exports.validation_report_id = "vr_test"

            payload = await persist_project_metadata(db, row, loaded)

            refreshed = (
                await db.execute(
                    select(ProjectRow).where(ProjectRow.project_id == project.project_id)
                )
            ).scalar_one()
            revisions = (
                await db.execute(
                    select(ProjectRevisionRow).where(
                        ProjectRevisionRow.project_id == project.project_id
                    )
                )
            ).scalars().all()

            assert payload["revision"] == 1
            assert refreshed.revision == 1
            assert refreshed.status == ProjectStatus.VALIDATED.value
            assert len(revisions) == 1
    finally:
        await engine.dispose()


def test_invalidate_derived_state_clears_validation_and_export_metadata():
    project = KeyboardProject(project_id="bg_test_invalidate", status=ProjectStatus.EXPORTED)
    project.pcb.drc_passed = True
    project.exports.validation_report_id = "vr_123"
    project.exports.bundle_id = "bundle_123"
    project.exports.bundle_path = "/tmp/bundle.zip"
    project.exports.exported_at = datetime.now(timezone.utc)
    project.derived["electronics"] = {"source_revision": project.revision}
    project.derived["mechanical"] = {"source_revision": project.revision}

    invalidate_derived_state(project)

    assert project.status == ProjectStatus.CONFIGURED
    assert project.pcb.drc_passed is None
    assert project.exports.validation_report_id is None
    assert project.exports.bundle_id is None
    assert project.exports.bundle_path is None
    assert project.exports.exported_at is None
    assert "electronics" not in project.derived
    assert "mechanical" not in project.derived
