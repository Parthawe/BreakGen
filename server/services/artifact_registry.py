"""Artifact storage and registry helpers."""

from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.config import settings
from server.db.models import ProjectArtifactRow
from server.models.project import KeyboardProject
from server.models.validation_schema import ValidationReport


def project_artifact_dir(
    project_id: str,
    *parts: str,
    base_dir: str | Path | None = None,
) -> Path:
    """Return the artifact directory for a specific project subtree."""
    root = Path(base_dir or settings.artifacts_dir)
    path = root / "projects" / project_id
    for part in parts:
        path /= part
    path.mkdir(parents=True, exist_ok=True)
    return path


def delete_project_artifact_tree(
    project_id: str,
    *,
    base_dir: str | Path | None = None,
) -> None:
    """Delete all artifact files owned by a project."""
    root = Path(base_dir or settings.artifacts_dir).resolve()
    target = (root / "projects" / project_id).resolve()
    if root not in target.parents:
        raise ValueError("Refusing to delete artifact path outside artifact root")
    shutil.rmtree(target, ignore_errors=True)


def sha256_for_path(path: str | Path) -> str:
    """Compute SHA-256 for a file path."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def project_state_fingerprint(project: KeyboardProject) -> str:
    """Compute a stable fingerprint for the current canonical project state."""
    payload = json.dumps(
        project.model_dump(mode="json"),
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def scoped_artifact_id(project_id: str, artifact_name: str) -> str:
    """Return a stable artifact id that cannot collide across projects."""
    project_hash = hashlib.sha1(project_id.encode("utf-8")).hexdigest()[:10]
    return f"{project_hash}_{artifact_name}"


def write_json_artifact(
    project_id: str,
    category: str,
    artifact_id: str,
    payload: dict,
    *,
    base_dir: str | Path | None = None,
) -> Path:
    """Write a JSON artifact to the project artifact store."""
    out_dir = project_artifact_dir(project_id, category, base_dir=base_dir)
    path = out_dir / f"{artifact_id}.json"
    with open(path, "w") as f:
        json.dump(payload, f, indent=2)
    return path


def register_artifact(
    db: AsyncSession,
    *,
    artifact_id: str,
    project_id: str,
    revision: int,
    kind: str,
    path: str | Path,
    sha256: str | None = None,
    content_type: str | None = None,
    details: dict | None = None,
    created_at: datetime | None = None,
) -> ProjectArtifactRow:
    """Register a durable artifact row; commit is managed by the caller."""
    row = ProjectArtifactRow(
        artifact_id=artifact_id,
        project_id=project_id,
        revision=revision,
        kind=kind,
        path=str(path),
        sha256=sha256,
        content_type=content_type,
        details=details or {},
        created_at=created_at or datetime.now(timezone.utc),
    )
    db.add(row)
    return row


async def upsert_artifact(
    db: AsyncSession,
    *,
    artifact_id: str,
    project_id: str,
    revision: int,
    kind: str,
    path: str | Path,
    sha256: str | None = None,
    content_type: str | None = None,
    details: dict | None = None,
    created_at: datetime | None = None,
) -> ProjectArtifactRow:
    """Create or replace a durable artifact row with a stable artifact id."""
    result = await db.execute(
        select(ProjectArtifactRow).where(ProjectArtifactRow.artifact_id == artifact_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = ProjectArtifactRow(
            artifact_id=artifact_id,
            project_id=project_id,
            revision=revision,
            kind=kind,
            path=str(path),
            sha256=sha256,
            content_type=content_type,
            details=details or {},
            created_at=created_at or datetime.now(timezone.utc),
        )
        db.add(row)
        return row

    row.project_id = project_id
    row.revision = revision
    row.kind = kind
    row.path = str(path)
    row.sha256 = sha256
    row.content_type = content_type
    row.details = details or {}
    row.created_at = created_at or datetime.now(timezone.utc)
    return row


def copy_project_artifact(
    project_id: str,
    category: str,
    artifact_name: str,
    source_path: str | Path,
    *,
    subdir: str | None = None,
    base_dir: str | Path | None = None,
) -> Path:
    """Copy a file into the durable project artifact store."""
    parts = [category]
    if subdir:
        parts.append(subdir)
    out_dir = project_artifact_dir(project_id, *parts, base_dir=base_dir)
    dest = out_dir / artifact_name
    shutil.copy2(source_path, dest)
    return dest


def record_validation_report(
    db: AsyncSession,
    *,
    report: ValidationReport,
    domain: str | None = None,
    family: str | None = None,
    source_spec_hash: str | None = None,
    base_dir: str | Path | None = None,
) -> ProjectArtifactRow:
    """Persist a validation report JSON file and register it."""
    path = write_json_artifact(
        report.project_id,
        "validation",
        report.report_id,
        report.model_dump(mode="json"),
        base_dir=base_dir,
    )
    return register_artifact(
        db,
        artifact_id=report.report_id,
        project_id=report.project_id,
        revision=report.revision,
        kind="validation_report",
        path=path,
        sha256=sha256_for_path(path),
        content_type="application/json",
        details={
            "artifact_role": "validation_report",
            "domain": domain,
            "family": family,
            "source_revision": report.revision,
            "source_spec_hash": source_spec_hash,
            "producer_kind": "compiler",
            "producer_id": "validation_engine",
            "lineage": {
                "project_id": report.project_id,
                "revision": report.revision,
                "validated": True,
            },
            "acceptance_state": "production_ready" if report.status.value == "pass" else "candidate",
            "status": report.status.value,
            "check_count": len(report.checks),
        },
        created_at=report.created_at,
    )


def record_export_bundle(
    db: AsyncSession,
    *,
    project_id: str,
    revision: int,
    bundle_id: str,
    zip_path: str | Path,
    validation_report_id: str,
    validation_status: str | None = None,
    acceptance_state: str = "prototype_ready",
    domain: str | None = None,
    family: str | None = None,
    source_spec_hash: str | None = None,
    created_at: datetime | None = None,
) -> ProjectArtifactRow:
    """Register an export bundle ZIP file."""
    return register_artifact(
        db,
        artifact_id=bundle_id,
        project_id=project_id,
        revision=revision,
        kind="export_bundle",
        path=zip_path,
        sha256=sha256_for_path(zip_path),
        content_type="application/zip",
        details={
            "artifact_role": "export_bundle",
            "domain": domain,
            "family": family,
            "source_revision": revision,
            "source_spec_hash": source_spec_hash,
            "producer_kind": "compiler",
            "producer_id": "export_bundler",
            "lineage": {
                "project_id": project_id,
                "revision": revision,
                "validation_report_id": validation_report_id,
            },
            "validation_report_id": validation_report_id,
            "validation_status": validation_status,
            "acceptance_state": acceptance_state,
        },
        created_at=created_at,
    )


async def record_mechanical_panel_compile(
    db: AsyncSession,
    *,
    project: KeyboardProject,
    summary_payload: dict,
    panel_dxf_path: str | Path,
    compile_config: dict | None = None,
    source_spec_hash: str | None = None,
    base_dir: str | Path | None = None,
    created_at: datetime | None = None,
) -> list[ProjectArtifactRow]:
    """Persist and register a control-surface mechanical panel compile."""
    created_at = created_at or datetime.now(timezone.utc)
    subdir = f"revision_{project.revision}"
    stored_panel = copy_project_artifact(
        project.project_id,
        "mechanical",
        "panel.dxf",
        panel_dxf_path,
        subdir=subdir,
        base_dir=base_dir,
    )
    summary_path = write_json_artifact(
        project.project_id,
        f"mechanical/{subdir}",
        f"panel_summary_r{project.revision}",
        summary_payload,
        base_dir=base_dir,
    )
    base_details = {
        "domain": project.product_domain.value,
        "family": project.product_family.value,
        "source_revision": project.revision,
        "source_spec_hash": source_spec_hash,
        "producer_kind": "compiler",
        "producer_id": "mechanical_compiler",
        "lineage": {
            "project_id": project.project_id,
            "revision": project.revision,
            "mechanical_kind": "panel",
        },
        "compile_config": compile_config or {},
        "acceptance_state": "candidate",
    }
    rows = [
        await upsert_artifact(
            db,
            artifact_id=scoped_artifact_id(project.project_id, f"mech_panel_dxf_r{project.revision}"),
            project_id=project.project_id,
            revision=project.revision,
            kind="mechanical_panel_dxf",
            path=stored_panel,
            sha256=sha256_for_path(stored_panel),
            content_type="application/dxf",
            details={
                **base_details,
                "artifact_role": "mechanical_panel_dxf",
                "geometry_kind": summary_payload.get("geometry_kind"),
            },
            created_at=created_at,
        ),
        await upsert_artifact(
            db,
            artifact_id=scoped_artifact_id(project.project_id, f"mech_panel_summary_r{project.revision}"),
            project_id=project.project_id,
            revision=project.revision,
            kind="mechanical_panel_summary",
            path=summary_path,
            sha256=sha256_for_path(summary_path),
            content_type="application/json",
            details={
                **base_details,
                "artifact_role": "mechanical_panel_summary",
                "geometry_kind": summary_payload.get("geometry_kind"),
            },
            created_at=created_at,
        ),
    ]
    return rows


async def record_mechanical_shell_compile(
    db: AsyncSession,
    *,
    project: KeyboardProject,
    summary_payload: dict,
    front_panel_path: str | Path,
    back_reference_path: str | Path,
    shell_spec_path: str | Path,
    compile_config: dict | None = None,
    source_spec_hash: str | None = None,
    base_dir: str | Path | None = None,
    created_at: datetime | None = None,
) -> list[ProjectArtifactRow]:
    """Persist and register a handheld shell compile."""
    created_at = created_at or datetime.now(timezone.utc)
    subdir = f"revision_{project.revision}"
    stored_front = copy_project_artifact(
        project.project_id,
        "mechanical",
        "front_shell_panel.dxf",
        front_panel_path,
        subdir=subdir,
        base_dir=base_dir,
    )
    stored_back = copy_project_artifact(
        project.project_id,
        "mechanical",
        "back_shell_reference.dxf",
        back_reference_path,
        subdir=subdir,
        base_dir=base_dir,
    )
    stored_spec = copy_project_artifact(
        project.project_id,
        "mechanical",
        "shell_spec.json",
        shell_spec_path,
        subdir=subdir,
        base_dir=base_dir,
    )
    base_details = {
        "domain": project.product_domain.value,
        "family": project.product_family.value,
        "source_revision": project.revision,
        "source_spec_hash": source_spec_hash,
        "producer_kind": "compiler",
        "producer_id": "mechanical_compiler",
        "lineage": {
            "project_id": project.project_id,
            "revision": project.revision,
            "mechanical_kind": "shell",
        },
        "compile_config": compile_config or {},
        "acceptance_state": "candidate",
        "shell_kind": summary_payload.get("shell_kind"),
    }
    rows = [
        await upsert_artifact(
            db,
            artifact_id=scoped_artifact_id(project.project_id, f"mech_front_shell_panel_r{project.revision}"),
            project_id=project.project_id,
            revision=project.revision,
            kind="mechanical_front_shell_dxf",
            path=stored_front,
            sha256=sha256_for_path(stored_front),
            content_type="application/dxf",
            details={**base_details, "artifact_role": "mechanical_front_shell_dxf"},
            created_at=created_at,
        ),
        await upsert_artifact(
            db,
            artifact_id=scoped_artifact_id(project.project_id, f"mech_back_shell_reference_r{project.revision}"),
            project_id=project.project_id,
            revision=project.revision,
            kind="mechanical_back_shell_dxf",
            path=stored_back,
            sha256=sha256_for_path(stored_back),
            content_type="application/dxf",
            details={**base_details, "artifact_role": "mechanical_back_shell_dxf"},
            created_at=created_at,
        ),
        await upsert_artifact(
            db,
            artifact_id=scoped_artifact_id(project.project_id, f"mech_shell_spec_r{project.revision}"),
            project_id=project.project_id,
            revision=project.revision,
            kind="mechanical_shell_spec",
            path=stored_spec,
            sha256=sha256_for_path(stored_spec),
            content_type="application/json",
            details={**base_details, "artifact_role": "mechanical_shell_spec"},
            created_at=created_at,
        ),
    ]
    return rows


async def list_project_artifacts(
    db: AsyncSession,
    project_id: str,
) -> list[ProjectArtifactRow]:
    """List artifact registry rows for a project."""
    result = await db.execute(
        select(ProjectArtifactRow)
        .where(ProjectArtifactRow.project_id == project_id)
        .order_by(ProjectArtifactRow.created_at.desc())
    )
    return list(result.scalars().all())


async def find_latest_artifact(
    db: AsyncSession,
    project_id: str,
    *,
    kind: str,
    revision: int | None = None,
) -> ProjectArtifactRow | None:
    """Return the newest artifact row for a project kind, optionally pinned to a revision."""
    stmt = select(ProjectArtifactRow).where(
        ProjectArtifactRow.project_id == project_id,
        ProjectArtifactRow.kind == kind,
    )
    if revision is not None:
        stmt = stmt.where(ProjectArtifactRow.revision == revision)
    result = await db.execute(stmt.order_by(ProjectArtifactRow.created_at.desc()))
    return result.scalars().first()
