"""Tests for family-aware electronics compilation."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.api.pcb import compile_pcb
from server.db.models import Base, ProjectRow
from server.eda.control_surface_electronics import (
    apply_project_matrix,
    compile_control_surface_electronics,
    compile_project_matrix,
)
from server.firmware.qmk_generator import generate_qmk_info
from server.models.project import KeyboardProject, LayoutSpec, ProductFamily
from server.services.project_state import create_project_record


TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def _project_from_template(template_id: str) -> KeyboardProject:
    with open(TEMPLATES_DIR / f"{template_id}.json") as f:
        data = json.load(f)
    project = KeyboardProject(
        project_id=f"{template_id}_test",
        name=template_id,
        layout=LayoutSpec(**data["layout"]),
    )
    if template_id.startswith("midi_"):
        project.product_family = ProductFamily.MIDI
    elif template_id.startswith("streamdeck_"):
        project.product_family = ProductFamily.STREAMDECK
    elif template_id.startswith("gamepad_"):
        project.product_family = ProductFamily.GAMEPAD
    elif template_id.startswith("pedal_"):
        project.product_family = ProductFamily.PEDAL_CONTROLLER
    elif template_id.startswith("breath_"):
        project.product_family = ProductFamily.BREATH_CONTROLLER
    elif template_id.startswith("handheld_"):
        project.product_family = ProductFamily.HANDHELD_COMPANION
    if project.product_family.value in {"keyboard", "macropad", "streamdeck", "midi"}:
        project.switch_profile.part_id = "cherry_mx_red"
    return project


async def _make_session(tmp_path: Path):
    db_path = tmp_path / "electronics.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, session_factory


def test_midi_electronics_use_balanced_matrix():
    project = _project_from_template("midi_25key")
    electronics = compile_control_surface_electronics(project)

    assert electronics.matrix_strategy == "balanced"
    assert electronics.matrix.matrix_rows == 5
    assert electronics.matrix.matrix_cols == 5
    assert electronics.matrix_pins == 10
    assert electronics.direct_pins == 8
    assert electronics.total_pins == 18
    assert electronics.firmware_target == "midi_control_surface"
    assert electronics.control_protocol == "usb_midi"


def test_midi_pad_electronics_use_direct_pad_inputs():
    project = _project_from_template("midi_pad_4x4")
    electronics = compile_control_surface_electronics(project)

    assert electronics.matrix_strategy == "balanced"
    assert electronics.matrix.matrix_rows == 0
    assert electronics.matrix.matrix_cols == 0
    assert electronics.matrix_pins == 0
    assert electronics.direct_pins == 24
    assert electronics.total_pins == 24
    assert electronics.firmware_target == "midi_control_surface"
    assert electronics.control_protocol == "usb_midi"
    usage = {item.element_type: item.total_pins for item in electronics.direct_pin_usage}
    assert usage["encoder"] == 8
    assert usage["pad"] == 16


def test_streamdeck_uses_control_surface_firmware_target():
    project = _project_from_template("streamdeck_display_3x5")
    electronics = compile_control_surface_electronics(project)

    assert electronics.firmware_target == "hid_control_surface"
    assert electronics.control_protocol == "usb_hid_control_surface"


def test_gamepad_electronics_use_balanced_matrix():
    project = _project_from_template("gamepad_compact")
    electronics = compile_control_surface_electronics(project)

    assert electronics.matrix_strategy == "balanced"
    assert electronics.matrix.matrix_rows == 3
    assert electronics.matrix.matrix_cols == 4
    assert electronics.matrix_pins == 7
    assert electronics.direct_pins == 3
    assert electronics.total_pins == 10
    assert electronics.firmware_target == "hid_gamepad"
    assert electronics.control_protocol == "usb_hid_gamepad"
    assert electronics.direct_pin_usage[0].element_type == "joystick"
    assert electronics.direct_pin_usage[0].total_pins == 3


def test_pedal_controller_electronics_use_midi_expression_semantics():
    project = _project_from_template("pedal_controller_3switch")
    electronics = compile_control_surface_electronics(project)

    assert electronics.matrix_strategy == "balanced"
    assert electronics.matrix.matrix_rows == 2
    assert electronics.matrix.matrix_cols == 2
    assert electronics.matrix_pins == 4
    assert electronics.direct_pins == 1
    assert electronics.total_pins == 5
    assert electronics.firmware_target == "midi_pedal_controller"
    assert electronics.control_protocol == "usb_midi"
    assert electronics.direct_pin_usage[0].element_type == "slider"


def test_breath_controller_electronics_use_sensor_and_mic_inputs():
    project = _project_from_template("breath_controller_basic")
    electronics = compile_control_surface_electronics(project)

    assert electronics.matrix_strategy == "balanced"
    assert electronics.matrix.matrix_rows == 1
    assert electronics.matrix.matrix_cols == 2
    assert electronics.matrix_pins == 3
    assert electronics.direct_pins == 9
    assert electronics.total_pins == 12
    assert electronics.firmware_target == "midi_breath_controller"
    assert electronics.control_protocol == "usb_midi"
    usage = {item.element_type: item.total_pins for item in electronics.direct_pin_usage}
    assert usage["sensor"] == 4
    assert usage["microphone"] == 1
    assert usage["display"] == 4


def test_handheld_companion_electronics_use_shell_module_baseline():
    project = _project_from_template("handheld_companion_compact")
    electronics = compile_control_surface_electronics(project)

    assert electronics.matrix_strategy == "balanced"
    assert electronics.matrix.matrix_rows == 3
    assert electronics.matrix.matrix_cols == 3
    assert electronics.matrix_pins == 6
    assert electronics.direct_pins == 7
    assert electronics.total_pins == 13
    assert electronics.firmware_target == "handheld_companion_proof"
    assert electronics.control_protocol == "usb_hid_companion"
    usage = {item.element_type: item.total_pins for item in electronics.direct_pin_usage}
    assert usage["display"] == 4
    assert usage["speaker"] == 2
    assert usage["microphone"] == 1


def test_firmware_info_includes_breakgen_family_metadata():
    project = _project_from_template("midi_25key")
    matrix, _ = compile_project_matrix(project)
    apply_project_matrix(project, matrix)
    info = generate_qmk_info(project, matrix)

    assert info["breakgen"]["product_family"] == "midi"
    assert info["breakgen"]["firmware_target"] == "midi_control_surface"
    assert info["breakgen"]["control_protocol"] == "usb_midi"
    assert info["breakgen"]["matrix_strategy"] == "balanced"


@pytest.mark.anyio
async def test_compile_pcb_persists_family_aware_electronics_summary(tmp_path: Path):
    engine, session_factory = await _make_session(tmp_path)
    try:
        async with session_factory() as db:
            project = _project_from_template("midi_25key")
            await create_project_record(db, project, change_summary="Project created")

            response = await compile_pcb(project.project_id, db)
            row = (
                await db.execute(
                    select(ProjectRow).where(ProjectRow.project_id == project.project_id)
                )
            ).scalar_one()

            assert response["status"] == "electronics_compiled"
            assert response["matrix_strategy"] == "balanced"
            assert response["firmware_target"] == "midi_control_surface"
            assert response["pins_needed"] == 18
            assert row.revision == 2
            assert row.data["derived"]["electronics"]["matrix_strategy"] == "balanced"
            assert row.data["derived"]["electronics"]["firmware_target"] == "midi_control_surface"
            matrix_elements = [
                element
                for element in row.data["layout"]["elements"]
                if element["element_type"] == "key_switch"
            ]
            assert matrix_elements[0]["row"] is not None
            assert matrix_elements[0]["col"] is not None
    finally:
        await engine.dispose()
