"""
Export bundle generator.

Creates a ZIP package containing the currently available outputs:
- Mechanical DXF/spec artifacts
- Firmware metadata (QMK info.json, keymap.json, VIA definition)
- Validation report
- Manifest with artifact hashes and toolchain versions
- Build guide (markdown)
- Review BOM / sourcing gaps

Not yet included (requires additional subsystems, so current exports are
review-ready evidence bundles rather than complete fabrication packages):
- Gerber files and drill data (requires KiCad backend worker)
- Supplier-ready PCB BOM / placement files
- Keycap STL meshes (requires Meshy integration + mesh pipeline)
- Case STL

Spec reference: PRODUCT_SPEC.md section 15.1
"""

from __future__ import annotations

import hashlib
import json
import tempfile
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from server.config import settings
from server.eda.control_surface_electronics import (
    apply_project_matrix,
    compile_control_surface_electronics,
    compile_project_matrix,
)
from server.firmware.qmk_generator import write_firmware_files
from server.geometry.handheld_shell_generator import generate_handheld_shell_artifacts
from server.geometry.plate_generator import PlateConfig, generate_plate_dxf
from server.models.manifest_schema import ArtifactEntry, ExportManifest, ToolchainVersions
from server.models.project import KeyboardProject, ProductFamily
from server.models.validation_schema import ValidationReport
from server.validation.engine import validate_project


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _format_element_type(value: str) -> str:
    return value.replace("_", " ").title()


def _review_bom(project: KeyboardProject) -> dict[str, Any]:
    """Return a review-grade BOM and sourcing-gap summary for the current project."""
    electronics = compile_control_surface_electronics(project)
    elements = project.layout.elements
    switch_like = [
        element
        for element in elements
        if element.element_type.value in {"key_switch", "button"}
    ]
    accepted_assets = [
        asset
        for asset in project.keycap_assets
        if asset.acceptance_state.value in {"accepted", "production_ready"}
    ]

    items: list[dict[str, Any]] = [
        {
            "category": "controller",
            "item": project.pcb.controller.value.upper(),
            "quantity": 1,
            "status": "selected",
            "notes": "Controller family selected in the project electronics profile.",
        }
    ]

    if switch_like:
        items.append(
            {
                "category": "controls",
                "item": project.switch_profile.part_id or "module-specific switch/button",
                "quantity": len(switch_like),
                "status": "source_candidate",
                "notes": "Exact supplier SKU still needs pilot-build confirmation.",
            }
        )
        items.append(
            {
                "category": "electronics",
                "item": f"{project.pcb.diode_direction.value} signal diodes",
                "quantity": len(switch_like),
                "status": "source_candidate",
                "notes": "Required for matrix-scanned switch/button controls.",
            }
        )

    for usage in electronics.direct_pin_usage:
        items.append(
            {
                "category": "modules",
                "item": _format_element_type(usage.element_type),
                "quantity": usage.control_count,
                "status": "module_required",
                "notes": f"{usage.pins_per_control} GPIO pin(s) per control, {usage.total_pins} total.",
            }
        )

    items.append(
        {
            "category": "mechanical",
            "item": "Panel or shell material",
            "quantity": 1,
            "status": "fabrication_candidate",
            "notes": "Material and process must be validated against the exported DXF/spec files.",
        }
    )

    if switch_like:
        items.append(
            {
                "category": "appearance",
                "item": "Keycaps / control caps",
                "quantity": len(switch_like),
                "status": "needs_acceptance" if not accepted_assets else "accepted_asset_reference",
                "notes": (
                    f"{len(accepted_assets)} accepted appearance asset(s) are attached."
                    if accepted_assets
                    else "No accepted generated/imported appearance assets are attached."
                ),
            }
        )

    sourcing_gaps = [
        "Supplier part numbers, alternates, and unit prices are not locked.",
        "Gerber, drill, pick-place, and PCB assembly BOM outputs require the KiCad worker path.",
        "Final enclosure STL/STEP files are not present unless a family-specific shell compiler provides them.",
        "Pilot build quantities, packaging, test procedure, and fulfillment assumptions are not proven.",
    ]

    return {
        "status": "review_bom",
        "items": items,
        "sourcing_gaps": sourcing_gaps,
        "counts": {
            "line_items": len(items),
            "placed_elements": len(elements),
            "matrix_controls": electronics.matrix_control_count,
            "direct_controls": electronics.direct_control_count,
            "pins_needed": electronics.total_pins,
            "gpio_remaining": electronics.gpio_remaining,
        },
    }


