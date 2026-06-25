"""Project quality gate summaries for operator-facing readiness."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from server.db.models import ProjectArtifactRow, ProjectJobRow
from server.models.project import AcceptanceState, KeyboardProject
from server.models.validation_schema import CheckStatus, ValidationReport
from server.services.job_registry import is_terminal_job_status


@dataclass(frozen=True)
class QualityGateInput:
    project: KeyboardProject
    artifacts: list[ProjectArtifactRow]
    jobs: list[ProjectJobRow]
    latest_validation_report: ValidationReport | None


def _gate(
    *,
    gate_id: str,
    label: str,
    status: str,
    details: str,
) -> dict[str, str]:
    return {
        "id": gate_id,
        "label": label,
        "status": status,
        "details": details,
    }


def _artifact_source_revision(row: ProjectArtifactRow) -> int:
    value = row.details.get("source_revision", row.revision)
    return value if isinstance(value, int) else row.revision


def _latest_artifact(
    artifacts: list[ProjectArtifactRow],
    *,
    kind: str,
) -> ProjectArtifactRow | None:
    return next((artifact for artifact in artifacts if artifact.kind == kind), None)


def _accepted_asset_count(project: KeyboardProject) -> int:
    return sum(
        1
        for asset in project.keycap_assets
        if asset.acceptance_state
        in {AcceptanceState.ACCEPTED, AcceptanceState.PRODUCTION_READY}
    )


def build_quality_gate_summary(input_data: QualityGateInput) -> dict[str, Any]:
    """Return a read-only quality summary for the current project revision."""
    project = input_data.project
    revision = project.revision
    artifacts = input_data.artifacts
    jobs = input_data.jobs
    validation = input_data.latest_validation_report
    latest_export = _latest_artifact(artifacts, kind="export_bundle")
    active_jobs = [job for job in jobs if not is_terminal_job_status(job.status)]
    element_count = len(project.layout.elements) or len(project.layout.keys)
    accepted_asset_count = _accepted_asset_count(project)

    gates: list[dict[str, str]] = []
    blockers: list[str] = []
    warnings: list[str] = []
    next_actions: list[str] = []

    if element_count == 0:
        gates.append(
            _gate(
                gate_id="layout",
                label="Layout exists",
                status="fail",
                details="No placed controls exist in the current project revision.",
            )
        )
        blockers.append("Add at least one placed control before validation or export.")
    else:
        gates.append(
            _gate(
                gate_id="layout",
                label="Layout exists",
                status="pass",
                details=f"{element_count} placed control{'' if element_count == 1 else 's'} in revision r{revision}.",
            )
        )

    if accepted_asset_count == 0:
        gates.append(
            _gate(
                gate_id="asset_acceptance",
                label="Appearance assets accepted",
                status="warn",
                details="No generated or imported appearance assets are accepted for this revision.",
            )
        )
        warnings.append("Accept or mark production-ready any appearance assets that should be part of the product record.")
    else:
        gates.append(
            _gate(
                gate_id="asset_acceptance",
                label="Appearance assets accepted",
                status="pass",
                details=f"{accepted_asset_count} accepted asset{'' if accepted_asset_count == 1 else 's'} attached to the project.",
            )
        )

    if validation is None:
        gates.append(
            _gate(
                gate_id="validation",
                label="Validation is current",
                status="fail",
                details="No validation report has been recorded.",
            )
        )
        blockers.append("Run validation for the current revision.")
    elif validation.revision != revision:
        gates.append(
            _gate(
                gate_id="validation",
                label="Validation is current",
                status="fail",
                details=f"Latest validation is for r{validation.revision}, but the project is at r{revision}.",
            )
        )
        blockers.append("Run validation again after the latest project changes.")
    elif validation.status == CheckStatus.FAIL:
        failed = [check for check in validation.checks if check.status == CheckStatus.FAIL]
        gates.append(
            _gate(
                gate_id="validation",
                label="Validation is current",
                status="fail",
                details=f"{len(failed)} hard validation issue{'' if len(failed) == 1 else 's'} found.",
            )
        )
        blockers.extend(check.details for check in failed[:3])
    elif validation.status == CheckStatus.WARN:
        warned = [check for check in validation.checks if check.status == CheckStatus.WARN]
        gates.append(
            _gate(
                gate_id="validation",
                label="Validation is current",
                status="warn",
                details=f"Validation is current with {len(warned)} warning{'' if len(warned) == 1 else 's'}.",
            )
        )
        warnings.extend(check.details for check in warned[:3])
    else:
        gates.append(
            _gate(
                gate_id="validation",
                label="Validation is current",
                status="pass",
                details=f"Validation passed for revision r{revision}.",
            )
        )

    if latest_export is None:
        gates.append(
            _gate(
                gate_id="export",
                label="Export bundle is current",
                status="warn",
                details="No export bundle has been recorded yet.",
            )
        )
        next_actions.append("Export a bundle after validation passes or warnings are accepted.")
    elif _artifact_source_revision(latest_export) != revision:
        gates.append(
            _gate(
                gate_id="export",
                label="Export bundle is current",
                status="warn",
                details=f"Latest export was created from r{_artifact_source_revision(latest_export)}, not r{revision}.",
            )
        )
        warnings.append("The recorded export bundle is stale for the current revision.")
        next_actions.append("Create a fresh export bundle for this revision.")
    else:
        gates.append(
            _gate(
                gate_id="export",
                label="Export bundle is current",
                status="pass",
                details="An export bundle is recorded for the current revision.",
            )
        )

    if active_jobs:
        gates.append(
            _gate(
                gate_id="jobs",
                label="Provider jobs are settled",
                status="warn",
                details=f"{len(active_jobs)} provider or compile job{'' if len(active_jobs) == 1 else 's'} still active.",
            )
        )
        warnings.append("Wait for active jobs to complete before treating outputs as final.")
    else:
        gates.append(
            _gate(
                gate_id="jobs",
                label="Provider jobs are settled",
                status="pass",
                details="No active provider or compile jobs are recorded.",
            )
        )

    if blockers:
        status = "blocked"
    elif any(gate["status"] == "warn" for gate in gates):
        status = "review_ready"
    elif latest_export and _artifact_source_revision(latest_export) == revision:
        status = "export_ready"
    else:
        status = "validated"

    if not next_actions:
        if status == "export_ready":
            next_actions.append("Review the export bundle and manufacturing notes before sharing externally.")
        elif status == "validated":
            next_actions.append("Create an export bundle for this validated revision.")
        elif status == "review_ready":
            next_actions.append("Review warnings, then decide whether to export a candidate bundle.")

    return {
        "project_id": project.project_id,
        "revision": revision,
        "status": status,
        "gates": gates,
        "blockers": blockers,
        "warnings": warnings,
        "next_actions": next_actions,
        "counts": {
            "elements": element_count,
            "accepted_assets": accepted_asset_count,
            "artifacts": len(artifacts),
            "jobs": len(jobs),
            "active_jobs": len(active_jobs),
        },
    }
