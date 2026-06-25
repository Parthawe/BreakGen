"""Geometry compilation endpoints for family-aware mechanical artifacts."""

from datetime import datetime, timezone
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.auth import require_user, user_scope_id
from server.db.database import get_db
from server.db.models import ProjectArtifactRow, ProjectRow, UserRow
from server.geometry.plate_generator import (
    PlateConfig,
    generate_plate_dxf,
    get_plate_bounds,
    summarize_plate_geometry,
)
from server.geometry.handheld_shell_generator import (
    HandheldShellConfig,
    compile_handheld_shell_spec,
    generate_handheld_shell_artifacts,
)
from server.models.project import KeyboardProject, ProductFamily
from server.services.artifact_registry import (
    find_latest_artifact,
    project_state_fingerprint,
    record_mechanical_panel_compile,
    record_mechanical_shell_compile,
)
from server.services.project_state import persist_project_metadata

router = APIRouter(prefix="/api/projects", tags=["geometry"])

HANDHELD_PROOF_FAMILIES = {
    ProductFamily.HANDHELD_COMPANION,
    ProductFamily.RETRO_HANDHELD,
}


class PlateConfigRequest(BaseModel):
    edge_margin_mm: float = 7.5
    kerf_compensation_mm: float = 0.0
    include_stabilizers: bool = True
    include_mounting_holes: bool = True


class ShellConfigRequest(BaseModel):
    shell_margin_mm: float = 14.0
    wall_thickness_mm: float = 2.6
    front_shell_depth_mm: float = 8.0
    back_shell_depth_mm: float = 16.0
    bezel_margin_mm: float = 2.0
    corner_radius_mm: float = 10.0
    screw_hole_diameter_mm: float = 2.4
    screw_hole_inset_mm: float = 8.0
    battery_clearance_mm: float = 2.0


class MechanicalCompileRequest(BaseModel):
    edge_margin_mm: float = 7.5
    kerf_compensation_mm: float = 0.0
    include_stabilizers: bool = True
    include_mounting_holes: bool = True
    shell_margin_mm: float = 14.0
    wall_thickness_mm: float = 2.6
    front_shell_depth_mm: float = 8.0
    back_shell_depth_mm: float = 16.0
    bezel_margin_mm: float = 2.0
    corner_radius_mm: float = 10.0
    screw_hole_diameter_mm: float = 2.4
    screw_hole_inset_mm: float = 8.0
    battery_clearance_mm: float = 2.0


MECHANICAL_ARTIFACT_KINDS = {
    "panel.dxf": "mechanical_panel_dxf",
    "front-shell-panel.dxf": "mechanical_front_shell_dxf",
    "back-shell-reference.dxf": "mechanical_back_shell_dxf",
    "shell-spec.json": "mechanical_shell_spec",
}


def _panel_dxf_url(project_id: str) -> str:
    return f"/api/projects/{project_id}/export/mechanical/panel.dxf"


def _front_shell_dxf_url(project_id: str) -> str:
    return f"/api/projects/{project_id}/export/mechanical/front-shell-panel.dxf"


def _back_shell_dxf_url(project_id: str) -> str:
    return f"/api/projects/{project_id}/export/mechanical/back-shell-reference.dxf"


def _shell_spec_url(project_id: str) -> str:
    return f"/api/projects/{project_id}/export/mechanical/shell-spec.json"


def _download_basename(project: KeyboardProject) -> str:
    return project.name.replace(" ", "_")


def _mechanical_download_filename(
    project: KeyboardProject,
    artifact_name: str,
) -> str:
    base = _download_basename(project)
    return {
        "panel.dxf": f"{base}_panel.dxf",
        "front-shell-panel.dxf": f"{base}_front_shell_panel.dxf",
        "back-shell-reference.dxf": f"{base}_back_shell_reference.dxf",
        "shell-spec.json": f"{base}_shell_spec.json",
    }[artifact_name]


async def _load_project_row(
    project_id: str,
    db: AsyncSession,
    owner_user_id: int | None = None,
) -> ProjectRow:
    stmt = select(ProjectRow).where(ProjectRow.project_id == project_id)
    if owner_user_id is not None:
        stmt = stmt.where(ProjectRow.user_id == owner_user_id)
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return row


def _require_layout(project: KeyboardProject):
    if not project.layout.elements and not project.layout.keys:
        raise HTTPException(status_code=400, detail="Layout has no placed elements")


