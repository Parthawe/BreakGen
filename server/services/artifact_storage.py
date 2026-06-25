"""Artifact storage backend metadata and configuration helpers."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from server.config import settings


@dataclass(frozen=True)
class ArtifactStorageConfig:
    backend: str
    local_root: str
    public_base_url: str | None = None
    r2_endpoint_url: str | None = None
    r2_bucket: str | None = None


def artifact_storage_config() -> ArtifactStorageConfig:
    """Return the active artifact storage configuration without exposing secrets."""
    backend = settings.artifact_storage_backend.strip().lower()
    return ArtifactStorageConfig(
        backend=backend,
        local_root=settings.artifacts_dir,
        public_base_url=settings.artifact_storage_public_base_url or None,
        r2_endpoint_url=settings.r2_endpoint_url or None,
        r2_bucket=settings.r2_bucket or None,
    )


def artifact_storage_metadata(path: str | Path) -> dict:
    """Return registry-safe storage metadata for a stored artifact path."""
    config = artifact_storage_config()
    raw_path = Path(path)
    metadata = {
        "storage_backend": config.backend,
        "storage_location": "local_path" if config.backend == "local" else "object_key",
    }
    if config.backend == "local":
        try:
            metadata["storage_key"] = str(raw_path.resolve().relative_to(Path(config.local_root).resolve()))
        except ValueError:
            metadata["storage_key"] = raw_path.name
    else:
        metadata["storage_key"] = str(raw_path).replace("\\", "/")
        metadata["bucket"] = config.r2_bucket
    return metadata


def public_artifact_url(project_id: str, artifact_id: str) -> str | None:
    """Return an optional public URL only when explicitly configured."""
    config = artifact_storage_config()
    if not config.public_base_url:
        return None
    return f"{config.public_base_url.rstrip('/')}/projects/{project_id}/artifacts/{artifact_id}"
