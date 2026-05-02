"""
Canonical domain models for BreakGen.

KeyboardProject is the single source of truth. All downstream artifacts —
meshes, KiCad files, Gerbers, previews, manifests — are derived from it.

Spec reference: PRODUCT_SPEC.md sections 9.1–9.4
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator


UNIT_PITCH_MM = 19.05


# --- Enums ---


class ProductDomain(str, Enum):
    CONTROL_SURFACE = "control_surface"
    HANDHELD = "handheld"
    AMBIENT_DEVICE = "ambient_device"
    WEARABLE = "wearable"


class ProductFamily(str, Enum):
    KEYBOARD = "keyboard"
    MACROPAD = "macropad"
    STREAMDECK = "streamdeck"
    MIDI = "midi"
    GAMEPAD = "gamepad"
    PEDAL_CONTROLLER = "pedal_controller"
    BREATH_CONTROLLER = "breath_controller"
    HANDHELD_COMPANION = "handheld_companion"
    RETRO_HANDHELD = "retro_handheld"
    DESKTOP_SPEAKER = "desktop_speaker"
    SMART_LAMP = "smart_lamp"
    SENSOR_POD = "sensor_pod"


class ProjectStatus(str, Enum):
    DRAFT = "draft"
    CONFIGURED = "configured"
    GENERATING = "generating"
    PREVIEWABLE = "previewable"
    VALIDATED = "validated"
    EXPORTED = "exported"


class SwitchFamily(str, Enum):
    MX = "mx"
    CHOC_V1 = "choc_v1"
    CHOC_V2 = "choc_v2"


class DiodeDirection(str, Enum):
    COL2ROW = "COL2ROW"
    ROW2COL = "ROW2COL"


class ControllerFamily(str, Enum):
    RP2040 = "rp2040"
    ATMEGA32U4 = "atmega32u4"


class StabilizerType(str, Enum):
    CHERRY = "cherry"
    COSTAR = "costar"
    NONE = "none"


class ElementType(str, Enum):
    KEY_SWITCH = "key_switch"
    ENCODER = "encoder"
    BUTTON = "button"
    SLIDER = "slider"
    JOYSTICK = "joystick"
    DISPLAY = "display"
    SPEAKER = "speaker"
    MICROPHONE = "microphone"
    LED_CLUSTER = "led_cluster"
    BATTERY = "battery"
    USB_PORT = "usb_port"
    SENSOR = "sensor"
    MOUNTING_FEATURE = "mounting_feature"


class AcceptanceState(str, Enum):
    PREVIEW_ONLY = "preview_only"
    CANDIDATE = "candidate"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    PRODUCTION_READY = "production_ready"


FAMILY_DOMAIN_MAP: dict[ProductFamily, ProductDomain] = {
    ProductFamily.KEYBOARD: ProductDomain.CONTROL_SURFACE,
    ProductFamily.MACROPAD: ProductDomain.CONTROL_SURFACE,
    ProductFamily.STREAMDECK: ProductDomain.CONTROL_SURFACE,
    ProductFamily.MIDI: ProductDomain.CONTROL_SURFACE,
    ProductFamily.GAMEPAD: ProductDomain.CONTROL_SURFACE,
    ProductFamily.PEDAL_CONTROLLER: ProductDomain.CONTROL_SURFACE,
    ProductFamily.BREATH_CONTROLLER: ProductDomain.CONTROL_SURFACE,
    ProductFamily.HANDHELD_COMPANION: ProductDomain.HANDHELD,
    ProductFamily.RETRO_HANDHELD: ProductDomain.HANDHELD,
    ProductFamily.DESKTOP_SPEAKER: ProductDomain.AMBIENT_DEVICE,
    ProductFamily.SMART_LAMP: ProductDomain.AMBIENT_DEVICE,
    ProductFamily.SENSOR_POD: ProductDomain.AMBIENT_DEVICE,
}


def domain_for_family(family: ProductFamily) -> ProductDomain:
    return FAMILY_DOMAIN_MAP[family]


def _coerce_element_type(value: Any) -> ElementType:
    if isinstance(value, ElementType):
        return value
    return ElementType(value or ElementType.KEY_SWITCH)


def _element_supports_key_compat(value: Any) -> bool:
    element_type = _coerce_element_type(value)
    return element_type in {ElementType.KEY_SWITCH, ElementType.BUTTON}


def _key_to_element_dict(key: dict, unit_pitch_mm: float) -> dict:
    h_u = key.get("h_u", 1.0)
    return {
        "id": key["id"],
        "element_type": ElementType.KEY_SWITCH.value,
        "label": key.get("label", ""),
        "x_mm": float(key.get("x_u", 0.0)) * unit_pitch_mm,
        "y_mm": float(key.get("y_u", 0.0)) * unit_pitch_mm,
        "w_mm": float(key.get("w_u", 1.0)) * unit_pitch_mm,
        "h_mm": float(h_u) * unit_pitch_mm,
        "rotation_deg": float(key.get("rotation_deg", 0.0)),
        "footprint_id": "mx_switch",
        "appearance_ref": key.get("keycap_asset_id"),
        "stabilizer": key.get("stabilizer", StabilizerType.NONE.value),
        "keycap_asset_id": key.get("keycap_asset_id"),
        "row": key.get("row"),
        "col": key.get("col"),
        "metadata": {
            "rotation_origin_x_u": key.get("rotation_origin_x_u", 0.0),
            "rotation_origin_y_u": key.get("rotation_origin_y_u", 0.0),
        },
    }


def _element_to_key_dict(element: dict, unit_pitch_mm: float) -> dict:
    metadata = element.get("metadata") or {}
    w_mm = float(element.get("w_mm", unit_pitch_mm))
    h_mm = float(element.get("h_mm", unit_pitch_mm))
    return {
        "id": element["id"],
        "label": element.get("label", ""),
        "x_u": float(element.get("x_mm", 0.0)) / unit_pitch_mm,
        "y_u": float(element.get("y_mm", 0.0)) / unit_pitch_mm,
        "w_u": w_mm / unit_pitch_mm,
        "h_u": h_mm / unit_pitch_mm,
        "rotation_deg": float(element.get("rotation_deg", 0.0)),
        "rotation_origin_x_u": float(metadata.get("rotation_origin_x_u", 0.0)),
        "rotation_origin_y_u": float(metadata.get("rotation_origin_y_u", 0.0)),
        "stabilizer": element.get("stabilizer", StabilizerType.NONE.value),
        "keycap_asset_id": element.get("keycap_asset_id") or element.get("appearance_ref"),
        "row": element.get("row"),
        "col": element.get("col"),
    }


def _raw_item_dict(item: Any) -> dict:
    if isinstance(item, dict):
        return dict(item)
    if hasattr(item, "model_dump"):
        return item.model_dump(mode="json")
    return dict(item)


# --- Key specification ---


class KeySpec(BaseModel):
    """A single key in the layout."""

    id: str = Field(description="Unique key identifier within the project")
    label: str = Field(default="", description="Display label (e.g. 'Esc', 'A')")
    x_u: float = Field(description="X position in keyboard units (1u = 19.05mm)")
    y_u: float = Field(description="Y position in keyboard units")
    w_u: float = Field(default=1.0, description="Width in keyboard units")
    h_u: float = Field(default=1.0, description="Height in keyboard units")
    rotation_deg: float = Field(default=0.0, description="Rotation in degrees")
    rotation_origin_x_u: float = Field(
        default=0.0, description="Rotation origin X in units"
    )
    rotation_origin_y_u: float = Field(
        default=0.0, description="Rotation origin Y in units"
    )
    stabilizer: StabilizerType = Field(
        default=StabilizerType.NONE,
        description="Stabilizer type. Required for keys >= 2u.",
    )
    keycap_asset_id: Optional[str] = Field(
        default=None, description="Reference to assigned keycap asset"
    )
    row: Optional[int] = Field(
        default=None, description="Matrix row assignment (set by PCB compiler)"
    )
    col: Optional[int] = Field(
        default=None, description="Matrix column assignment (set by PCB compiler)"
    )


class PlacedElementSpec(BaseModel):
    """A generic placed hardware or shell element in the project workspace."""

    id: str = Field(description="Unique element identifier within the project")
    element_type: ElementType = Field(default=ElementType.KEY_SWITCH)
    label: str = Field(default="", description="Visible label or logical name")
    footprint_id: Optional[str] = Field(
        default=None,
        description="Catalog or footprint identifier for this element",
    )
    x_mm: float = Field(description="X position in millimeters")
    y_mm: float = Field(description="Y position in millimeters")
    w_mm: float = Field(default=UNIT_PITCH_MM, description="Width in millimeters")
    h_mm: float = Field(default=UNIT_PITCH_MM, description="Height in millimeters")
    rotation_deg: float = Field(default=0.0, description="Rotation in degrees")
    mounting: dict[str, Any] = Field(default_factory=dict)
    appearance_ref: Optional[str] = Field(
        default=None,
        description="Reference to the assigned cosmetic asset",
    )
    electrical_ref: Optional[str] = Field(
        default=None,
        description="Reference to a logical circuit or mapping target",
    )
    metadata: dict[str, Any] = Field(default_factory=dict)
    stabilizer: StabilizerType = Field(default=StabilizerType.NONE)
    keycap_asset_id: Optional[str] = Field(default=None)
    row: Optional[int] = Field(default=None)
    col: Optional[int] = Field(default=None)

    def to_key_spec(self, unit_pitch_mm: float) -> KeySpec:
        """Return the legacy key compatibility view for switch-like elements."""
        return KeySpec(**_element_to_key_dict(self.model_dump(mode="json"), unit_pitch_mm))


# --- Layout ---


class LayoutSpec(BaseModel):
    """Complete product layout definition with key compatibility support."""

    unit_pitch_mm: float = Field(
        default=UNIT_PITCH_MM,
        description="Key pitch in mm. Standard is 19.05mm.",
    )
    keys: list[KeySpec] = Field(
        default_factory=list,
        description="Legacy key compatibility view for switch-like elements.",
    )
    elements: list[PlacedElementSpec] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _normalize_layout_payload(cls, data: Any):
        if not isinstance(data, dict):
            return data

        unit_pitch_mm = float(data.get("unit_pitch_mm", UNIT_PITCH_MM) or UNIT_PITCH_MM)
        keys = [_raw_item_dict(item) for item in (data.get("keys") or [])]
        elements = [_raw_item_dict(item) for item in (data.get("elements") or [])]

        if keys and not elements:
            elements = [_key_to_element_dict(item, unit_pitch_mm) for item in keys]
        elif elements and not keys:
            keys = [
                _element_to_key_dict(item, unit_pitch_mm)
                for item in elements
                if _element_supports_key_compat(item.get("element_type"))
            ]
        elif keys and elements:
            key_by_id = {item["id"]: item for item in keys if "id" in item}
            synced_elements: list[dict] = []
            seen_ids: set[str] = set()
            for element in elements:
                element_id = element.get("id")
                if element_id is None:
                    continue
                seen_ids.add(element_id)
                key_payload = key_by_id.get(element_id)
                if key_payload and _element_supports_key_compat(element.get("element_type")):
                    synced = {**element, **_key_to_element_dict(key_payload, unit_pitch_mm)}
                    synced["element_type"] = element.get("element_type", ElementType.KEY_SWITCH.value)
                    synced["footprint_id"] = element.get("footprint_id") or synced.get("footprint_id")
                    synced["mounting"] = element.get("mounting", {})
                    synced["electrical_ref"] = element.get("electrical_ref")
                    merged_metadata = dict(element.get("metadata") or {})
                    merged_metadata.update(synced.get("metadata") or {})
                    synced["metadata"] = merged_metadata
                    synced_elements.append(synced)
                else:
                    synced_elements.append(element)
            for key_payload in keys:
                if key_payload.get("id") not in seen_ids:
                    synced_elements.append(_key_to_element_dict(key_payload, unit_pitch_mm))
            elements = synced_elements

        data["keys"] = keys
        data["elements"] = elements
        return data

    @model_validator(mode="after")
    def _ensure_layout_views(self):
        if not self.elements and self.keys:
            self.elements = [
                PlacedElementSpec(**_key_to_element_dict(key.model_dump(mode="json"), self.unit_pitch_mm))
                for key in self.keys
            ]
        if self.elements:
            self.keys = [
                element.to_key_spec(self.unit_pitch_mm)
                for element in self.elements
                if element.element_type in {ElementType.KEY_SWITCH, ElementType.BUTTON}
            ]
        return self

    def editable_elements(self) -> list[PlacedElementSpec]:
        return list(self.elements)

    def matrix_keys(self) -> list[KeySpec]:
        return list(self.keys)


# --- Switch profile ---


class SwitchProfile(BaseModel):
    """Selected switch family and specific part."""

    family: SwitchFamily = Field(default=SwitchFamily.MX)
    part_id: Optional[str] = Field(
        default=None,
        description="Specific switch part (e.g. 'cherry_mx_red', 'gateron_yellow')",
    )


# --- Keycap style ---


class StyleRequest(BaseModel):
    """User's keycap style request for AI generation."""

    provider: str = Field(default="meshy")
    prompt: Optional[str] = Field(
        default=None, description="Natural language style description"
    )
    preset: Optional[str] = Field(
        default=None, description="Style preset name (e.g. 'minimal', 'industrial')"
    )
    variant_count: int = Field(default=4, ge=1, le=8)


