"""Quality gate summary tests."""

from __future__ import annotations

from datetime import datetime, timezone

from server.db.models import ProjectArtifactRow, ProjectJobRow
from server.models.project import AcceptanceState, KeyboardProject, KeySpec, KeycapAsset, LayoutSpec
from server.models.validation_schema import CheckStatus, ValidationCheck, ValidationReport
from server.services.quality_gate import QualityGateInput, build_quality_gate_summary


def _project() -> KeyboardProject:
    project = KeyboardProject(
        project_id="quality_test",
        layout=LayoutSpec(keys=[KeySpec(id="k1", label="A", x_u=0, y_u=0)]),
    )
    project.switch_profile.part_id = "cherry_mx_red"
    return project


def _validation_report(*, revision: int, status: CheckStatus) -> ValidationReport:
    checks = [
        ValidationCheck(
            id="layout_nonempty",
            category="geometry",
            status=CheckStatus.PASS,
            details="Layout contains placed controls.",
        )
    ]
    if status == CheckStatus.FAIL:
        checks.append(
            ValidationCheck(
                id="element_overlap",
                category="geometry",
                status=CheckStatus.FAIL,
                details="Two controls overlap.",
            )
        )
    elif status == CheckStatus.WARN:
        checks.append(
            ValidationCheck(
                id="switch_selected",
                category="pcb",
                status=CheckStatus.WARN,
                details="Switch is using a default profile.",
            )
        )

    return ValidationReport(
        report_id=f"vr_{revision}_{status.value}",
        project_id="quality_test",
        revision=revision,
        status=status,
        checks=checks,
    )


def _export_artifact(*, revision: int) -> ProjectArtifactRow:
    return ProjectArtifactRow(
        artifact_id=f"bundle_{revision}",
        project_id="quality_test",
        revision=revision,
        kind="export_bundle",
        path="/tmp/bundle.zip",
        details={"source_revision": revision, "acceptance_state": "review_ready"},
        created_at=datetime.now(timezone.utc),
    )


def test_quality_gate_blocks_without_validation():
    summary = build_quality_gate_summary(
        QualityGateInput(
            project=_project(),
            artifacts=[],
            jobs=[],
            latest_validation_report=None,
        )
    )

    assert summary["status"] == "blocked"
    assert "Run validation for the current revision." in summary["blockers"]
    assert any(gate["id"] == "validation" and gate["status"] == "fail" for gate in summary["gates"])


def test_quality_gate_marks_stale_validation_as_blocking():
    project = _project()
    project.revision = 3

    summary = build_quality_gate_summary(
        QualityGateInput(
            project=project,
            artifacts=[],
            jobs=[],
            latest_validation_report=_validation_report(revision=2, status=CheckStatus.PASS),
        )
    )

    assert summary["status"] == "blocked"
    assert any("Run validation again" in blocker for blocker in summary["blockers"])


def test_quality_gate_export_ready_when_current_validation_and_export_pass():
    project = _project()
    project.revision = 4
    project.keycap_assets.append(
        KeycapAsset(
            asset_id="asset_ready",
            source="generated",
            acceptance_state=AcceptanceState.ACCEPTED,
        )
    )

    summary = build_quality_gate_summary(
        QualityGateInput(
            project=project,
            artifacts=[_export_artifact(revision=4)],
            jobs=[],
            latest_validation_report=_validation_report(revision=4, status=CheckStatus.PASS),
        )
    )

    assert summary["status"] == "export_ready"
    assert summary["counts"]["elements"] == 1
    assert summary["blockers"] == []


def test_quality_gate_warns_on_active_jobs():
    project = _project()
    job = ProjectJobRow(
        job_id="job_active",
        project_id="quality_test",
        revision=project.revision,
        job_type="keycap_generation",
        status="submitted",
        input_data={},
        output_data={},
    )

    summary = build_quality_gate_summary(
        QualityGateInput(
            project=project,
            artifacts=[],
            jobs=[job],
            latest_validation_report=_validation_report(revision=project.revision, status=CheckStatus.PASS),
        )
    )

    assert summary["status"] == "review_ready"
    assert summary["counts"]["active_jobs"] == 1
    assert any(gate["id"] == "jobs" and gate["status"] == "warn" for gate in summary["gates"])
