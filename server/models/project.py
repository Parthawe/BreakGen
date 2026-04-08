"""
Canonical domain models for BreakGen.

KeyboardProject is the single source of truth. All downstream artifacts —
meshes, KiCad files, Gerbers, previews, manifests — are derived from it.

Spec reference: PRODUCT_SPEC.md sections 9.1–9.4
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# --- Enums ---


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


# --- Layout ---


class LayoutSpec(BaseModel):
    """Complete keyboard layout definition."""

    unit_pitch_mm: float = Field(
        default=19.05,
        description="Key pitch in mm. Standard is 19.05mm.",
    )
    keys: list[KeySpec] = Field(default_factory=list)


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


class KeyboardProject(BaseModel):
    """
    Canonical keyboard project record.

    This is THE source of truth. Every downstream artifact is derived from
    a specific revision of this model.

    Spec reference: PRODUCT_SPEC.md section 9.2–9.3
    """

    project_id: str = Field(description="Unique project identifier")
    name: str = Field(default="Untitled Keyboard")
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