def _plate_config_from_request(
    config: PlateConfigRequest | MechanicalCompileRequest | None,
) -> PlateConfig:
    return PlateConfig(
        edge_margin_mm=config.edge_margin_mm if config else 7.5,
        kerf_compensation_mm=config.kerf_compensation_mm if config else 0.0,
        include_stabilizers=config.include_stabilizers if config else True,
        include_mounting_holes=config.include_mounting_holes if config else True,
    )


def _plate_config_details(config: PlateConfig) -> dict:
    return {
        "edge_margin_mm": config.edge_margin_mm,
        "kerf_compensation_mm": config.kerf_compensation_mm,
        "include_stabilizers": config.include_stabilizers,
        "include_mounting_holes": config.include_mounting_holes,
    }


def _shell_config_from_request(
    config: ShellConfigRequest | MechanicalCompileRequest | None,
) -> HandheldShellConfig:
    return HandheldShellConfig(
        shell_margin_mm=config.shell_margin_mm if config else 14.0,
        wall_thickness_mm=config.wall_thickness_mm if config else 2.6,
        front_shell_depth_mm=config.front_shell_depth_mm if config else 8.0,
        back_shell_depth_mm=config.back_shell_depth_mm if config else 16.0,
        bezel_margin_mm=config.bezel_margin_mm if config else 2.0,
        corner_radius_mm=config.corner_radius_mm if config else 10.0,
        screw_hole_diameter_mm=config.screw_hole_diameter_mm if config else 2.4,
        screw_hole_inset_mm=config.screw_hole_inset_mm if config else 8.0,
        battery_clearance_mm=config.battery_clearance_mm if config else 2.0,
    )


def _shell_config_details(config: HandheldShellConfig) -> dict:
    return {
        "shell_margin_mm": config.shell_margin_mm,
        "wall_thickness_mm": config.wall_thickness_mm,
        "front_shell_depth_mm": config.front_shell_depth_mm,
        "back_shell_depth_mm": config.back_shell_depth_mm,
        "bezel_margin_mm": config.bezel_margin_mm,
        "corner_radius_mm": config.corner_radius_mm,
        "screw_hole_diameter_mm": config.screw_hole_diameter_mm,
        "screw_hole_inset_mm": config.screw_hole_inset_mm,
        "battery_clearance_mm": config.battery_clearance_mm,
    }


def _compile_panel_payload(
    project_id: str,
    project: KeyboardProject,
    config: PlateConfig,
) -> dict:
    bounds = get_plate_bounds(project.layout, config)
    summary = summarize_plate_geometry(project.layout, config)

    return {
        "project_id": project_id,
        "revision": project.revision,
        "status": "compiled",
        "mechanical_kind": "panel",
        "geometry_kind": summary["geometry_kind"],
        "key_count": summary["key_count"],
        "element_count": summary["element_count"],
        "cutout_summary": summary["cutout_summary"],
        "mounting_hole_count": summary["mounting_hole_count"],
        "plate_width_mm": round(bounds["width_mm"], 2),
        "plate_height_mm": round(bounds["height_mm"], 2),
        "artifact_urls": {
            "panel_dxf": _panel_dxf_url(project_id),
        },
    }


def _compile_shell_payload(
    project_id: str,
    project: KeyboardProject,
    config: HandheldShellConfig,
) -> dict:
    spec = compile_handheld_shell_spec(project.layout, config)
    return {
        "project_id": project_id,
        "revision": project.revision,
        "status": "compiled",
        "mechanical_kind": "shell",
        **spec,
        "artifact_urls": {
            "front_shell_panel_dxf": _front_shell_dxf_url(project_id),
            "back_shell_reference_dxf": _back_shell_dxf_url(project_id),
            "shell_spec_json": _shell_spec_url(project_id),
        },
    }


async def _persist_mechanical_summary(
    db: AsyncSession,
    row: ProjectRow,
    project: KeyboardProject,
    payload: dict,
    artifact_rows: list,
    *,
    compiled_at: datetime,
    source_spec_hash: str,
) -> dict:
    artifact_ids = [artifact_row.artifact_id for artifact_row in artifact_rows]
    result = {
        **payload,
        "artifact_ids": artifact_ids,
        "compiled_at": compiled_at.isoformat(),
    }
    project.derived["mechanical"] = {
        "summary": result,
        "artifact_ids": artifact_ids,
        "mechanical_kind": payload["mechanical_kind"],
        "source_revision": project.revision,
        "source_spec_hash": source_spec_hash,
        "compiled_at": compiled_at.isoformat(),
    }
    await persist_project_metadata(
        db,
        row,
        project,
        now=compiled_at,
    )
    return result


