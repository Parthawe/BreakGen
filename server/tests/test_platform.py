"""Tests for platform manifests and provider catalogs."""

from __future__ import annotations

import pytest

from server.api.platform import (
    get_generation_providers,
    get_hardware_modules,
    get_product_domains,
    get_product_families,
)


@pytest.mark.anyio
async def test_product_families_expose_shared_workspace_stages():
    families = await get_product_families()
    ids = {entry["family"] for entry in families}

    assert {
        "keyboard",
        "macropad",
        "streamdeck",
        "midi",
        "gamepad",
        "pedal_controller",
        "breath_controller",
        "handheld_companion",
    } <= ids
    keyboard = next(entry for entry in families if entry["family"] == "keyboard")
    assert [stage["id"] for stage in keyboard["stages"]] == [
        "define",
        "layout",
        "appearance",
        "electronics",
        "validate",
        "export",
    ]
    assert "layout_editor" in keyboard["editor_modules"]
    gamepad = next(entry for entry in families if entry["family"] == "gamepad")
    assert gamepad["domain"] == "control_surface"
    assert "input_button" in gamepad["supported_module_types"]
    pedal = next(entry for entry in families if entry["family"] == "pedal_controller")
    assert pedal["domain"] == "control_surface"
    assert pedal["status"] == "proof"
    assert "input_slider" in pedal["supported_module_types"]
    midi = next(entry for entry in families if entry["family"] == "midi")
    assert "input_pad" in midi["supported_module_types"]
    breath = next(entry for entry in families if entry["family"] == "breath_controller")
    assert breath["domain"] == "control_surface"
    assert breath["status"] == "proof"
    assert "input_sensor" in breath["supported_module_types"]
    assert "input_microphone" in breath["supported_module_types"]
    handheld = next(entry for entry in families if entry["family"] == "handheld_companion")
    assert handheld["domain"] == "handheld"
    assert handheld["status"] == "proof"
    assert "output_display" in handheld["supported_module_types"]
    assert "input_microphone" in handheld["supported_module_types"]


@pytest.mark.anyio
async def test_product_domains_group_enabled_families():
    domains = await get_product_domains()
    control_surface = next(entry for entry in domains if entry["domain"] == "control_surface")
    handheld = next(entry for entry in domains if entry["domain"] == "handheld")
    assert "keyboard" in control_surface["enabled_families"]
    assert "gamepad" in control_surface["enabled_families"]
    assert "pedal_controller" not in control_surface["enabled_families"]
    assert "breath_controller" not in control_surface["enabled_families"]
    assert "handheld_companion" not in handheld["enabled_families"]
    assert handheld["status"] == "planned"


@pytest.mark.anyio
async def test_hardware_modules_can_be_filtered_by_family():
    modules = await get_hardware_modules(family="gamepad")
    module_ids = {entry["module_id"] for entry in modules}
    assert {"tact_button", "thumb_joystick", "rp2040_devboard"} <= module_ids


@pytest.mark.anyio
async def test_hardware_modules_include_midi_pad_modules():
    modules = await get_hardware_modules(family="midi")
    module_ids = {entry["module_id"] for entry in modules}
    assert "rubber_drum_pad" in module_ids


@pytest.mark.anyio
async def test_hardware_modules_include_pedal_controller_modules():
    modules = await get_hardware_modules(family="pedal_controller")
    module_ids = {entry["module_id"] for entry in modules}
    assert {"stomp_switch", "expression_pedal", "rp2040_devboard"} <= module_ids


@pytest.mark.anyio
async def test_hardware_modules_include_breath_controller_modules():
    modules = await get_hardware_modules(family="breath_controller")
    module_ids = {entry["module_id"] for entry in modules}
    assert {"pressure_sensor", "bite_sensor", "mems_microphone", "rp2040_devboard"} <= module_ids


@pytest.mark.anyio
async def test_hardware_modules_include_handheld_companion_modules():
    modules = await get_hardware_modules(family="handheld_companion")
    module_ids = {entry["module_id"] for entry in modules}
    assert {
        "tact_button",
        "oled_128x64",
        "speaker_40mm",
        "mems_microphone",
        "lipo_1000mah",
        "usb_c_port",
        "rp2040_devboard",
    } <= module_ids


@pytest.mark.anyio
async def test_generation_providers_include_live_and_planned_backends():
    providers = await get_generation_providers()
    provider_ids = {entry["id"] for entry in providers}

    assert {"meshy", "shell_library", "tripo", "hyper3d_rodin"} <= provider_ids
    meshy = next(entry for entry in providers if entry["id"] == "meshy")
    assert meshy["supported_asset_types"] == ["keycap"]