def _bom_markdown(project: KeyboardProject, bom: dict[str, Any]) -> str:
    rows = "\n".join(
        "| {category} | {item} | {quantity} | {status} | {notes} |".format(
            category=item["category"],
            item=item["item"],
            quantity=item["quantity"],
            status=item["status"],
            notes=item["notes"],
        )
        for item in bom["items"]
    )
    gaps = "\n".join(f"- {gap}" for gap in bom["sourcing_gaps"])
    return f"""# Review BOM — {project.name}

Generated by BreakGen · Revision {project.revision}

This is a review-grade bill of materials for prototype planning. It is not yet a supplier-ready purchasing BOM.

| Category | Item | Quantity | Status | Notes |
|----------|------|----------|--------|-------|
{rows}

## Sourcing Gaps

{gaps}
"""


def _included_files(project: KeyboardProject) -> list[dict[str, str]]:
    if project.product_family in {ProductFamily.HANDHELD_COMPANION, ProductFamily.RETRO_HANDHELD}:
        mechanical = [
            {
                "path": "shell/front_shell_panel.dxf",
                "purpose": "Front shell reference panel with display, button, speaker, and microphone cutouts.",
            },
            {
                "path": "shell/back_shell_reference.dxf",
                "purpose": "Back shell cavity, battery, and service-access reference.",
            },
            {
                "path": "shell/shell_spec.json",
                "purpose": "Deterministic handheld shell proof specification.",
            },
        ]
    else:
        mechanical = [
            {
                "path": "plate/plate.dxf",
                "purpose": "Switch plate / control panel planning artifact.",
            }
        ]

    return [
        *mechanical,
        {"path": "firmware/info.json", "purpose": "Firmware and platform metadata."},
        {"path": "firmware/keymap.json", "purpose": "Default control mapping payload."},
        {"path": "firmware/via.json", "purpose": "Layout/remapping metadata."},
        {"path": "firmware/control-map.json", "purpose": "Family-native control mapping artifact."},
        {"path": "validation_report.json", "purpose": "Validation results for this export."},
        {"path": "manifest.json", "purpose": "Artifact hashes and toolchain versions."},
        {"path": "BUILD_GUIDE.md", "purpose": "Assembly and review guide."},
        {"path": "BOM.md", "purpose": "Human-readable review BOM and sourcing gaps."},
        {"path": "bom.json", "purpose": "Machine-readable review BOM."},
    ]


def _missing_outputs() -> list[str]:
    return [
        "Gerbers, drill files, and PCB assembly outputs are not generated yet.",
        "Supplier-ready BOM, placement files, and quote package are not generated yet.",
        "Final enclosure STL/STEP files are not generated for all product families.",
        "Physical prototype evidence must be attached before any prototype-ready claim.",
    ]


