"""Static platform manifests for product domains, families, and workspace stages."""

from __future__ import annotations

from collections import defaultdict

from server.models.platform import (
    ProductDomainManifest,
    ProductFamilyManifest,
    WorkspaceStageManifest,
)
from server.models.project import ProductDomain, ProductFamily, domain_for_family
from server.models.supported_configs import SUPPORTED_TEMPLATES
from server.services.hardware_catalog import list_hardware_modules


def _base_stages() -> list[WorkspaceStageManifest]:
    return [
        WorkspaceStageManifest(
            id="define",
            label="Define",
            description="Choose a starting template and hardware baseline.",
            requires_project=False,
            modules=["template_selector", "switch_explorer"],
            preview_mode="3d",
        ),
        WorkspaceStageManifest(
            id="layout",
            label="Layout",
            description="Arrange controls, modules, spacing, and rotation.",
            modules=["layout_editor"],
            preview_mode="3d",
        ),
        WorkspaceStageManifest(
            id="appearance",
            label="Appearance",
            description="Generate and assign visible surface assets.",
            modules=["keycap_styler"],
            preview_mode="3d",
        ),
        WorkspaceStageManifest(
            id="electronics",
            label="Electronics",
            description="Compile electronics and firmware metadata from the layout.",
            modules=["pcb_panel"],
            preview_mode="3d",
        ),
        WorkspaceStageManifest(
            id="validate",
            label="Validate",
            description="Check fit, supportability, and export readiness.",
            modules=["export_panel"],
            preview_mode="3d",
        ),
        WorkspaceStageManifest(
            id="export",
            label="Export",
            description="Package fabrication outputs and traceable artifacts.",
            modules=["export_panel"],
            preview_mode="3d",
        ),
    ]


FAMILY_METADATA: dict[ProductFamily, dict[str, object]] = {
    ProductFamily.KEYBOARD: {
        "display_name": "Keyboard",
        "description": "Programmable mechanical keyboard layouts with full geometry, PCB, firmware, and export flow.",
        "status": "enabled",
        "capabilities": [
            "switch_catalog",
            "layout_editing",
            "keycap_generation",
            "pcb_compile",
            "plate_geometry",
            "firmware_export",
        ],
        "module_types": ["input_switch", "compute"],
    },
    ProductFamily.MACROPAD: {
        "display_name": "Macro Pad",
        "description": "Compact shortcut pads that reuse the same layout, asset, and fabrication pipeline.",
        "status": "enabled",
        "capabilities": [
            "switch_catalog",
            "layout_editing",
            "keycap_generation",
            "pcb_compile",
            "plate_geometry",
            "firmware_export",
        ],
        "module_types": ["input_switch", "output_display", "compute"],
    },
    ProductFamily.STREAMDECK: {
        "display_name": "Stream Deck",
        "description": "Wide-spaced control surfaces for scene changes, macro triggering, and dashboard control.",
        "status": "enabled",
        "capabilities": [
            "switch_catalog",
            "layout_editing",
            "keycap_generation",
            "plate_geometry",
            "firmware_export",
            "display_surfaces",
        ],
        "module_types": ["input_switch", "input_encoder", "input_pad", "output_display", "compute"],
    },
    ProductFamily.MIDI: {
        "display_name": "MIDI Controller",
        "description": "Programmable music controllers built on the same revisioned layout and export backbone.",
        "status": "enabled",
        "capabilities": [
            "switch_catalog",
            "layout_editing",
            "keycap_generation",
            "plate_geometry",
            "firmware_export",
            "midi_mapping",
        ],
        "module_types": ["input_switch", "input_encoder", "output_display", "compute"],
    },
    ProductFamily.GAMEPAD: {
        "display_name": "Gamepad",
        "description": "Button-centric controller surfaces for games, HID input, and experimental control devices.",
        "status": "enabled",
        "capabilities": [
            "layout_editing",
            "button_mapping",
            "panel_geometry",
            "firmware_export",
        ],
        "module_types": ["input_button", "input_joystick", "compute"],
    },
    ProductFamily.PEDAL_CONTROLLER: {
        "display_name": "Pedal Controller",
        "description": "Foot-operated performance controllers with stomp switches, expression input, MIDI mapping, and panel exports.",
        "status": "proof",
        "capabilities": [
            "layout_editing",
            "button_mapping",
            "expression_mapping",
            "panel_geometry",
            "firmware_export",
            "midi_mapping",
        ],
        "module_types": ["input_button", "input_slider", "compute"],
    },
    ProductFamily.BREATH_CONTROLLER: {
        "display_name": "Breath Controller",
        "description": "Expressive wind-style MIDI controllers with breath pressure, bite sensing, microphone input, and octave controls.",
        "status": "proof",
        "capabilities": [
            "layout_editing",
            "breath_mapping",
            "sensor_validation",
            "panel_geometry",
            "firmware_export",
            "midi_mapping",
        ],
        "module_types": ["input_sensor", "input_microphone", "input_button", "output_display", "compute"],
    },
    ProductFamily.HANDHELD_COMPANION: {
        "display_name": "Handheld Companion",
        "description": "Portable display-first electronics with controls, battery power, charging/data access, audio, microphone input, and enclosure access planning.",
        "status": "proof",
        "capabilities": [
            "layout_editing",
            "panel_geometry",
            "display_surfaces",
            "power_validation",
            "audio_layout",
            "voice_input",
            "shell_proof_export",
            "firmware_export",
        ],
        "module_types": ["input_button", "input_joystick", "input_microphone", "output_display", "power", "audio_output", "io_port", "compute"],
    },
}


