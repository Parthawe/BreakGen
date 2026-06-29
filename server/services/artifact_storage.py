"""Artifact storage backend helpers.

The registry stores durable artifact references, not raw server paths. Local
storage keeps today's path behavior. R2 uses the S3-compatible API and stores
object keys in artifact rows so downloads survive container restarts.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import shutil

from server.config import settings


@dataclass(frozen=True)
class ArtifactStorageConfig:
    backend: str
    local_root: str
    public_base_url: str | None = None
    r2_endpoint_url: str | None = None
    r2_bucket: str | None = None


@dataclass(frozen=True)
class StoredArtifact:
    """Reference to a persisted artifact."""

    path: str
    backend: str
    storage_key: str


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


def _artifact_root() -> Path:
    return Path(settings.artifacts_dir).resolve()


def _object_key_for_path(path: str | Path, *, project_id: str) -> str:
    """Return the stable object key for a local artifact source path."""
    raw_path = Path(path)
    try:
        return raw_path.resolve().relative_to(_artifact_root()).as_posix()
    except ValueError:
        return f"projects/{project_id}/artifacts/{raw_path.name}"


def _s3_client():
    """Create a boto3 client lazily so local installs do not initialize S3."""
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
    )


def store_artifact_file(
    path: str | Path,
    *,
    project_id: str,
    content_type: str | None = None,
) -> StoredArtifact:
    """Persist a local artifact source and return the durable reference."""
    config = artifact_storage_config()
    source_path = Path(path)
    if config.backend == "local":
        return StoredArtifact(
            path=str(source_path),
            backend="local",
            storage_key=artifact_storage_metadata(source_path)["storage_key"],
        )

    if not config.r2_bucket:
        raise RuntimeError("R2 artifact storage is missing a bucket")

    object_key = _object_key_for_path(source_path, project_id=project_id)
    extra_args = {"ContentType": content_type} if content_type else None
    client = _s3_client()
    if extra_args:
        client.upload_file(str(source_path), config.r2_bucket, object_key, ExtraArgs=extra_args)
    else:
        client.upload_file(str(source_path), config.r2_bucket, object_key)
    return StoredArtifact(path=object_key, backend="r2", storage_key=object_key)


def artifact_exists(path: str | Path) -> bool:
    """Return whether an artifact reference is currently readable."""
    config = artifact_storage_config()
    if config.backend == "local":
        local_path = Path(path)
        return local_path.exists() and local_path.is_file()

    if not config.r2_bucket:
        return False
    try:
        _s3_client().head_object(Bucket=config.r2_bucket, Key=str(path).replace("\\", "/"))
    except Exception:
        return False
    return True


def read_artifact_bytes(path: str | Path) -> bytes:
    """Read artifact bytes from the configured backend."""
    config = artifact_storage_config()
    if config.backend == "local":
        return Path(path).read_bytes()

    if not config.r2_bucket:
        raise FileNotFoundError("R2 artifact storage is missing a bucket")
    response = _s3_client().get_object(
        Bucket=config.r2_bucket,
        Key=str(path).replace("\\", "/"),
    )
    body = response["Body"]
    try:
        return body.read()
    finally:
        close = getattr(body, "close", None)
        if close:
            close()


def iter_artifact_bytes(path: str | Path, *, chunk_size: int = 1024 * 1024):
    """Yield artifact bytes without loading the whole object into memory."""
    config = artifact_storage_config()
    if config.backend == "local":
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(chunk_size), b""):
                yield chunk
        return

    if not config.r2_bucket:
        raise FileNotFoundError("R2 artifact storage is missing a bucket")
    response = _s3_client().get_object(
        Bucket=config.r2_bucket,
        Key=str(path).replace("\\", "/"),
    )
    body = response["Body"]
    try:
        for chunk in body.iter_chunks(chunk_size=chunk_size):
            if chunk:
                yield chunk
    finally:
        close = getattr(body, "close", None)
        if close:
            close()


def delete_project_artifacts(
    project_id: str,
    *,
    base_dir: str | Path | None = None,
) -> None:
    """Delete all artifact files or objects owned by a project."""
    config = artifact_storage_config()
    if config.backend == "local":
        root = Path(base_dir or settings.artifacts_dir).resolve()
        target = (root / "projects" / project_id).resolve()
        if root not in target.parents:
            raise ValueError("Refusing to delete artifact path outside artifact root")
        shutil.rmtree(target, ignore_errors=True)
        return

    if not config.r2_bucket:
        raise RuntimeError("R2 artifact storage is missing a bucket")

    client = _s3_client()
    prefix = f"projects/{project_id}/"
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=config.r2_bucket, Prefix=prefix):
        objects = [{"Key": item["Key"]} for item in page.get("Contents", [])]
        if objects:
            client.delete_objects(Bucket=config.r2_bucket, Delete={"Objects": objects})


def artifact_storage_metadata(path: str | Path) -> dict:
    """Return registry-safe storage metadata for a stored artifact path."""
    config = artifact_storage_config()
    metadata = {
        "storage_backend": config.backend,
        "storage_location": "local_path" if config.backend == "local" else "object_key",
    }
    if config.backend == "local":
        raw_path = Path(path)
        try:
            metadata["storage_key"] = raw_path.resolve().relative_to(Path(config.local_root).resolve()).as_posix()
        except ValueError:
            metadata["storage_key"] = raw_path.name
    else:
        metadata["storage_key"] = str(path).replace("\\", "/")
        metadata["bucket"] = config.r2_bucket
    return metadata


def public_artifact_url(project_id: str, artifact_id: str) -> str | None:
    """Return an optional public URL only when explicitly configured."""
    config = artifact_storage_config()
    if not config.public_base_url:
        return None
    return f"{config.public_base_url.rstrip('/')}/projects/{project_id}/artifacts/{artifact_id}"
