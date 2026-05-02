"""
Validation engine — orchestrates all validation checks for a project.

Produces a structured ValidationReport per spec section 15.3.
"""

from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone

from server.eda.control_surface_electronics import compile_control_surface_electronics
from server.models.project import ElementType, KeyboardProject, ProductFamily
from server.models.validation_schema import CheckStatus, ValidationCheck, ValidationReport

UNIT_MM = 19.05
GEOMETRY_EPSILON_MM = 0.05
MIN_CLEARANCE_MM = {
    ElementType.KEY_SWITCH: 0.0,
    ElementType.BUTTON: 1.5,
    ElementType.ENCODER: 4.0,
    ElementType.SLIDER: 3.0,
    ElementType.JOYSTICK: 6.0,
    ElementType.DISPLAY: 5.0,
    ElementType.SPEAKER: 3.0,
    ElementType.MICROPHONE: 3.0,
    ElementType.LED_CLUSTER: 2.0,
    ElementType.BATTERY: 4.0,
    ElementType.USB_PORT: 2.0,
    ElementType.SENSOR: 2.5,
    ElementType.MOUNTING_FEATURE: 0.0,
}
INTERACTIVE_TYPES = {
    ElementType.KEY_SWITCH,
    ElementType.BUTTON,
    ElementType.ENCODER,
    ElementType.SLIDER,
    ElementType.JOYSTICK,
    ElementType.DISPLAY,
}


def validate_project(project: KeyboardProject) -> ValidationReport:
    """Run all validation checks and return a structured report."""
    checks: list[ValidationCheck] = []

    checks.append(_check_layout_nonempty(project))
    checks.append(_check_family_required_modules(project))
    checks.append(_check_element_overlap(project))
    checks.append(_check_control_clearance(project))
    checks.append(_check_stabilizers(project))
    checks.append(_check_matrix_feasibility(project))
    checks.append(_check_control_labels(project))
    checks.append(_check_switch_selected(project))
    checks.append(_check_assigned_asset_acceptance(project))

    statuses = [c.status for c in checks]
    if CheckStatus.FAIL in statuses:
        overall = CheckStatus.FAIL
    elif CheckStatus.WARN in statuses:
        overall = CheckStatus.WARN
    else:
        overall = CheckStatus.PASS

    return ValidationReport(
        report_id=f"vr_{uuid.uuid4().hex[:12]}",
        project_id=project.project_id,
        revision=project.revision,
        status=overall,
        created_at=datetime.now(timezone.utc),
        checks=checks,
    )


def _check_family_required_modules(project: KeyboardProject) -> ValidationCheck:
    if project.product_family != ProductFamily.HANDHELD_COMPANION:
        return ValidationCheck(
            id="family_required_modules",
            category="module_compatibility",
            status=CheckStatus.SKIPPED,
            details="No additional family-specific module requirements for this product family.",
        )

    present = {element.element_type for element in project.layout.elements}
    required = {
        ElementType.DISPLAY: "display",
        ElementType.BATTERY: "battery",
        ElementType.SPEAKER: "speaker",
        ElementType.USB_PORT: "USB access port",
    }
    missing = [label for element_type, label in required.items() if element_type not in present]
    if missing:
        return ValidationCheck(
            id="family_required_modules",
            category="module_compatibility",
            status=CheckStatus.FAIL,
            details=(
                "Handheld companion layouts must include the core portable modules: "
                f"{', '.join(missing)} missing."
            ),
        )
    return ValidationCheck(
        id="family_required_modules",
        category="module_compatibility",
        status=CheckStatus.PASS,
        details="Handheld companion layout includes display, battery, speaker, and USB service access.",
    )


def _element_bounds(element) -> tuple[float, float, float, float]:
    return (
        float(element.x_mm),
        float(element.y_mm),
        float(element.x_mm + element.w_mm),
        float(element.y_mm + element.h_mm),
    )


def _rectangles_overlap(a, b) -> bool:
    ax1, ay1, ax2, ay2 = _element_bounds(a)
    bx1, by1, bx2, by2 = _element_bounds(b)
    return (
        ax1 < bx2 - GEOMETRY_EPSILON_MM
        and ax2 > bx1 + GEOMETRY_EPSILON_MM
        and ay1 < by2 - GEOMETRY_EPSILON_MM
        and ay2 > by1 + GEOMETRY_EPSILON_MM
    )