DOMAIN_METADATA: dict[ProductDomain, dict[str, str]] = {
    ProductDomain.CONTROL_SURFACE: {
        "display_name": "Control Surfaces",
        "description": "Keyboards, pads, decks, instruments, and controllers that combine tactile inputs with deterministic electronics.",
    },
    ProductDomain.HANDHELD: {
        "display_name": "Handhelds",
        "description": "Portable electronic companions with displays, power, sound, and custom shells.",
    },
    ProductDomain.AMBIENT_DEVICE: {
        "display_name": "Ambient Devices",
        "description": "Desktop and home electronics that combine enclosures, sensors, lighting, and sound.",
    },
    ProductDomain.WEARABLE: {
        "display_name": "Wearables",
        "description": "Body-adjacent electronic objects where ergonomics and enclosure design matter together.",
    },
}


def _family_stage_overrides() -> dict[ProductFamily, dict[str, dict[str, object]]]:
    return {
        ProductFamily.KEYBOARD: {
            "define": {
                "description": "Choose a keyboard template and switch profile.",
                "modules": ["template_selector", "switch_explorer"],
            },
            "layout": {"description": "Edit key positions, widths, stabilizers, and rotation."},
            "appearance": {"description": "Generate keycap variants and assign them to the layout."},
            "electronics": {"description": "Compile the switch matrix, plate geometry, and firmware metadata."},
        },
        ProductFamily.MACROPAD: {
            "define": {
                "description": "Choose a macro pad template and switch profile.",
                "modules": ["template_selector", "switch_explorer"],
            },
            "layout": {"description": "Arrange macro keys and optional display positions."},
        },
        ProductFamily.STREAMDECK: {
            "define": {
                "description": "Choose a control-surface template and switch profile.",
                "modules": ["template_selector", "switch_explorer"],
            },
            "layout": {"description": "Arrange control keys, encoders, and screen-aligned positions."},
        },
        ProductFamily.MIDI: {
            "define": {
                "description": "Choose a MIDI controller template and switch profile.",
                "modules": ["template_selector", "switch_explorer"],
            },
            "layout": {"description": "Arrange keys, encoders, and control spacing without pretending everything is a key."},
            "electronics": {"description": "Compile controller mapping metadata from the current layout."},
        },
        ProductFamily.GAMEPAD: {
            "define": {
                "description": "Choose a gamepad template and button baseline.",
                "modules": ["template_selector"],
            },
            "layout": {"description": "Arrange buttons and control clusters for balanced reach and enclosure fit."},
            "appearance": {"description": "Style caps, face buttons, and shell treatments."},
            "electronics": {"description": "Compile HID-facing button metadata and panel geometry."},
        },
        ProductFamily.PEDAL_CONTROLLER: {
            "define": {
                "description": "Choose a pedal controller template and foot-control baseline.",
                "modules": ["template_selector"],
            },
            "layout": {"description": "Arrange footswitches and expression controls for clearance, routing, and panel fit."},
            "appearance": {"description": "Style switch caps, tread surfaces, and non-structural faceplate treatments."},
            "electronics": {"description": "Compile MIDI-facing footswitch and expression-control metadata."},
        },
        ProductFamily.BREATH_CONTROLLER: {
            "define": {
                "description": "Choose a breath-controller template with sensor, mic, and octave-control assumptions.",
                "modules": ["template_selector"],
            },
            "layout": {"description": "Arrange pressure sensors, microphone pickup, buttons, and status surfaces for instrument fit."},
            "appearance": {"description": "Style visible controls and panels while keeping mouthpiece and sensor geometry deterministic."},
            "electronics": {"description": "Compile MIDI breath, bite, and octave-control metadata."},
        },
        ProductFamily.HANDHELD_COMPANION: {
            "define": {
                "description": "Choose a handheld proof template with display, audio, power, and shell-access assumptions.",
                "modules": ["template_selector"],
            },
            "layout": {"description": "Arrange displays, controls, speaker zones, battery volume, and service access."},
            "appearance": {"description": "Style visible controls and shell-facing surfaces without claiming full enclosure generation yet."},
            "electronics": {"description": "Compile portable control metadata and check power/audio-access assumptions."},
        },
    }


