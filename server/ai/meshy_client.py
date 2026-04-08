"""
Meshy AI API client for text-to-3D keycap generation.

Handles task submission, polling, and asset download.
Spec reference: [R1] https://docs.meshy.ai/api/text-to-3d
"""

from __future__ import annotations

import asyncio
import logging
from enum import Enum
from typing import Optional

import httpx

from server.config import settings

logger = logging.getLogger(__name__)

MESHY_BASE = settings.meshy_api_url


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"


class MeshyError(Exception):
    """Raised when the Meshy API returns an error."""
    pass


class MeshyClient:
    """Async client for the Meshy text-to-3D API."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.meshy_api_key
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
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(model_url)

        if resp.status_code != 200:
            raise MeshyError(f"Failed to download model: {resp.status_code}")

        with open(output_path, "wb") as f:
            f.write(resp.content)

        logger.info(f"Model downloaded to {output_path} ({len(resp.content)} bytes)")
        return output_path