def _generate_build_guide(
    project: KeyboardProject,
    matrix_rows: int,
    matrix_cols: int,
    *,
    validation_status: str,
    export_readiness: str,
) -> str:
    """Generate a markdown build guide."""
    element_count = len(project.layout.elements) or len(project.layout.keys)
    switch_line = project.switch_profile.part_id or "Not selected / module-specific default"
    electronics = compile_control_surface_electronics(project)
    if project.product_family in {ProductFamily.HANDHELD_COMPANION, ProductFamily.RETRO_HANDHELD}:
        mechanical_rows = """| `shell/front_shell_panel.dxf` | Front shell reference panel with display, button, speaker, and microphone cutouts |
| `shell/back_shell_reference.dxf` | Back shell cavity, battery, and service-access reference |
| `shell/shell_spec.json` | Deterministic handheld shell proof specification |"""
        mechanical_steps = """3. **Prepare shell parts** — Use `shell_spec.json` as the source of truth for enclosure dimensions and `front_shell_panel.dxf` / `back_shell_reference.dxf` as 2D planning references
4. **Fit portable modules** — Check display, battery, USB-C charging/data access, speaker, and microphone placements against the shell spec before committing to CAD or fabrication
5. **Solder and integrate electronics** — Install the controller and control modules according to the exported metadata
6. **Flash proof firmware** — Use `info.json`, `keymap.json`, and `control-map.json` as the current software/hardware contract
7. **Refine enclosure CAD** — Treat this bundle as a deterministic enclosure baseline, not a finished production shell"""
        mechanical_notes = "- This handheld shell path is a proof-grade deterministic baseline, not a full manufacturable enclosure CAD output yet\n- Side-port placement is recorded in `shell_spec.json`; the DXFs are top-down planning references"
    else:
        mechanical_rows = "| `plate/plate.dxf` | Switch plate / control panel — laser cut from 1.5mm aluminum or acrylic |"
        mechanical_steps = """3. **Cut panel / plate** — Send `plate.dxf` to a laser cutting service. Material: 1.5mm aluminum or acrylic
4. **Solder components** — Solder the controller and any control modules indicated by the layout
5. **Install controls** — Mount switches, buttons, encoders, or other surface controls into the panel
6. **Flash firmware** — Use the metadata in `info.json`, `keymap.json`, and `control-map.json` as the baseline for the target firmware path
7. **Refine mappings** — Use the exported layout metadata to continue device-specific mapping and remapping"""
        mechanical_notes = "- Switch cutout tolerance: 14.0mm ± 0.1mm\n- Stabilizer cutouts included for wide switch-like elements where applicable\n- Plate kerf compensation: configurable (default 0mm — adjust for your cutter)"
    return f"""# Build Guide — {project.name}

Generated by BreakGen · Revision {project.revision}

## Overview

- **Layout:** {element_count} placed elements
- **Input baseline:** {switch_line}
- **Matrix:** {matrix_rows} rows × {matrix_cols} columns
- **Controller:** {project.pcb.controller.value.upper()}
- **Diode direction:** {project.pcb.diode_direction.value}
- **Firmware target:** {electronics.firmware_target.replace('_', ' ')}
- **Control protocol:** {electronics.control_protocol.replace('_', ' ')}
- **Validation status:** {validation_status}
- **Export readiness:** {export_readiness.replace('_', ' ')}

## Files in This Package

| File | Purpose |
|------|---------|
{mechanical_rows}
| `firmware/info.json` | Firmware and platform metadata |
| `firmware/keymap.json` | Default control mapping payload |
| `firmware/via.json` | Layout/remapping metadata |
| `firmware/control-map.json` | Family-native control mapping artifact |
| `validation_report.json` | Validation results for this export |
| `manifest.json` | Artifact hashes and toolchain versions |
| `BOM.md` | Review-grade bill of materials and sourcing gaps |
| `bom.json` | Machine-readable review BOM |

## Assembly Steps

1. **Review missing fabrication outputs** — This bundle does not yet include Gerbers, drill files, supplier-ready PCB BOM, or final enclosure STLs. Treat it as the source package for review and prototype planning.
2. **Review the BOM** — Use `BOM.md` and `bom.json` to understand component categories, provisional quantities, and unresolved sourcing gaps.
{mechanical_steps}

## Notes

{mechanical_notes}
- A `review_ready` export means validation passed for the current evidence bundle, but fabrication artifacts are still incomplete.
- A `candidate` export means the bundle is useful for review, but at least one non-blocking validation warning is still open.
"""