class KeycapAsset(BaseModel):
    """A generated or selected keycap mesh asset."""

    asset_id: str
    source: str = Field(description="'generated', 'shell_library', or 'uploaded'")
    provider: Optional[str] = Field(default=None, description="AI provider name")
    prompt: Optional[str] = Field(
        default=None, description="Prompt used for generation"
    )
    mesh_path: Optional[str] = Field(
        default=None, description="Path to mesh file in artifact store"
    )
    preview_mesh_path: Optional[str] = Field(
        default=None, description="Path to decimated preview mesh"
    )
    unit_sizes: list[float] = Field(
        default_factory=lambda: [1.0],
        description="Available unit sizes for this asset",
    )
    normalized: bool = Field(default=False)
    watertight: bool = Field(default=False)
    acceptance_state: AcceptanceState = Field(default=AcceptanceState.CANDIDATE)


# --- PCB specification ---


class PCBSpec(BaseModel):
    """PCB compilation parameters and state."""

    controller: ControllerFamily = Field(default=ControllerFamily.RP2040)
    matrix_mode: str = Field(default="diode")
    diode_direction: DiodeDirection = Field(default=DiodeDirection.COL2ROW)
    matrix_rows: Optional[int] = Field(default=None)
    matrix_cols: Optional[int] = Field(default=None)
    board_outline_source: str = Field(
        default="layout",
        description="'layout' (derived from key positions) or 'custom'",
    )
    drc_passed: Optional[bool] = Field(default=None)
    gerber_path: Optional[str] = Field(default=None)
    kicad_project_path: Optional[str] = Field(default=None)


