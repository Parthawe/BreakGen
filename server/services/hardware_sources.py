"""Hardware source and footprint provenance catalog.

This catalog is intentionally conservative. It records which footprint IDs are
grounded in established keyboard/EDA sources and which IDs are still proof
placeholders used to keep broader product families visible without overstating
manufacturing readiness.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from server.models.project import ElementType, KeyboardProject

FootprintReadiness = Literal["library_ready", "reference_only", "proof_placeholder"]


class HardwareSourceRef(BaseModel):
    """External source used to ground a hardware or firmware decision."""

    source_id: str
    display_name: str
    source_type: Literal["eda_library", "firmware_schema", "generator", "reference_guide"]
    url: str
    license: str | None = None
    license_url: str | None = None
    notes: str = ""


class FootprintSourceSpec(BaseModel):
    """BreakGen footprint ID mapped to source-backed implementation notes."""

    footprint_id: str
    display_name: str
    element_types: list[str]
    readiness: FootprintReadiness
    source_ids: list[str] = Field(default_factory=list)
    kicad_footprint: str | None = None
    qmk_feature: str | None = None
    mechanical_constraints: dict = Field(default_factory=dict)
    electrical_constraints: dict = Field(default_factory=dict)
    implementation_notes: list[str] = Field(default_factory=list)


class ProjectFootprintSourceSummary(BaseModel):
    """Source coverage for footprints used by one project."""

    used_footprints: list[dict]
    unknown_footprints: list[str]
    readiness_counts: dict[str, int]
    sources: list[HardwareSourceRef]


HARDWARE_SOURCES: dict[str, HardwareSourceRef] = {
    "kicad_official_libraries": HardwareSourceRef(
        source_id="kicad_official_libraries",
        display_name="KiCad official libraries",
        source_type="eda_library",
        url="https://www.kicad.org/libraries/",
        license="CC-BY-SA-4.0 with KiCad library exception",
        license_url="https://www.kicad.org/libraries/license/",
        notes=(
            "Use for standard symbols, footprints, and 3D package references. "
            "Redistributed library collections must retain license terms."
        ),
    ),
    "qmk_info_json": HardwareSourceRef(
        source_id="qmk_info_json",
        display_name="QMK info.json reference",
        source_type="firmware_schema",
        url="https://docs.qmk.fm/reference_info_json",
        license="GPL-compatible project documentation",
        license_url="https://github.com/qmk/qmk_firmware/blob/master/license_GPLv2.md",
        notes="Grounds keyboard metadata, matrix positions, and configurator-facing layout data.",
    ),
    "ergogen_pcbs": HardwareSourceRef(
        source_id="ergogen_pcbs",
        display_name="Ergogen PCB footprint model",
        source_type="generator",
        url="https://docs.ergogen.xyz/pcbs/",
        license="MIT",
        license_url="https://github.com/ergogen/ergogen/blob/develop/LICENSE",
        notes="Reference for placing repeated switch footprints from point-level nets.",
    ),
    "ai03_keyboard_parts_index": HardwareSourceRef(
        source_id="ai03_keyboard_parts_index",
        display_name="ai03 KiCad keyboard parts index",
        source_type="reference_guide",
        url="https://wiki.ai03.com/books/pcb-design/page/list-of-kicad-keyboard-parts-libraries",
        license=None,
        notes="Reference index for keyboard-specific KiCad footprint libraries.",
    ),
    "ai03_pcb_guide": HardwareSourceRef(
        source_id="ai03_pcb_guide",
        display_name="ai03 Keyboard PCB Guide example project",
        source_type="reference_guide",
        url="https://github.com/ai03-2725/ai03-keyboard-pcb-guide",
        license="MIT",
        license_url="https://github.com/ai03-2725/ai03-keyboard-pcb-guide/blob/master/LICENSE",
        notes="Practical keyboard PCB reference project and workflow baseline.",
    ),
}


FOOTPRINT_SPECS: dict[str, FootprintSourceSpec] = {
    "mx_switch": FootprintSourceSpec(
        footprint_id="mx_switch",
        display_name="MX-compatible switch footprint",
        element_types=[ElementType.KEY_SWITCH.value, ElementType.BUTTON.value],
        readiness="library_ready",
        source_ids=["ergogen_pcbs", "ai03_keyboard_parts_index", "qmk_info_json"],
        kicad_footprint="MX_Alps_Hybrid.pretty / Ergogen mx footprint family",
        qmk_feature="matrix key",
        mechanical_constraints={
            "unit_pitch_mm": 19.05,
            "plate_cutout_family": "mx",
            "requires_stabilizer_when_width_u_gte": 2.0,
        },
        electrical_constraints={
            "scan_model": "diode_matrix",
            "default_diode_direction": "COL2ROW",
        },
        implementation_notes=[
            "BreakGen treats this as the only library-ready V1 keyboard switch footprint.",
            "Exact KiCad symbol/footprint names should be locked when vendoring a footprint library.",
        ],
    ),
    "rotary_encoder": FootprintSourceSpec(
        footprint_id="rotary_encoder",
        display_name="Incremental rotary encoder footprint",
        element_types=[ElementType.ENCODER.value],
        readiness="reference_only",
        source_ids=["kicad_official_libraries", "qmk_info_json"],
        kicad_footprint="Rotary_Encoder family",
        qmk_feature="encoder",
        electrical_constraints={"pins_per_control": 2},
        implementation_notes=[
            "Use a specific EC11-style footprint only after the part number is selected.",
        ],
    ),
    "tact_button": FootprintSourceSpec(
        footprint_id="tact_button",
        display_name="Tactile pushbutton footprint",
        element_types=[ElementType.BUTTON.value],
        readiness="reference_only",
        source_ids=["kicad_official_libraries", "qmk_info_json"],
        kicad_footprint="Button_Switch_THT / Button_Switch_SMD family",
        qmk_feature="matrix key or direct GPIO button",
        electrical_constraints={"scan_model": "matrix_or_direct"},
    ),
    "usb_c_port": FootprintSourceSpec(
        footprint_id="usb_c_port",
        display_name="USB-C connector footprint",
        element_types=[ElementType.USB_PORT.value],
        readiness="reference_only",
        source_ids=["kicad_official_libraries", "ai03_keyboard_parts_index"],
        kicad_footprint="Connector_USB family or keyboard-specific Type-C.pretty",
        implementation_notes=[
            "Connector footprint must be locked to an orderable part before fabrication export.",
        ],
    ),
    "rubber_drum_pad": FootprintSourceSpec(
        footprint_id="rubber_drum_pad",
        display_name="Rubber drum pad input",
        element_types=[ElementType.PAD.value],
        readiness="proof_placeholder",
        electrical_constraints={"pins_per_control": 1},
        implementation_notes=[
            "Used for MIDI proof layouts; not yet tied to a vetted part footprint.",
        ],
    ),
    "thumb_joystick": FootprintSourceSpec(
        footprint_id="thumb_joystick",
        display_name="Thumb joystick module",
        element_types=[ElementType.JOYSTICK.value],
        readiness="proof_placeholder",
        electrical_constraints={"pins_per_control": 3},
    ),
    "stomp_switch": FootprintSourceSpec(
        footprint_id="stomp_switch",
        display_name="Panel-mount stomp switch",
        element_types=[ElementType.BUTTON.value],
        readiness="proof_placeholder",
        electrical_constraints={"scan_model": "matrix_or_direct"},
    ),
    "expression_pedal": FootprintSourceSpec(
        footprint_id="expression_pedal",
        display_name="Expression input",
        element_types=[ElementType.SLIDER.value],
        readiness="proof_placeholder",
        electrical_constraints={"pins_per_control": 1},
    ),
    "pressure_sensor": FootprintSourceSpec(
        footprint_id="pressure_sensor",
        display_name="Pressure sensor",
        element_types=[ElementType.SENSOR.value],
        readiness="proof_placeholder",
        electrical_constraints={"pins_per_control": 2},
    ),
    "bite_sensor": FootprintSourceSpec(
        footprint_id="bite_sensor",
        display_name="Bite sensor",
        element_types=[ElementType.SENSOR.value],
        readiness="proof_placeholder",
        electrical_constraints={"pins_per_control": 2},
    ),
    "mems_microphone": FootprintSourceSpec(
        footprint_id="mems_microphone",
        display_name="MEMS microphone",
        element_types=[ElementType.MICROPHONE.value],
        readiness="proof_placeholder",
        electrical_constraints={"pins_per_control": 1},
    ),
    "oled_128x64": FootprintSourceSpec(
        footprint_id="oled_128x64",
        display_name="128x64 OLED display module",
        element_types=[ElementType.DISPLAY.value],
        readiness="proof_placeholder",
        electrical_constraints={"interface": "i2c", "pins_per_control": 4},
    ),
    "tft_round_240": FootprintSourceSpec(
        footprint_id="tft_round_240",
        display_name="Round TFT status display",
        element_types=[ElementType.DISPLAY.value],
        readiness="reference_only",
        source_ids=["kicad_official_libraries"],
        kicad_footprint="Display module footprint family; exact part must be locked",
        electrical_constraints={"interface": "spi_or_parallel", "pins_per_control": 4},
        implementation_notes=[
            "Reference-backed module class for reviewer proof; exact display part is not yet locked.",
        ],
    ),
    "speaker_40mm": FootprintSourceSpec(
        footprint_id="speaker_40mm",
        display_name="40mm speaker",
        element_types=[ElementType.SPEAKER.value],
        readiness="proof_placeholder",
        electrical_constraints={"pins_per_control": 2},
    ),
    "lipo_1000mah": FootprintSourceSpec(
        footprint_id="lipo_1000mah",
        display_name="1000mAh LiPo battery envelope",
        element_types=[ElementType.BATTERY.value],
        readiness="proof_placeholder",
        implementation_notes=[
            "Mechanical envelope only; charging/protection circuit is not yet represented.",
        ],
    ),
}


def list_hardware_sources() -> list[HardwareSourceRef]:
    return list(HARDWARE_SOURCES.values())


def list_footprint_source_specs() -> list[FootprintSourceSpec]:
    return list(FOOTPRINT_SPECS.values())


def get_footprint_source_spec(footprint_id: str | None) -> FootprintSourceSpec | None:
    if not footprint_id:
        return None
    return FOOTPRINT_SPECS.get(footprint_id)


def summarize_project_footprint_sources(project: KeyboardProject) -> ProjectFootprintSourceSummary:
    used: dict[str, dict] = {}
    unknown: set[str] = set()
    source_ids: set[str] = set()
    readiness_counts: dict[str, int] = {
        "library_ready": 0,
        "reference_only": 0,
        "proof_placeholder": 0,
    }

    for element in project.layout.elements:
        footprint_id = element.footprint_id
        if not footprint_id:
            continue
        spec = get_footprint_source_spec(footprint_id)
        if spec is None:
            unknown.add(footprint_id)
            continue
        source_ids.update(spec.source_ids)
        readiness_counts[spec.readiness] += 1
        entry = used.setdefault(
            footprint_id,
            {
                "footprint_id": footprint_id,
                "display_name": spec.display_name,
                "readiness": spec.readiness,
                "element_ids": [],
                "source_ids": spec.source_ids,
                "kicad_footprint": spec.kicad_footprint,
                "qmk_feature": spec.qmk_feature,
            },
        )
        entry["element_ids"].append(element.id)

    return ProjectFootprintSourceSummary(
        used_footprints=list(used.values()),
        unknown_footprints=sorted(unknown),
        readiness_counts=readiness_counts,
        sources=[HARDWARE_SOURCES[source_id] for source_id in sorted(source_ids)],
    )