async def _compile_and_record_panel(
    db: AsyncSession,
    row: ProjectRow,
    project: KeyboardProject,
    config: PlateConfig,
) -> tuple[dict, list]:
    payload = _compile_panel_payload(project.project_id, project, config)
    compiled_at = datetime.now(timezone.utc)
    source_spec_hash = project_state_fingerprint(project)
    tmp = tempfile.NamedTemporaryFile(suffix=".dxf", delete=False)
    tmp.close()
    panel_path = Path(tmp.name)
    try:
        generate_plate_dxf(project.layout, config, output_path=panel_path)
        artifact_rows = await record_mechanical_panel_compile(
            db,
            project=project,
            summary_payload=payload,
            panel_dxf_path=panel_path,
            compile_config=_plate_config_details(config),
            source_spec_hash=source_spec_hash,
            created_at=compiled_at,
        )
        result = await _persist_mechanical_summary(
            db,
            row,
            project,
            payload,
            artifact_rows,
            compiled_at=compiled_at,
            source_spec_hash=source_spec_hash,
        )
        return result, artifact_rows
    finally:
        panel_path.unlink(missing_ok=True)


async def _compile_and_record_shell(
    db: AsyncSession,
    row: ProjectRow,
    project: KeyboardProject,
    config: HandheldShellConfig,
) -> tuple[dict, list]:
    payload = _compile_shell_payload(project.project_id, project, config)
    compiled_at = datetime.now(timezone.utc)
    source_spec_hash = project_state_fingerprint(project)
    with tempfile.TemporaryDirectory(prefix="breakgen-shell-") as tmp_dir:
        artifacts = generate_handheld_shell_artifacts(
            project.layout,
            Path(tmp_dir),
            config=config,
        )
        artifact_rows = await record_mechanical_shell_compile(
            db,
            project=project,
            summary_payload=payload,
            front_panel_path=artifacts["front_panel_path"],
            back_reference_path=artifacts["back_reference_path"],
            shell_spec_path=artifacts["spec_path"],
            compile_config=_shell_config_details(config),
            source_spec_hash=source_spec_hash,
            created_at=compiled_at,
        )
    result = await _persist_mechanical_summary(
        db,
        row,
        project,
        payload,
        artifact_rows,
        compiled_at=compiled_at,
        source_spec_hash=source_spec_hash,
    )
    return result, artifact_rows


async def _resolve_or_build_mechanical_artifact(
    db: AsyncSession,
    row: ProjectRow,
    project: KeyboardProject,
    artifact_name: str,
) -> tuple[Path, str]:
    kind = MECHANICAL_ARTIFACT_KINDS.get(artifact_name)
    if kind is None:
        raise HTTPException(status_code=404, detail="Mechanical artifact not found")

    expected_config = (
        _plate_config_details(PlateConfig())
        if artifact_name == "panel.dxf"
        else _shell_config_details(HandheldShellConfig())
    )

    if artifact_name == "panel.dxf":
        artifact_row = await _find_panel_artifact_for_config(db, project, PlateConfig())
    else:
        artifact_row = await find_latest_artifact(
            db,
            project.project_id,
            kind=kind,
            revision=project.revision,
        )
    if artifact_row and Path(artifact_row.path).exists():
        if artifact_name != "panel.dxf" and artifact_row.details.get("compile_config") != expected_config:
            artifact_row = None
        else:
            return Path(artifact_row.path), _mechanical_download_filename(project, artifact_name)

    if artifact_name == "panel.dxf":
        _, artifact_rows = await _compile_and_record_panel(
            db,
            row,
            project,
            PlateConfig(),
        )
    else:
        if project.product_family not in HANDHELD_PROOF_FAMILIES:
            raise HTTPException(
                status_code=400,
                detail="Shell artifacts are only available for handheld proof families",
            )
        if not project.layout.elements:
            raise HTTPException(status_code=400, detail="Layout has no placed elements")
        _, artifact_rows = await _compile_and_record_shell(
            db,
            row,
            project,
            HandheldShellConfig(),
        )

    for artifact_row in artifact_rows:
        if artifact_row.kind == kind and Path(artifact_row.path).exists():
            return Path(artifact_row.path), _mechanical_download_filename(project, artifact_name)

    raise HTTPException(status_code=500, detail="Mechanical artifact compilation failed")


