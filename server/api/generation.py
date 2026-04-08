"""AI keycap generation endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.ai.meshy_client import MeshyClient, MeshyError
from server.ai.prompt_wrapper import get_available_presets, wrap_prompt
from server.config import settings
from server.db.database import get_db
from server.db.models import ProjectRevisionRow, ProjectRow
from server.models.project import KeyboardProject, KeycapAsset

router = APIRouter(prefix="/api/projects", tags=["generation"])


class GenerateKeycapsRequest(BaseModel):
    prompt: Optional[str] = None
    preset: Optional[str] = None
    variant_count: int = 4


class ApplyKeycapRequest(BaseModel):
    asset_id: str
    key_ids: list[str] | None = None  # None = apply to all keys


@router.get("/presets/keycap-styles")
async def list_keycap_presets():
    """Return available keycap style presets."""
    return get_available_presets()


@router.post("/{project_id}/generate-keycaps")
async def generate_keycaps(
    project_id: str,
    req: GenerateKeycapsRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a keycap generation job.

    If no Meshy API key is configured, returns a stub response with
    shell-library assets so the rest of the flow can be tested.
    """
    result = await db.execute(
        select(ProjectRow).where(ProjectRow.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    if not req.prompt and not req.preset:
        raise HTTPException(status_code=400, detail="Provide prompt or preset")

    positive_prompt, negative_prompt = wrap_prompt(req.prompt, req.preset)

    # If no API key, return placeholder assets
    if not settings.meshy_api_key:
        assets = []
        for i in range(req.variant_count):
            asset_id = f"shell_{uuid.uuid4().hex[:8]}"
            assets.append(
                KeycapAsset(
                    asset_id=asset_id,
                    source="shell_library",
                    provider=None,
                    prompt=req.prompt or req.preset,
                    mesh_path=None,
                    preview_mesh_path=None,
                    unit_sizes=[1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.75, 6.25],
                    normalized=True,
                    watertight=True,
                ).model_dump()
            )
        return {
            "status": "completed",
            "message": "No Meshy API key configured. Using shell library placeholders.",
            "prompt_used": positive_prompt,
            "variants": assets,
        }

    # Real Meshy generation
    client = MeshyClient()
    task_ids = []
    for i in range(req.variant_count):
        try:
            task_id = await client.create_text_to_3d_task(
                prompt=positive_prompt,
                negative_prompt=negative_prompt,
            )
            task_ids.append(task_id)
        except MeshyError as e:
            raise HTTPException(status_code=502, detail=f"Meshy API error: {e}")

    return {
        "status": "generating",
        "task_ids": task_ids,
        "prompt_used": positive_prompt,
        "variant_count": len(task_ids),
    }


@router.get("/{project_id}/generation-status/{task_id}")
async def get_generation_status(
    project_id: str,
    task_id: str,
):
    """Check status of a Meshy generation task."""
    if not settings.meshy_api_key:
        return {"status": "completed", "message": "Stub mode — no Meshy API key"}

    client = MeshyClient()
    try:
        result = await client.get_task_status(task_id)
        return {
            "status": result.get("status", "UNKNOWN"),
            "progress": result.get("progress", 0),
            "model_urls": result.get("model_urls", {}),
        }
    except MeshyError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/{project_id}/apply-keycap")
async def apply_keycap(
    project_id: str,
    req: ApplyKeycapRequest,
    db: AsyncSession = Depends(get_db),
):
    """Assign a keycap asset to keys in the project. Bumps revision."""
    result = await db.execute(
        select(ProjectRow).where(ProjectRow.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    project = KeyboardProject(**row.data)

    # Validate asset_id exists in the project's keycap_assets list
    # (shell_library assets are auto-valid as they start with "shell_")
    known_ids = {a.asset_id for a in project.keycap_assets}
    if not req.asset_id.startswith("shell_") and req.asset_id not in known_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Asset '{req.asset_id}' not found in project keycap_assets",
        )

    # Apply asset to specified keys or all keys
    applied_count = 0
    for key in project.layout.keys:
        if req.key_ids is None or key.id in req.key_ids:
            key.keycap_asset_id = req.asset_id
            applied_count += 1

    # Bump revision
    now = datetime.now(timezone.utc)
    project.revision += 1
    project.updated_at = now

    project_dict = project.model_dump(mode="json")
    row.revision = project.revision
    row.data = project_dict
    row.updated_at = now

    db.add(ProjectRevisionRow(
        project_id=project_id,
        revision=project.revision,
        data=project_dict,
        created_at=now,
        change_summary=f"Applied keycap asset {req.asset_id} to {applied_count} keys",
    ))

    await db.commit()

    return {
        "applied_to": applied_count,
        "asset_id": req.asset_id,
        "revision": project.revision,
    }