def _element_edge_gap_mm(a, b) -> float:
    ax1, ay1, ax2, ay2 = _element_bounds(a)
    bx1, by1, bx2, by2 = _element_bounds(b)

    dx = max(ax1 - bx2, bx1 - ax2, 0.0)
    dy = max(ay1 - by2, by1 - ay2, 0.0)
    if dx == 0.0 or dy == 0.0:
        return max(dx, dy)
    return math.hypot(dx, dy)


def _key_like_elements(project: KeyboardProject):
    return [
        element
        for element in project.layout.elements
        if element.element_type in {ElementType.KEY_SWITCH, ElementType.BUTTON}
    ]


def _check_layout_nonempty(project: KeyboardProject) -> ValidationCheck:
    element_count = len(project.layout.elements) or len(project.layout.keys)
    if element_count == 0:
        return ValidationCheck(
            id="layout_nonempty",
            category="geometry",
            status=CheckStatus.FAIL,
            details="Layout has no placed elements.",
        )
    return ValidationCheck(
        id="layout_nonempty",
        category="geometry",
        status=CheckStatus.PASS,
        details=f"Layout has {element_count} placed element(s).",
    )


def _check_element_overlap(project: KeyboardProject) -> ValidationCheck:
    elements = project.layout.elements
    overlaps: list[str] = []
    for idx, first in enumerate(elements):
        for second in elements[idx + 1:]:
            if _rectangles_overlap(first, second):
                overlaps.append(f"{first.id} ↔ {second.id}")

    if overlaps:
        return ValidationCheck(
            id="element_overlap",
            category="geometry",
            status=CheckStatus.FAIL,
            details=(
                f"{len(overlaps)} overlapping element pair(s): "
                f"{', '.join(overlaps[:5])}"
                f"{'...' if len(overlaps) > 5 else ''}"
            ),
        )
    return ValidationCheck(
        id="element_overlap",
        category="geometry",
        status=CheckStatus.PASS,
        details="No overlapping elements detected.",
    )


def _check_control_clearance(project: KeyboardProject) -> ValidationCheck:
    elements = [
        element
        for element in project.layout.elements
        if element.element_type in INTERACTIVE_TYPES
    ]
    warnings: list[str] = []
    for idx, first in enumerate(elements):
        for second in elements[idx + 1:]:
            if _rectangles_overlap(first, second):
                continue
            required_gap = max(
                MIN_CLEARANCE_MM.get(first.element_type, 0.0),
                MIN_CLEARANCE_MM.get(second.element_type, 0.0),
            )
            if required_gap <= 0.0:
                continue
            gap = _element_edge_gap_mm(first, second)
            if gap < required_gap:
                warnings.append(
                    f"{first.id} ↔ {second.id} ({gap:.1f}mm < {required_gap:.1f}mm)"
                )

    if warnings:
        return ValidationCheck(
            id="control_clearance",
            category="module_compatibility",
            status=CheckStatus.WARN,
            details=(
                f"{len(warnings)} control pair(s) have tight spacing: "
                f"{', '.join(warnings[:5])}"
                f"{'...' if len(warnings) > 5 else ''}"
            ),
        )
    return ValidationCheck(
        id="control_clearance",
        category="module_compatibility",
        status=CheckStatus.PASS,
        details="Control spacing satisfies the current default clearance rules.",
    )


def _check_stabilizers(project: KeyboardProject) -> ValidationCheck:
    missing = []
    for key in project.layout.keys:
        if key.w_u >= 2.0 and key.stabilizer == "none":
            missing.append(f"{key.id} ({key.w_u}u)")

    if missing:
        return ValidationCheck(
            id="stabilizer_assignment",
            category="geometry",
            status=CheckStatus.WARN,
            details=f"{len(missing)} key(s) >= 2u without stabilizer: {', '.join(missing[:5])}",
        )
    return ValidationCheck(
        id="stabilizer_assignment",
        category="geometry",
        status=CheckStatus.PASS,
        details="All wide key-like elements have stabilizers assigned.",
    )


