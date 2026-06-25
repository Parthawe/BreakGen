"""
Meshy AI API client for text-to-3D keycap generation.

Handles task submission, polling, and asset download.
Spec reference: [R1] https://docs.meshy.ai/api/text-to-3d
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import socket
from enum import Enum
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import httpx

from server.config import settings

logger = logging.getLogger(__name__)

MESHY_BASE = settings.meshy_api_url
ALLOWED_MODEL_DOWNLOAD_SUFFIXES = {".glb", ".gltf", ".obj", ".fbx", ".usdz", ".stl"}
ALLOWED_MODEL_CONTENT_TYPES = {
    "application/octet-stream",
    "binary/octet-stream",
    "model/gltf-binary",
    "model/gltf+json",
    "model/obj",
    "model/vnd.usdz+zip",
    "text/plain",
}


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"


class MeshyError(Exception):
    """Raised when the Meshy API returns an error."""
    pass


def _is_public_address(host: str) -> bool:
    """Return whether host resolves only to public, routable addresses."""
    try:
        addresses = [ipaddress.ip_address(host)]
    except ValueError:
        try:
            infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
        except socket.gaierror as exc:
            raise MeshyError(f"Cannot resolve model download host: {host}") from exc
        addresses = []
        for info in infos:
            address = info[4][0]
            try:
                addresses.append(ipaddress.ip_address(address))
            except ValueError:
                raise MeshyError(f"Unexpected model download address: {address}")

    if not addresses:
        raise MeshyError(f"Cannot resolve model download host: {host}")

    return all(
        address.is_global
        and not address.is_loopback
        and not address.is_link_local
        and not address.is_multicast
        and not address.is_private
        and not address.is_reserved
        for address in addresses
    )


def validate_model_download_url(model_url: str) -> None:
    """Validate a provider-supplied model URL before any egress request."""
    parsed = urlparse(model_url)
    if parsed.scheme != "https":
        raise MeshyError("Model downloads must use https URLs")
    if not parsed.hostname:
        raise MeshyError("Model download URL is missing a host")
    if parsed.username or parsed.password:
        raise MeshyError("Model download URL must not include credentials")

    suffix = Path(parsed.path).suffix.lower()
    if suffix and suffix not in ALLOWED_MODEL_DOWNLOAD_SUFFIXES:
        raise MeshyError(f"Unsupported model download suffix: {suffix}")

    if not _is_public_address(parsed.hostname):
        raise MeshyError("Model download host must resolve to a public address")


def validate_model_download_headers(headers: httpx.Headers, *, max_bytes: int) -> None:
    """Validate response metadata before streaming a generated model."""
    content_length = headers.get("content-length")
    if content_length:
        try:
            size = int(content_length)
        except ValueError as exc:
            raise MeshyError("Invalid model download Content-Length") from exc
        if size > max_bytes:
            raise MeshyError(f"Model download exceeds {max_bytes} bytes")

    content_type = (headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    if content_type and content_type not in ALLOWED_MODEL_CONTENT_TYPES and not content_type.startswith("model/"):
        raise MeshyError(f"Unsupported model download content type: {content_type}")


class MeshyClient:
    """Async client for the Meshy text-to-3D API."""

    def __init__(self, api_key: str | None = None, download_transport: httpx.AsyncBaseTransport | None = None):
        self.api_key = api_key or settings.meshy_api_key
        self.download_transport = download_transport
        if not self.api_key:
            logger.warning("No Meshy API key configured. Generation will fail.")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def create_text_to_3d_task(
        self,
        prompt: str,
        art_style: str = "realistic",
        negative_prompt: str = "",
        topology: str = "triangle",
        target_polycount: int = 30000,
    ) -> str:
        """
        Submit a text-to-3D generation task.
        Returns the task_id for polling.
        """
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{MESHY_BASE}/openapi/v2/text-to-3d",
                headers=self._headers(),
                json={
                    "mode": "preview",
                    "prompt": prompt,
                    "art_style": art_style,
                    "negative_prompt": negative_prompt,
                    "topology": topology,
                    "target_polycount": target_polycount,
                },
            )

        if resp.status_code != 200 and resp.status_code != 202:
            raise MeshyError(f"Meshy API error {resp.status_code}: {resp.text}")

        data = resp.json()
        task_id = data.get("result")
        if not task_id:
            raise MeshyError(f"No task_id in response: {data}")

        logger.info(f"Meshy task created: {task_id}")
        return task_id

    async def get_task_status(self, task_id: str) -> dict:
        """Get the current status and result of a generation task."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{MESHY_BASE}/openapi/v2/text-to-3d/{task_id}",
                headers=self._headers(),
            )

        if resp.status_code != 200:
            raise MeshyError(f"Meshy API error {resp.status_code}: {resp.text}")

        return resp.json()

    async def poll_until_complete(
        self,
        task_id: str,
        poll_interval: float = 5.0,
        max_wait: float = 180.0,
    ) -> dict:
        """
        Poll a task until it completes or times out.
        Returns the full task result including model URLs.
        """
        elapsed = 0.0
        while elapsed < max_wait:
            result = await self.get_task_status(task_id)
            status = result.get("status", "UNKNOWN")

            if status == TaskStatus.SUCCEEDED:
                logger.info(f"Meshy task {task_id} succeeded")
                return result
            elif status == TaskStatus.FAILED:
                raise MeshyError(f"Meshy task {task_id} failed: {result.get('message', 'unknown error')}")
            elif status == TaskStatus.EXPIRED:
                raise MeshyError(f"Meshy task {task_id} expired")

            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

        raise MeshyError(f"Meshy task {task_id} timed out after {max_wait}s")

    async def download_model(self, model_url: str, output_path: str) -> str:
        """Download a generated model file (GLB/OBJ) to disk."""
        validate_model_download_url(model_url)

        max_bytes = settings.meshy_model_download_max_bytes
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        bytes_written = 0
        client_kwargs: dict = {"timeout": 60, "follow_redirects": False}
        if self.download_transport is not None:
            client_kwargs["transport"] = self.download_transport

        try:
            async with httpx.AsyncClient(**client_kwargs) as client:
                async with client.stream("GET", model_url) as resp:
                    if resp.status_code != 200:
                        raise MeshyError(f"Failed to download model: {resp.status_code}")
                    validate_model_download_headers(resp.headers, max_bytes=max_bytes)

                    with open(output, "wb") as f:
                        async for chunk in resp.aiter_bytes():
                            bytes_written += len(chunk)
                            if bytes_written > max_bytes:
                                raise MeshyError(f"Model download exceeds {max_bytes} bytes")
                            f.write(chunk)
        except Exception:
            output.unlink(missing_ok=True)
            raise

        logger.info(f"Model downloaded to {output_path} ({bytes_written} bytes)")
        return output_path
