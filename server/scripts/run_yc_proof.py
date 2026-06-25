"""Run a deterministic YC/demo proof path for BreakGen."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select

from server.api.export import export_project_bundle
from server.api.geometry import compile_mechanical_for_project
from server.api.pcb import compile_pcb_for_project
from server.config import settings
from server.db.database import async_session, engine
from server.db.models import ProjectArtifactRow, ProjectJobRow, ProjectRevisionRow, ProjectRow
from server.models.project import KeyboardProject, LayoutSpec, ProductDomain, ProductFamily, ProjectStatus, domain_for_family
from server.models.supported_configs import SUPPORTED_TEMPLATES
from server.services.artifact_registry import delete_project_artifact_tree
from server.services.project_state import create_project_record

DEFAULT_PROJECT_ID = "yc_proof_streamdeck"
DEFAULT_TEMPLATE_ID = "streamdeck_display_3x5"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a real BreakGen proof project, compile it, validate it, and export a bundle."
    )
    parser.add_argument("--project-id", default=DEFAULT_PROJECT_ID)
    parser.add_argument("--template-id", default=DEFAULT_TEMPLATE_ID)
    parser.add_argument("--name", default="YC Proof Stream Deck")
    parser.add_argument(
        "--no-reset",
        action="store_true",
        help="Fail if the proof project already exists instead of resetting it.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON only.",
    )
    return parser.parse_args()


def _template_meta(template_id: str):
    return next((template for template in SUPPORTED_TEMPLATES if template.template_id == template_id), None)


def _load_template_project(*, project_id: str, template_id: str, name: str) -> KeyboardProject:
    template = _template_meta(template_id)
    if template is None:
        raise ValueError(f"Unknown template: {template_id}")

    template_path = Path(settings.templates_dir) / f"{template_id}.json"
    with open(template_path) as f:
        template_data = json.load(f)

    family = template.product_family
    domain = domain_for_family(family)
    project = KeyboardProject(
        project_id=project_id,
        product_domain=domain,
        product_family=family,
        name=name,
        revision=1,
        status=ProjectStatus.CONFIGURED,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        template=template_id,
        layout=LayoutSpec(**template_data["layout"]),
    )
    if family in {
        ProductFamily.KEYBOARD,
        ProductFamily.MACROPAD,
        ProductFamily.STREAMDECK,
        ProductFamily.MIDI,
    }:
        project.switch_profile.part_id = "cherry_mx_red"
    return project


async def _delete_existing_project(db, project_id: str) -> None:
    for model in (ProjectRevisionRow, ProjectArtifactRow, ProjectJobRow, ProjectRow):
        result = await db.execute(select(model).where(model.project_id == project_id))
        for row in result.scalars().all():
            await db.delete(row)
    delete_project_artifact_tree(project_id)
    await db.commit()


async def _artifact_summary(db, project_id: str) -> list[dict[str, Any]]:
    result = await db.execute(
        select(ProjectArtifactRow)
        .where(ProjectArtifactRow.project_id == project_id)
        .order_by(ProjectArtifactRow.created_at.asc(), ProjectArtifactRow.kind.asc())
    )
    artifacts = []
    for row in result.scalars().all():
        artifacts.append(
            {
                "artifact_id": row.artifact_id,
                "kind": row.kind,
                "revision": row.revision,
                "role": row.details.get("artifact_role", row.kind),
                "acceptance_state": row.details.get("acceptance_state"),
                "producer": row.details.get("producer_id"),
                "source_revision": row.details.get("source_revision", row.revision),
                "sha256": row.sha256,
                "file_name": Path(row.path).name,
                "path": row.path,
            }
        )
    return artifacts


def _read_json(path: str) -> dict[str, Any]:
    with open(path) as f:
        return json.load(f)


async def run_proof(*, project_id: str, template_id: str, name: str, reset: bool) -> dict[str, Any]:
    async with async_session() as db:
        existing = (
            await db.execute(select(ProjectRow).where(ProjectRow.project_id == project_id))
        ).scalar_one_or_none()
        if existing is not None:
            if not reset:
                raise ValueError(f"Project already exists: {project_id}")
            await _delete_existing_project(db, project_id)

        project = _load_template_project(
            project_id=project_id,
            template_id=template_id,
            name=name,
        )
        await create_project_record(
            db,
            project,
            change_summary="YC proof project created",
        )

        electronics = await compile_pcb_for_project(project_id, db, owner_user_id=None)
        mechanical = await compile_mechanical_for_project(
            project_id,
            None,
            db,
            owner_user_id=None,
        )
        export_response = await export_project_bundle(project_id, db, owner_user_id=None)

        row = (
            await db.execute(select(ProjectRow).where(ProjectRow.project_id == project_id))
        ).scalar_one()
        artifacts = await _artifact_summary(db, project_id)
        latest_validation = next(
            artifact for artifact in reversed(artifacts) if artifact["kind"] == "validation_report"
        )
        validation = _read_json(latest_validation["path"])
        latest_export = next(
            artifact for artifact in reversed(artifacts) if artifact["kind"] == "export_bundle"
        )

        return {
            "proof": "breakgen_yc_demo",
            "project_id": project_id,
            "name": row.name,
            "template_id": template_id,
            "product_domain": ProductDomain(row.data["product_domain"]).value,
            "product_family": ProductFamily(row.product_family).value,
            "revision": row.revision,
            "status": row.status,
            "electronics": {
                "revision": electronics["revision"],
                "matrix_strategy": electronics["matrix_strategy"],
                "matrix_controls": electronics["matrix_controls"],
                "direct_controls": electronics["direct_controls"],
                "pins_needed": electronics["pins_needed"],
                "gpio_budget": electronics["gpio_budget"],
                "firmware_target": electronics["firmware_target"],
                "control_protocol": electronics["control_protocol"],
            },
            "mechanical": {
                "revision": mechanical["revision"],
                "kind": mechanical["mechanical_kind"],
                "artifact_ids": mechanical["artifact_ids"],
            },
            "validation": {
                "report_id": validation["report_id"],
                "revision": validation["revision"],
                "status": validation["status"],
                "check_count": len(validation["checks"]),
                "failed_checks": [
                    check["id"] for check in validation["checks"] if check["status"] == "fail"
                ],
                "warn_checks": [
                    check["id"] for check in validation["checks"] if check["status"] == "warn"
                ],
            },
            "export": {
                "bundle_id": export_response.headers.get("X-Bundle-Id"),
                "validation_status": export_response.headers.get("X-Validation-Status"),
                "readiness": export_response.headers.get("X-Export-Readiness"),
                "artifact_id": latest_export["artifact_id"],
                "sha256": latest_export["sha256"],
                "path": latest_export["path"],
            },
            "artifacts": artifacts,
        }


def _print_human(summary: dict[str, Any]) -> None:
    print("BreakGen YC proof complete")
    print(f"project: {summary['project_id']} ({summary['product_family']})")
    print(f"revision: r{summary['revision']} status={summary['status']}")
    print(
        "electronics: "
        f"{summary['electronics']['matrix_strategy']} "
        f"{summary['electronics']['pins_needed']}/{summary['electronics']['gpio_budget']} GPIO "
        f"target={summary['electronics']['firmware_target']}"
    )
    print(
        "mechanical: "
        f"{summary['mechanical']['kind']} "
        f"artifacts={', '.join(summary['mechanical']['artifact_ids'])}"
    )
    print(
        "validation: "
        f"{summary['validation']['status']} "
        f"checks={summary['validation']['check_count']} "
        f"warnings={len(summary['validation']['warn_checks'])}"
    )
    print(
        "export: "
        f"{summary['export']['bundle_id']} "
        f"readiness={summary['export']['readiness']} "
        f"sha256={summary['export']['sha256']}"
    )
    print(f"bundle: {summary['export']['path']}")
    print("artifacts:")
    for artifact in summary["artifacts"]:
        print(
            "  - "
            f"{artifact['kind']} "
            f"id={artifact['artifact_id']} "
            f"r{artifact['revision']} "
            f"sha256={artifact['sha256']}"
        )


def main() -> None:
    args = parse_args()
    engine.echo = False
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    summary = asyncio.run(
        run_proof(
            project_id=args.project_id,
            template_id=args.template_id,
            name=args.name,
            reset=not args.no_reset,
        )
    )
    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        _print_human(summary)


if __name__ == "__main__":
    main()
