"""
Validation engine — orchestrates all validation checks for a project.

Produces a structured ValidationReport per spec section 15.3.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from server.eda.matrix_compiler import compile_matrix
from server.models.project import KeyboardProject
from server.models.validation_schema import CheckStatus, ValidationCheck, ValidationReport

UNIT_MM = 19.05


def validate_project(project: KeyboardProject) -> ValidationReport:
    """Run all validation checks and return a structured report."""
    checks: list[ValidationCheck] = []

    # --- Geometry checks ---
    checks.append(_check_layout_nonempty(project))
    checks.append(_check_key_overlap(project))
    checks.append(_check_stabilizers(project))

    # --- PCB checks ---
    checks.append(_check_matrix_feasibility(project))

    # --- Firmware checks ---
    checks.append(_check_key_labels(project))

    # --- Export completeness ---
    checks.append(_check_switch_selected(project))

    # Overall status: worst of all checks
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


def _check_layout_nonempty(project: KeyboardProject) -> ValidationCheck:
    if not project.layout.keys:
        return ValidationCheck(
            id="layout_nonempty",
            category="geometry",
            status=CheckStatus.FAIL,
            details="Layout has no keys.",
        )
    return ValidationCheck(
        id="layout_nonempty",
        category="geometry",
        status=CheckStatus.PASS,
        details=f"Layout has {len(project.layout.keys)} keys.",
    )


def _check_key_overlap(project: KeyboardProject) -> ValidationCheck:
    """Check for overlapping keys (simplified axis-aligned check)."""
    keys = project.layout.keys
    overlaps = []
    for i, a in enumerate(keys):
        for b in keys[i + 1:]:
            # Axis-aligned overlap test (ignoring rotation)
            if (
                a.x_u < b.x_u + b.w_u
                and a.x_u + a.w_u > b.x_u
                and a.y_u < b.y_u + b.h_u
                and a.y_u + a.h_u > b.y_u
            ):
                overlaps.append(f"{a.id} ↔ {b.id}")

    if overlaps:
        return ValidationCheck(
            id="key_overlap",
            category="geometry",
            status=CheckStatus.WARN,
            details=f"{len(overlaps)} overlapping key pair(s): {', '.join(overlaps[:5])}{'...' if len(overlaps) > 5 else ''}",
        )
    return ValidationCheck(
        id="key_overlap",
        category="geometry",
        status=CheckStatus.PASS,
        details="No overlapping keys detected.",
    )


def _check_stabilizers(project: KeyboardProject) -> ValidationCheck:
    """Check that keys >= 2u have stabilizers assigned."""
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
        details="All wide keys have stabilizers assigned.",
    )


def _check_matrix_feasibility(project: KeyboardProject) -> ValidationCheck:
    """Check that the matrix fits within RP2040 pin constraints."""
    if not project.layout.keys:
        return ValidationCheck(
            id="matrix_feasibility",
            category="pcb",
            status=CheckStatus.SKIPPED,
            details="No keys to compile matrix.",
        )

    matrix = compile_matrix(project.layout)
    total_pins = matrix.row_pins_needed + matrix.col_pins_needed

    if total_pins > 26:
        return ValidationCheck(
            id="matrix_feasibility",
            category="pcb",
            status=CheckStatus.FAIL,
            details=f"Matrix needs {total_pins} pins ({matrix.matrix_rows}R × {matrix.matrix_cols}C), exceeds RP2040 (26 GPIO).",
        )
    return ValidationCheck(
        id="matrix_feasibility",
        category="pcb",
        status=CheckStatus.PASS,
        details=f"Matrix: {matrix.matrix_rows} rows × {matrix.matrix_cols} cols = {total_pins} pins (RP2040 has 26 GPIO).",
    )


def _check_key_labels(project: KeyboardProject) -> ValidationCheck:
    """Check that all keys have labels (needed for firmware keymap)."""
    unlabeled = [k.id for k in project.layout.keys if not k.label]
    if unlabeled:
        return ValidationCheck(
            id="key_labels",
            category="firmware",
            status=CheckStatus.WARN,
            details=f"{len(unlabeled)} key(s) without labels. Default keymap may have unmapped keys.",
        )
    return ValidationCheck(
        id="key_labels",
        category="firmware",
        status=CheckStatus.PASS,
        details="All keys have labels for keymap generation.",
    )


def _check_switch_selected(project: KeyboardProject) -> ValidationCheck:
    """Check that a switch has been selected."""
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