def _check_matrix_feasibility(project: KeyboardProject) -> ValidationCheck:
    key_like_elements = _key_like_elements(project)
    electronics = compile_control_surface_electronics(project)

    if not key_like_elements and electronics.direct_pins == 0:
        return ValidationCheck(
            id="matrix_feasibility",
            category="electronics",
            status=CheckStatus.SKIPPED,
            details="No electronic controls require matrix or direct GPIO planning.",
        )

    if electronics.total_pins > electronics.gpio_budget:
        return ValidationCheck(
            id="matrix_feasibility",
            category="electronics",
            status=CheckStatus.FAIL,
            details=(
                f"Estimated GPIO budget exceeded: {electronics.matrix_pins} matrix pin(s) + "
                f"{electronics.direct_pins} direct pin(s) = {electronics.total_pins}, "
                f"but {project.pcb.controller.value.upper()} exposes {electronics.gpio_budget}. "
                f"Matrix strategy: {electronics.matrix_strategy}."
            ),
        )

    return ValidationCheck(
        id="matrix_feasibility",
        category="electronics",
        status=CheckStatus.PASS,
        details=(
            f"Estimated GPIO usage fits controller budget: {electronics.matrix_pins} matrix pin(s) + "
            f"{electronics.direct_pins} direct pin(s) = {electronics.total_pins} / {electronics.gpio_budget}. "
            f"Matrix strategy: {electronics.matrix_strategy}."
        ),
    )


def _check_control_labels(project: KeyboardProject) -> ValidationCheck:
    unlabeled = [
        element.id
        for element in project.layout.elements
        if element.element_type in INTERACTIVE_TYPES and not element.label
    ]
    if unlabeled:
        return ValidationCheck(
            id="control_labels",
            category="firmware",
            status=CheckStatus.WARN,
            details=(
                f"{len(unlabeled)} interactive element(s) without labels. "
                "Default mappings and UI labeling may be incomplete."
            ),
        )
    return ValidationCheck(
        id="control_labels",
        category="firmware",
        status=CheckStatus.PASS,
        details="All interactive elements have labels for default mappings and UI surfaces.",
    )


def _check_switch_selected(project: KeyboardProject) -> ValidationCheck:
    if not any(element.element_type == ElementType.KEY_SWITCH for element in project.layout.elements):
        return ValidationCheck(
            id="switch_selected",
            category="export",
            status=CheckStatus.SKIPPED,
            details="This family does not require a switch-catalog selection.",
        )
    if not project.switch_profile.part_id:
        return ValidationCheck(
            id="switch_selected",
            category="export",
            status=CheckStatus.WARN,
            details="No switch selected. Default MX footprint will be used.",
        )
    return ValidationCheck(
        id="switch_selected",
        category="export",
        status=CheckStatus.PASS,
        details=f"Switch selected: {project.switch_profile.part_id}",
    )


def _check_assigned_asset_acceptance(project: KeyboardProject) -> ValidationCheck:
    if not project.keycap_assets:
        return ValidationCheck(
            id="assigned_asset_acceptance",
            category="export",
            status=CheckStatus.SKIPPED,
            details="No appearance assets are attached to the project yet.",
        )

    asset_state = {
        asset.asset_id: asset.acceptance_state.value
        for asset in project.keycap_assets
    }
    invalid_assignments: list[str] = []
    for element in project.layout.elements:
        assigned = element.keycap_asset_id or element.appearance_ref
        if not assigned:
            continue
        state = asset_state.get(assigned)
        if state is None:
            invalid_assignments.append(f"{element.id} → missing asset {assigned}")
        elif state not in {"accepted", "production_ready"}:
            invalid_assignments.append(f"{element.id} → {assigned} ({state})")

    if invalid_assignments:
        return ValidationCheck(
            id="assigned_asset_acceptance",
            category="export",
            status=CheckStatus.FAIL,
            details=(
                f"{len(invalid_assignments)} assigned appearance asset(s) are not export-ready: "
                f"{', '.join(invalid_assignments[:5])}"
                f"{'...' if len(invalid_assignments) > 5 else ''}"
            ),
        )

    return ValidationCheck(
        id="assigned_asset_acceptance",
        category="export",
        status=CheckStatus.PASS,
        details="All assigned appearance assets are accepted for canonical export.",
    )