# --- Export state ---


class ExportState(BaseModel):
    """Tracks export bundle status."""

    bundle_id: Optional[str] = Field(default=None)
    bundle_path: Optional[str] = Field(default=None)
    exported_at: Optional[datetime] = Field(default=None)
    validation_report_id: Optional[str] = Field(default=None)


# --- The canonical project model ---


class ProjectDocument(BaseModel):
    """
    Canonical project record.

    This is THE source of truth. Every downstream artifact is derived from
    a specific revision of this model.

    Spec reference: PRODUCT_SPEC.md section 9.2–9.3
    """

    project_id: str = Field(description="Unique project identifier")
    spec_version: int = Field(default=2, ge=1)
    product_domain: ProductDomain | None = Field(default=None)
    product_family: ProductFamily = Field(default=ProductFamily.KEYBOARD)
    name: str = Field(default="Untitled Project")
    revision: int = Field(default=1, ge=1)
    status: ProjectStatus = Field(default=ProjectStatus.DRAFT)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    template: Optional[str] = Field(
        default=None,
        description="Template ID used to initialize the project (e.g. '65_percent')",
    )
    layout: LayoutSpec = Field(default_factory=LayoutSpec)
    switch_profile: SwitchProfile = Field(default_factory=SwitchProfile)
    style_request: StyleRequest = Field(default_factory=StyleRequest)
    keycap_assets: list[KeycapAsset] = Field(default_factory=list)
    pcb: PCBSpec = Field(default_factory=PCBSpec)
    exports: ExportState = Field(default_factory=ExportState)
    metadata: dict[str, Any] = Field(default_factory=dict)
    derived: dict[str, Any] = Field(default_factory=dict)
    assets: dict[str, Any] = Field(default_factory=dict)
    jobs: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _apply_platform_defaults(self):
        if self.product_domain is None:
            self.product_domain = domain_for_family(self.product_family)
        self.metadata.setdefault("family_admission", "electronics_first")
        self.assets.setdefault(
            "accepted_asset_ids",
            [asset.asset_id for asset in self.keycap_assets if asset.acceptance_state in {
                AcceptanceState.ACCEPTED,
                AcceptanceState.PRODUCTION_READY,
            }],
        )
        return self


KeyboardProject = ProjectDocument
