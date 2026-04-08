"""
V1 supported configuration matrix.

This file defines what BreakGen can actually produce in V1.
If it's not listed here, the system should reject it.

Spec reference: PRODUCT_SPEC.md section 8.1
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from .project import ControllerFamily, DiodeDirection, SwitchFamily


class SupportedSwitch(BaseModel):
    """A switch in the supported catalog."""

    part_id: str
    name: str
    manufacturer: str
    family: SwitchFamily
    switch_type: str = Field(description="linear, tactile, or clicky")
    actuation_force_g: float
    total_travel_mm: float
    sound_file: str = Field(default="", description="Path to sound sample")
    tags: list[str] = Field(default_factory=list)


class LayoutTemplate(BaseModel):
    """A supported keyboard layout template."""

    template_id: str
    name: str
    description: str
    key_count: int
    file: str = Field(description="Path to template JSON file")


# --- V1 Support Matrix ---

SUPPORTED_SWITCH_FAMILIES: list[SwitchFamily] = [SwitchFamily.MX]

SUPPORTED_CONTROLLERS: list[ControllerFamily] = [ControllerFamily.RP2040]

SUPPORTED_DIODE_DIRECTIONS: list[DiodeDirection] = [DiodeDirection.COL2ROW]

SUPPORTED_TEMPLATES: list[LayoutTemplate] = [
    LayoutTemplate(
        template_id="60_percent",
        name="60%",
        description="Compact layout without function row, arrows, or numpad. 61 keys.",
        key_count=61,
        file="templates/60_percent.json",
    ),
    LayoutTemplate(
        template_id="65_percent",
        name="65%",
        description="Compact layout with arrow keys and a column of nav keys. 68 keys.",
        key_count=68,
        file="templates/65_percent.json",
    ),
    LayoutTemplate(
        template_id="75_percent",
        name="75%",
        description="Compact layout with function row and arrow keys. 84 keys.",
        key_count=84,
        file="templates/75_percent.json",
    ),
]

# Cherry MX compatible switches supported in V1
SUPPORTED_SWITCHES: list[SupportedSwitch] = [
    SupportedSwitch(
        part_id="cherry_mx_red",
        name="Cherry MX Red",
        manufacturer="Cherry",
        family=SwitchFamily.MX,
        switch_type="linear",
        actuation_force_g=45,
        total_travel_mm=4.0,
        tags=["light", "smooth", "gaming"],
    ),
    SupportedSwitch(
        part_id="cherry_mx_brown",
        name="Cherry MX Brown",
        manufacturer="Cherry",
        family=SwitchFamily.MX,
        switch_type="tactile",
        actuation_force_g=55,
        total_travel_mm=4.0,
        tags=["tactile", "versatile", "typing"],
    ),
    SupportedSwitch(
        part_id="cherry_mx_blue",
        name="Cherry MX Blue",
        manufacturer="Cherry",
        family=SwitchFamily.MX,
        switch_type="clicky",
        actuation_force_g=60,
        total_travel_mm=4.0,
        tags=["clicky", "loud", "typing"],
    ),
    SupportedSwitch(
        part_id="cherry_mx_black",
        name="Cherry MX Black",
        manufacturer="Cherry",
        family=SwitchFamily.MX,
        switch_type="linear",
        actuation_force_g=60,
        total_travel_mm=4.0,
        tags=["heavy", "smooth", "typing"],
    ),
    SupportedSwitch(
        part_id="gateron_yellow",
        name="Gateron Yellow",
        manufacturer="Gateron",
        family=SwitchFamily.MX,
        switch_type="linear",
        actuation_force_g=50,
        total_travel_mm=4.0,
        tags=["smooth", "budget", "popular"],
    ),
    SupportedSwitch(
        part_id="gateron_oil_king",
        name="Gateron Oil King",
        manufacturer="Gateron",
        family=SwitchFamily.MX,
        switch_type="linear",
        actuation_force_g=55,
        total_travel_mm=4.0,
        tags=["smooth", "premium", "deep"],
    ),
    SupportedSwitch(
        part_id="kailh_box_white",
        name="Kailh Box White",
        manufacturer="Kailh",
        family=SwitchFamily.MX,
        switch_type="clicky",
        actuation_force_g=50,
        total_travel_mm=3.6,
        tags=["clicky", "crisp", "light"],
    ),
    SupportedSwitch(
        part_id="boba_u4t",
        name="Gazzew Boba U4T",
        manufacturer="Gazzew",
        family=SwitchFamily.MX,
        switch_type="tactile",
        actuation_force_g=62,
        total_travel_mm=4.0,
        tags=["tactile", "thocky", "premium"],
    ),
]