async def _find_panel_artifact_for_config(
    db: AsyncSession,
    project: KeyboardProject,
    config: PlateConfig,
) -> ProjectArtifactRow | None:
    expected_config = _plate_config_details(config)
    result = await db.execute(
        select(ProjectArtifactRow)
        .where(
            ProjectArtifactRow.project_id == project.project_id,
            ProjectArtifactRow.kind == "mechanical_panel_dxf",
            ProjectArtifactRow.revision == project.revision,
        )
        .order_by(ProjectArtifactRow.created_at.desc())
    )
    for artifact_row in result.scalars().all():
        if (
            artifact_row.details.get("compile_config") == expected_config
            and Path(artifact_row.path).exists()
        ):
            return artifact_row
    return None


@router.post("/{project_id}/compile/plate")
async def compile_plate(
    project_id: str,
    config: PlateConfigRequest | None = None,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Compile mechanical panel geometry from the project's layout."""
    row = await _load_project_row(project_id, db, user_scope_id(user))
    project = KeyboardProject(**row.data)
    _require_layout(project)

    result, _ = await _compile_and_record_panel(
        db,
        row,
        project,
        _plate_config_from_request(config),
    )
    return result


@router.post("/{project_id}/compile/shell")
async def compile_shell(
    project_id: str,
    config: ShellConfigRequest | None = None,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Compile handheld shell metadata for planned portable proof families."""
    row = await _load_project_row(project_id, db, user_scope_id(user))
    project = KeyboardProject(**row.data)
    if project.product_family not in HANDHELD_PROOF_FAMILIES:
        raise HTTPException(
            status_code=400,
            detail="Shell compilation is only available for handheld proof families",
        )
    if not project.layout.elements:
        raise HTTPException(status_code=400, detail="Layout has no placed elements")

    result, _ = await _compile_and_record_shell(
        db,
        row,
        project,
        _shell_config_from_request(config),
    )
    return result


@router.post("/{project_id}/compile/mechanical")
async def compile_mechanical(
    project_id: str,
    config: MechanicalCompileRequest | None = None,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    return await compile_mechanical_for_project(
        project_id,
        config,
        db,
        owner_user_id=user_scope_id(user),
    )


async def compile_mechanical_for_project(
    project_id: str,
    config: MechanicalCompileRequest | None,
    db: AsyncSession,
    *,
    owner_user_id: int | None,
):
    """Compile family-aware mechanical artifacts from the project's layout."""
    row = await _load_project_row(project_id, db, owner_user_id)
    project = KeyboardProject(**row.data)
    _require_layout(project)

    if project.product_family in HANDHELD_PROOF_FAMILIES:
        if not project.layout.elements:
            raise HTTPException(status_code=400, detail="Layout has no placed elements")
        result, _ = await _compile_and_record_shell(
            db,
            row,
            project,
            _shell_config_from_request(config),
        )
        return result

    result, _ = await _compile_and_record_panel(
        db,
        row,
        project,
        _plate_config_from_request(config),
    )
    return result


@router.get("/{project_id}/export/plate.dxf")
async def export_plate_dxf(
    project_id: str,
    kerf_mm: float = 0.0,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Download the mechanical panel as a DXF file."""
    row = await _load_project_row(project_id, db, user_scope_id(user))
    project = KeyboardProject(**row.data)
    _require_layout(project)

    plate_config = PlateConfig(kerf_compensation_mm=kerf_mm)
    artifact_row = await _find_panel_artifact_for_config(db, project, plate_config)
    if artifact_row is None:
        _, artifact_rows = await _compile_and_record_panel(
            db,
            row,
            project,
            plate_config,
        )
        artifact_row = next(
            (
                artifact_row
                for artifact_row in artifact_rows
                if artifact_row.kind == "mechanical_panel_dxf"
                and Path(artifact_row.path).exists()
            ),
            None,
        )

    if artifact_row is None:
        raise HTTPException(status_code=500, detail="Plate artifact compilation failed")

    return FileResponse(
        artifact_row.path,
        media_type="application/dxf",
        filename=f"{_download_basename(project)}_plate.dxf",
    )


@router.get("/{project_id}/export/mechanical/{artifact_name}")
async def export_mechanical_artifact(
    project_id: str,
    artifact_name: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Download family-aware mechanical artifacts on demand."""
    row = await _load_project_row(project_id, db, user_scope_id(user))
    project = KeyboardProject(**row.data)
    _require_layout(project)

    path, filename = await _resolve_or_build_mechanical_artifact(
        db,
        row,
        project,
        artifact_name,
    )
    media_type = "application/json" if artifact_name.endswith(".json") else "application/dxf"
    return FileResponse(path, media_type=media_type, filename=filename)
