"""Meshy generation ingestion helpers."""

from __future__ import annotations

from pathlib import Path
from typing import Protocol
from urllib.parse import urlparse

from server.geometry.mesh_processor import normalize_mesh
from server.models.project import (
    AcceptanceState,
    KeycapAsset,
    KeyboardProject,
    ProjectStatus,
)
from server.services.artifact_registry import (
    project_state_fingerprint,
    project_artifact_dir,
    register_artifact,
    sha256_for_path,
)
from server.services.job_registry import get_project_job_by_external_ref
from server.services.project_state import persist_project_metadata

_MODEL_URL_PRIORITY = ("glb", "gltf", "obj", "fbx", "usdz")


class ModelDownloader(Protocol):
    async def download_model(self, model_url: str, output_path: str) -> str: ...


class KeycapIngestionError(Exception):
    """Raised when a completed generation task cannot be ingested."""


def _sync_asset_registry_metadata(project: KeyboardProject) -> None:
    project.assets["accepted_asset_ids"] = [
        asset.asset_id
        for asset in project.keycap_assets
        if asset.acceptance_state in {
            AcceptanceState.ACCEPTED,
            AcceptanceState.PRODUCTION_READY,
        }
    ]
    project.assets["rejected_asset_ids"] = [
        asset.asset_id
        for asset in project.keycap_assets
        if asset.acceptance_state == AcceptanceState.REJECTED
    ]
    project.assets["asset_counts"] = {
        "accepted": len(
            [asset for asset in project.keycap_assets if asset.acceptance_state == AcceptanceState.ACCEPTED]
        ),
        "production_ready": len(
            [asset for asset in project.keycap_assets if asset.acceptance_state == AcceptanceState.PRODUCTION_READY]
        ),
        "candidate": len(
            [asset for asset in project.keycap_assets if asset.acceptance_state == AcceptanceState.CANDIDATE]
        ),
        "preview_only": len(
            [asset for asset in project.keycap_assets if asset.acceptance_state == AcceptanceState.PREVIEW_ONLY]
        ),
        "rejected": len(
            [asset for asset in project.keycap_assets if asset.acceptance_state == AcceptanceState.REJECTED]
        ),
    }


def _asset_id_for_task(task_id: str) -> str:
    return f"meshy_{task_id.replace('-', '_')}"


def _pick_model_url(result: dict) -> str:
    model_urls = result.get("model_urls") or {}
    for key in _MODEL_URL_PRIORITY:
        url = model_urls.get(key)
        if url:
            return url
    for value in model_urls.values():
        if value:
            return value
    raise KeycapIngestionError("Completed Meshy task has no downloadable model URL")


def _suffix_for_url(model_url: str) -> str:
    parsed = urlparse(model_url)
    suffix = Path(parsed.path).suffix.lower()
    return suffix or ".glb"


async def ingest_completed_keycap_generation(
    db,
    row,
    project: KeyboardProject,
    *,
    task_id: str,
    result: dict,
    client: ModelDownloader,
) -> KeycapAsset:
    """Download, normalize, register, and persist a completed generated keycap."""
    asset_id = _asset_id_for_task(task_id)
    existing = next((a for a in project.keycap_assets if a.asset_id == asset_id), None)
    if existing is not None:
        if project.status == ProjectStatus.GENERATING:
            project.status = ProjectStatus.PREVIEWABLE
            await persist_project_metadata(db, row, project)
        return existing

    job = await get_project_job_by_external_ref(db, project.project_id, task_id)
    model_url = _pick_model_url(result)
    raw_dir = project_artifact_dir(project.project_id, "keycaps", "raw")
    normalized_dir = project_artifact_dir(project.project_id, "keycaps", "normalized")
    raw_path = raw_dir / f"{asset_id}{_suffix_for_url(model_url)}"

    try:
        await client.download_model(model_url, str(raw_path))
        normalized = normalize_mesh(raw_path, normalized_dir, asset_id)
    except Exception as exc:  # pragma: no cover - defensive path
        raise KeycapIngestionError(str(exc)) from exc

    if not normalized.success or not normalized.export_path or not normalized.preview_path:
        errors = normalized.errors or ["Normalization failed"]
        raise KeycapIngestionError("; ".join(errors))

    details = {
        "asset_id": asset_id,
        "artifact_role": "generated_keycap",
        "provider": "meshy",
        "producer_kind": "provider",
        "producer_id": "meshy",
        "acceptance_state": AcceptanceState.CANDIDATE.value,
        "family": project.product_family.value,
        "source_revision": project.revision,
        "source_spec_hash": project_state_fingerprint(project),
        "task_id": task_id,
        "lineage": {
            "project_id": project.project_id,
            "revision": project.revision,
            "task_id": task_id,
        },
    }
    if job is not None:
        details["job_id"] = job.job_id

    register_artifact(
        db,
        artifact_id=f"{asset_id}_raw",
        project_id=project.project_id,
        revision=project.revision,
        kind="keycap_source_mesh",
        path=raw_path,
        sha256=sha256_for_path(raw_path),
        content_type="model/gltf-binary" if raw_path.suffix == ".glb" else "model/mesh",
        details=details,
    )

    preview_path = Path(normalized.preview_path)
    export_path = Path(normalized.export_path)
    register_artifact(
        db,
        artifact_id=f"{asset_id}_preview",
        project_id=project.project_id,
        revision=project.revision,
        kind="keycap_preview_mesh",
        path=preview_path,
        sha256=sha256_for_path(preview_path),
        content_type="model/gltf-binary",
        details={
            **details,
            "face_count": normalized.face_count_preview,
        },
    )
    register_artifact(
        db,
        artifact_id=f"{asset_id}_print",
        project_id=project.project_id,
        revision=project.revision,
        kind="keycap_print_mesh",
        path=export_path,
        sha256=sha256_for_path(export_path),
        content_type="model/stl",
        details={
            **details,
            "face_count": normalized.face_count_original,
            "bounding_box_mm": list(normalized.bounding_box_mm),
        },
    )

    prompt = None
    if job is not None:
        prompt = job.input_data.get("prompt_used") or job.input_data.get("prompt")
    prompt = prompt or project.style_request.prompt or project.style_request.preset

    asset = KeycapAsset(
        asset_id=asset_id,
        source="generated",
        provider="meshy",
        prompt=prompt,
        mesh_path=str(export_path),
        preview_mesh_path=str(preview_path),
        unit_sizes=[1.0],
        normalized=True,
        watertight=normalized.is_watertight,
        acceptance_state=AcceptanceState.CANDIDATE,
    )
    project.keycap_assets.append(asset)
    _sync_asset_registry_metadata(project)
    project.status = ProjectStatus.PREVIEWABLE
    await persist_project_metadata(db, row, project)
    return asset