def list_product_domain_manifests() -> list[ProductDomainManifest]:
    """Return top-level product domains exposed by the app shell."""
    enabled_families_by_domain: dict[ProductDomain, list[ProductFamily]] = defaultdict(list)
    for family, meta in FAMILY_METADATA.items():
        if meta.get("status", "enabled") == "enabled":
            enabled_families_by_domain[domain_for_family(family)].append(family)

    manifests: list[ProductDomainManifest] = []
    for domain in ProductDomain:
        meta = DOMAIN_METADATA[domain]
        enabled_families = enabled_families_by_domain.get(domain, [])
        manifests.append(
            ProductDomainManifest(
                domain=domain,
                display_name=meta["display_name"],
                description=meta["description"],
                enabled_families=enabled_families,
                status="enabled" if enabled_families else "planned",
            )
        )
    return manifests


def list_product_family_manifests() -> list[ProductFamilyManifest]:
    """Return workspace manifests for enabled and proof-stage product families."""
    templates_by_family: dict[ProductFamily, list[str]] = defaultdict(list)
    for template in SUPPORTED_TEMPLATES:
        templates_by_family[template.product_family].append(template.template_id)

    overrides = _family_stage_overrides()
    base = _base_stages()
    manifests: list[ProductFamilyManifest] = []
    for family, meta in FAMILY_METADATA.items():
        family_stages: list[WorkspaceStageManifest] = []
        for stage in base:
            stage_copy = stage.model_copy(deep=True)
            override = overrides.get(family, {}).get(stage.id, {})
            if "description" in override:
                stage_copy.description = str(override["description"])
            if "modules" in override:
                stage_copy.modules = list(override["modules"])
            family_stages.append(stage_copy)

        modules = sorted({module for stage in family_stages for module in stage.modules})
        supported_modules = sorted({
            module.module_type
            for module in list_hardware_modules(family=family)
        })
        manifests.append(
            ProductFamilyManifest(
                domain=domain_for_family(family),
                family=family,
                display_name=str(meta["display_name"]),
                description=str(meta["description"]),
                status=str(meta.get("status", "enabled")),
                stages=family_stages,
                required_inputs=["template", "layout"],
                supported_capabilities=list(meta["capabilities"]),
                available_templates=templates_by_family.get(family, []),
                editor_modules=modules,
                supported_module_types=supported_modules or list(meta["module_types"]),
            )
        )
    return manifests