def build_export_preview(
    project: KeyboardProject,
    *,
    validation_report: ValidationReport | None = None,
    export_readiness: str | None = None,
) -> dict[str, Any]:
    """Return read-only export preview data without writing files or metadata."""
    preview_project = project.model_copy(deep=True)
    matrix, _ = compile_project_matrix(preview_project)
    apply_project_matrix(preview_project, matrix)
    report = validation_report or validate_project(preview_project)
    readiness = export_readiness
    if readiness is None:
        readiness = (
            "blocked"
            if report.status.value == "fail"
            else "review_ready"
            if report.status.value == "pass"
            else "candidate"
        )
    bom = _review_bom(preview_project)
    return {
        "project_id": preview_project.project_id,
        "revision": preview_project.revision,
        "validation_status": report.status.value,
        "export_readiness": readiness,
        "included_files": _included_files(preview_project),
        "missing_outputs": _missing_outputs(),
        "bom": bom,
        "build_guide_markdown": _generate_build_guide(
            preview_project,
            matrix.matrix_rows,
            matrix.matrix_cols,
            validation_status=report.status.value,
            export_readiness=readiness,
        ),
    }


def create_export_bundle(
    project: KeyboardProject,
    *,
    validation_report: ValidationReport | None = None,
    export_readiness: str = "review_ready",
    output_path: str | Path | None = None,
) -> tuple[str, Path]:
    """
    Create a review-ready export bundle ZIP.

    Returns (bundle_id, zip_path).
    """
    bundle_id = f"bundle_{uuid.uuid4().hex[:12]}"

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # --- Compile matrix ---
        matrix, _ = compile_project_matrix(project)
        apply_project_matrix(project, matrix)

        # --- Generate family-specific mechanical artifacts ---
        if project.product_family in {ProductFamily.HANDHELD_COMPANION, ProductFamily.RETRO_HANDHELD}:
            shell_dir = tmp / "shell"
            generate_handheld_shell_artifacts(project.layout, shell_dir)
        else:
            plate_dir = tmp / "plate"
            plate_dir.mkdir()
            plate_path = plate_dir / "plate.dxf"
            generate_plate_dxf(project.layout, PlateConfig(), output_path=plate_path)

        # --- Generate firmware metadata ---
        firmware_dir = tmp / "firmware"
        write_firmware_files(project, matrix, firmware_dir)

        # --- Run validation ---
        report = validation_report or validate_project(project)
        report_path = tmp / "validation_report.json"
        with open(report_path, "w") as f:
            json.dump(report.model_dump(mode="json"), f, indent=2)

        # --- Build guide ---
        bom = _review_bom(project)
        guide_path = tmp / "BUILD_GUIDE.md"
        guide_path.write_text(
            _generate_build_guide(
                project,
                matrix.matrix_rows,
                matrix.matrix_cols,
                validation_status=report.status.value,
                export_readiness=export_readiness,
            )
        )
        (tmp / "BOM.md").write_text(_bom_markdown(project, bom))
        with open(tmp / "bom.json", "w") as f:
            json.dump(bom, f, indent=2)

        # --- Manifest ---
        artifacts: list[ArtifactEntry] = []
        for file_path in sorted(tmp.rglob("*")):
            if file_path.is_file() and file_path.name != "manifest.json":
                rel = file_path.relative_to(tmp)
                category = rel.parts[0] if len(rel.parts) > 1 else "doc"
                artifacts.append(ArtifactEntry(
                    path=str(rel),
                    sha256=_sha256(file_path),
                    category=category,
                ))

        manifest = ExportManifest(
            bundle_id=bundle_id,
            project_id=project.project_id,
            revision=project.revision,
            created_at=datetime.now(timezone.utc),
            toolchain=ToolchainVersions(breakgen="0.1.0"),
            artifacts=artifacts,
            validation_report_id=report.report_id,
            validation_status=report.status.value,
            export_readiness=export_readiness,
        )
        manifest_path = tmp / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(manifest.model_dump(mode="json"), f, indent=2)

        # --- ZIP everything ---
        if output_path is None:
            export_dir = Path(settings.artifacts_dir) / "projects" / project.project_id / "exports"
            export_dir.mkdir(parents=True, exist_ok=True)
            output_path = export_dir / f"{bundle_id}.zip"
        else:
            output_path = Path(output_path)

        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for file_path in sorted(tmp.rglob("*")):
                if file_path.is_file():
                    arcname = f"BreakGen_Export/{file_path.relative_to(tmp)}"
                    zf.write(file_path, arcname)

    return bundle_id, output_path
