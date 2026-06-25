"""Provider-backed keycap generation endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.auth import require_user, user_scope_id
from server.config import settings
from server.ai.meshy_client import MeshyError
from server.ai.providers.base import GenerateAssetRequest
from server.ai.providers.registry import provider_registry
from server.ai.prompt_wrapper import get_available_presets, wrap_prompt
from server.db.database import get_db
from server.db.models import UserRow
from server.models.project import (
    AcceptanceState,
    ElementType,
    LayoutSpec,
    ProjectStatus,
)
from server.services.keycap_ingestion import (
    KeycapIngestionError,
    ingest_completed_keycap_generation,
)
from server.services.job_registry import (
    create_project_job,
    get_project_job_by_external_ref,
    is_terminal_job_status,
    list_project_jobs,
    update_job_by_external_ref,
)
from server.services.project_state import (
    commit_project_mutation,
    invalidate_derived_state,
    load_project_state,
    persist_project_metadata,
)
from server.services.usage_registry import record_usage_event, usage_total

router = APIRouter(prefix="/api/projects", tags=["generation"])


class GenerateKeycapsRequest(BaseModel):
    prompt: Optional[str] = None
    preset: Optional[str] = None
    variant_count: int = Field(default=4, ge=1, le=8)
    provider: Optional[str] = None


class GenerationJobRequest(GenerateKeycapsRequest):
    asset_type: str = "keycap"


class ApplyKeycapRequest(BaseModel):
    asset_id: str
    expected_revision: int
    element_ids: list[str] | None = None
    key_ids: list[str] | None = None  # Deprecated compatibility alias


class UpdateKeycapAssetRequest(BaseModel):
    acceptance_state: AcceptanceState
    expected_revision: int | None = None


_CANONICAL_ASSET_STATES = {
    AcceptanceState.ACCEPTED,
    AcceptanceState.PRODUCTION_READY,
}
_MANUAL_ASSET_STATES = {
    AcceptanceState.ACCEPTED,
    AcceptanceState.REJECTED,
    AcceptanceState.PRODUCTION_READY,
}


def _sync_asset_registry_metadata(project) -> None:
    accepted_asset_ids = [
        asset.asset_id
        for asset in project.keycap_assets
        if asset.acceptance_state in _CANONICAL_ASSET_STATES
    ]
    project.assets["accepted_asset_ids"] = accepted_asset_ids
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


def _find_keycap_asset(project, asset_id: str):
    asset = next((item for item in project.keycap_assets if item.asset_id == asset_id), None)
    if asset is None:
        raise HTTPException(
            status_code=400,
            detail=f"Asset '{asset_id}' not found in project keycap_assets",
        )
    return asset


def _asset_is_applied(project, asset_id: str) -> bool:
    return any(
        element.keycap_asset_id == asset_id or element.appearance_ref == asset_id
        for element in project.layout.elements
    )


def _sync_layout_keys_from_elements(project) -> None:
    project.layout = LayoutSpec(
        unit_pitch_mm=project.layout.unit_pitch_mm,
        elements=[element.model_dump(mode="json") for element in project.layout.elements],
    )


async def _reconcile_generation_project_status(
    db: AsyncSession,
    row,
    project_id: str,
    owner_user_id: int | None = None,
) -> str | None:
    """Recompute project status from current generation jobs and assets."""
    _, project = await load_project_state(
        db,
        project_id,
        owner_user_id=owner_user_id,
    )
    generation_jobs = [
        job for job in await list_project_jobs(db, project_id)
        if job.job_type == "keycap_generation"
    ]
    if not generation_jobs:
        return None

    if project.keycap_assets:
        desired = ProjectStatus.PREVIEWABLE
    elif any(not is_terminal_job_status(job.status) for job in generation_jobs):
        desired = ProjectStatus.GENERATING
    else:
        desired = ProjectStatus.CONFIGURED

    if project.status != desired:
        project.status = desired
        await persist_project_metadata(db, row, project)
    return desired.value


def _build_generate_request_payload(
    req: GenerateKeycapsRequest,
    *,
    positive_prompt: str,
    negative_prompt: str,
) -> GenerateAssetRequest:
    return GenerateAssetRequest(
        prompt=req.prompt,
        preset=req.preset,
        positive_prompt=positive_prompt,
        negative_prompt=negative_prompt,
        variant_count=req.variant_count,
    )


async def _submit_keycap_generation_request(
    project_id: str,
    req: GenerateKeycapsRequest,
    db: AsyncSession,
    owner_user_id: int | None = None,
):
    row, project = await load_project_state(
        db,
        project_id,
        owner_user_id=owner_user_id,
    )

    if not req.prompt and not req.preset:
        raise HTTPException(status_code=400, detail="Provide prompt or preset")
    generation_jobs_used = await usage_total(
        db,
        event_type="generation_submitted",
        user_id=owner_user_id,
        project_id=project_id,
    )
    if generation_jobs_used + req.variant_count > settings.free_generation_jobs_per_project:
        raise HTTPException(
            status_code=403,
            detail=(
                "Free alpha generation limit reached for this project. "
                "Use fewer variants, record pricing interest, or contact the operator for a higher limit."
            ),
        )

    positive_prompt, negative_prompt = wrap_prompt(req.prompt, req.preset)
    current_revision = project.revision
    preferred_provider = req.provider
    if preferred_provider is None:
        stored_provider = project.style_request.provider
        default_provider = provider_registry.default_keycap_provider_id()
        if stored_provider and not (stored_provider == "meshy" and default_provider != "meshy"):
            preferred_provider = stored_provider
    provider = provider_registry.resolve_submit_provider(preferred_provider)

    try:
        submission = await provider.submit_keycap_generation(
            _build_generate_request_payload(
                req,
                positive_prompt=positive_prompt,
                negative_prompt=negative_prompt,
            )
        )
    except MeshyError as e:
        raise HTTPException(status_code=502, detail=f"Provider API error: {e}") from e

    project.style_request.provider = submission.provider_id
    project.style_request.prompt = req.prompt
    project.style_request.preset = req.preset
    project.style_request.variant_count = req.variant_count

    if submission.status == "completed":
        project.keycap_assets.extend(submission.assets)
        _sync_asset_registry_metadata(project)
        project.status = ProjectStatus.PREVIEWABLE
        job = create_project_job(
            db,
            project_id=project.project_id,
            revision=current_revision,
            job_type="keycap_generation",
            status="completed",
            provider=submission.provider_id,
            input_data={
                "prompt": req.prompt,
                "preset": req.preset,
                "variant_count": req.variant_count,
                "provider": submission.provider_id,
            },
            output_data={"asset_ids": [asset.asset_id for asset in submission.assets]},
        )
        record_usage_event(
            db,
            event_type="generation_completed",
            user_id=owner_user_id,
            project_id=project.project_id,
            revision=current_revision,
            provider=submission.provider_id,
            quantity=len(submission.assets),
            unit="asset",
            metadata={
                "job_id": job.job_id,
                "asset_type": "keycap",
                "preset": req.preset,
            },
        )
        await persist_project_metadata(
            db,
            row,
            project,
        )
        return {
            "status": "completed",
            "message": submission.message,
            "provider": submission.provider_id,
            "job_id": job.job_id,
            "revision": project.revision,
            "prompt_used": positive_prompt,
            "variants": [asset.model_dump() for asset in submission.assets],
        }

    project.status = ProjectStatus.GENERATING
    job_ids: list[str] = []
    task_ids: list[str] = []
    for provider_job in submission.jobs:
        job = create_project_job(
            db,
            project_id=project.project_id,
            revision=current_revision,
            job_type="keycap_generation",
            status="submitted",
            provider=submission.provider_id,
            external_ref=provider_job.external_ref,
            input_data=provider_job.input_data,
        )
        job_ids.append(job.job_id)
        task_ids.append(provider_job.external_ref)

    record_usage_event(
        db,
        event_type="generation_submitted",
        user_id=owner_user_id,
        project_id=project.project_id,
        revision=current_revision,
        provider=submission.provider_id,
        quantity=len(submission.jobs),
        unit="job",
        metadata={
            "asset_type": "keycap",
            "preset": req.preset,
            "variant_count": req.variant_count,
        },
    )
    await persist_project_metadata(
        db,
        row,
        project,
    )
    return {
        "status": "generating",
        "provider": submission.provider_id,
        "job_ids": job_ids,
        "task_ids": task_ids,
        "revision": project.revision,
        "prompt_used": positive_prompt,
        "variant_count": len(submission.jobs),
    }


@router.get("/presets/keycap-styles")
async def list_keycap_presets():
    """Return available keycap style presets."""
    return get_available_presets()


@router.post("/{project_id}/generate-keycaps")
async def generate_keycaps(
    project_id: str,
    req: GenerateKeycapsRequest,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Submit a provider-backed keycap generation request."""
    return await _submit_keycap_generation_request(
        project_id,
        req,
        db,
        owner_user_id=user_scope_id(user),
    )


@router.post("/{project_id}/generation/jobs")
async def create_generation_job(
    project_id: str,
    req: GenerationJobRequest,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Submit a provider-backed generation job through the platform contract."""
    if req.asset_type != "keycap":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported asset type '{req.asset_type}'",
        )
    return await _submit_keycap_generation_request(
        project_id,
        req,
        db,
        owner_user_id=user_scope_id(user),
    )


@router.get("/{project_id}/generation-status/{task_id}")
async def get_generation_status(
    project_id: str,
    task_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Check status of a provider-backed generation task."""
    owner_user_id = user_scope_id(user)
    row, project = await load_project_state(
        db,
        project_id,
        owner_user_id=owner_user_id,
    )
    job = await get_project_job_by_external_ref(db, project_id, task_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Generation task '{task_id}' not found")

    if is_terminal_job_status(job.status):
        project_status = await _reconcile_generation_project_status(
            db,
            row,
            project_id,
            owner_user_id=owner_user_id,
        )
        payload = {
            "status": job.status.upper(),
            "progress": job.output_data.get("progress", 100 if job.status == "completed" else 0),
            "model_urls": job.output_data.get("model_urls", {}),
            "provider": job.provider,
        }
        if project_status is not None:
            payload["project_status"] = project_status
        asset_id = job.output_data.get("asset_id")
        if asset_id:
            asset = next((item for item in project.keycap_assets if item.asset_id == asset_id), None)
            if asset is not None:
                payload["asset"] = asset.model_dump()
        await db.commit()
        return payload

    provider = provider_registry.require(
        job.provider or provider_registry.default_keycap_provider_id()
    )
    try:
        result = await provider.poll_keycap_generation(task_id)
        status = result.status

        asset = None
        if status == "SUCCEEDED":
            try:
                asset = await ingest_completed_keycap_generation(
                    db,
                    row,
                    project,
                    task_id=task_id,
                    result=result.output_data,
                    client=provider,
                )
            except KeycapIngestionError as exc:
                await update_job_by_external_ref(
                    db,
                    project_id=project_id,
                    external_ref=task_id,
                    status="FAILED",
                    output_data={**result.output_data, "ingestion_error": str(exc)},
                )
                await db.commit()
                raise HTTPException(
                    status_code=500,
                    detail=f"Mesh ingestion failed for task {task_id}: {exc}",
                ) from exc

        await update_job_by_external_ref(
            db,
            project_id=project_id,
            external_ref=task_id,
            status=status,
            output_data={
                **result.output_data,
                **(
                    {"asset_id": asset.asset_id, "preview_mesh_path": asset.preview_mesh_path}
                    if asset is not None
                    else {}
                ),
            },
        )
        if asset is not None:
            record_usage_event(
                db,
                event_type="generation_completed",
                user_id=owner_user_id,
                project_id=project.project_id,
                revision=project.revision,
                provider=provider.provider_id,
                quantity=1,
                unit="asset",
                metadata={
                    "asset_type": "keycap",
                    "asset_id": asset.asset_id,
                    "external_ref": task_id,
                },
            )
        project_status = await _reconcile_generation_project_status(
            db,
            row,
            project_id,
            owner_user_id=owner_user_id,
        )
        await db.commit()
        payload = {
            "status": status,
            "progress": result.progress or 0,
            "model_urls": result.output_data.get("model_urls", {}),
            "provider": provider.provider_id,
        }
        if project_status is not None:
            payload["project_status"] = project_status
        if asset is not None:
            payload["asset"] = asset.model_dump()
        return payload
    except MeshyError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/{project_id}/apply-keycap")
async def apply_keycap(
    project_id: str,
    req: ApplyKeycapRequest,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Assign a keycap asset to keys in the project. Bumps revision."""
    row, project = await load_project_state(
        db,
        project_id,
        expected_revision=req.expected_revision,
        owner_user_id=user_scope_id(user),
    )
    asset = _find_keycap_asset(project, req.asset_id)
    if asset.acceptance_state not in _CANONICAL_ASSET_STATES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Asset '{req.asset_id}' is {asset.acceptance_state.value}. "
                "Accept it before applying it to the canonical layout."
            ),
        )

    target_ids = set(req.element_ids or req.key_ids or [])
    applied_count = 0
    for element in project.layout.elements:
        if element.element_type not in {ElementType.KEY_SWITCH, ElementType.BUTTON}:
            continue
        if target_ids and element.id not in target_ids:
            continue
        if element.keycap_asset_id != req.asset_id or element.appearance_ref != req.asset_id:
            element.keycap_asset_id = req.asset_id
            element.appearance_ref = req.asset_id
            applied_count += 1

    if applied_count == 0:
        raise HTTPException(
            status_code=400,
            detail="No compatible layout elements matched this apply request",
        )

    _sync_layout_keys_from_elements(project)
    invalidate_derived_state(project)
    await commit_project_mutation(
        db,
        row,
        project,
        change_summary=f"Applied keycap asset {req.asset_id} to {applied_count} controls",
        expected_revision=req.expected_revision,
    )

    return {
        "applied_to": applied_count,
        "asset_id": req.asset_id,
        "revision": project.revision,
    }


@router.post("/{project_id}/keycap-assets/{asset_id}/acceptance")
async def update_keycap_asset_acceptance(
    project_id: str,
    asset_id: str,
    req: UpdateKeycapAssetRequest,
    db: AsyncSession = Depends(get_db),
    user: UserRow = Depends(require_user),
):
    """Update asset acceptance state with revision-safe semantics."""
    if req.acceptance_state not in _MANUAL_ASSET_STATES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Manual asset updates only support accepted, rejected, "
                "or production_ready states"
            ),
        )

    row, project = await load_project_state(
        db,
        project_id,
        expected_revision=req.expected_revision,
        owner_user_id=user_scope_id(user),
    )
    asset = _find_keycap_asset(project, asset_id)
    if asset.acceptance_state == req.acceptance_state:
        return {
            "asset_id": asset.asset_id,
            "acceptance_state": asset.acceptance_state.value,
            "revision": project.revision,
        }

    asset_is_applied = _asset_is_applied(project, asset_id)
    current_state = asset.acceptance_state
    next_state = req.acceptance_state
    touches_canonical_state = (
        current_state in _CANONICAL_ASSET_STATES
        or next_state in _CANONICAL_ASSET_STATES
        or asset_is_applied
    )
    if touches_canonical_state and req.expected_revision is None:
        raise HTTPException(
            status_code=400,
            detail="expected_revision is required for canonical asset state changes",
        )

    if next_state == AcceptanceState.REJECTED and asset_is_applied:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Asset '{asset_id}' is applied to the layout. "
                "Reassign or clear it before rejecting it."
            ),
        )

    asset.acceptance_state = next_state
    _sync_asset_registry_metadata(project)

    if touches_canonical_state:
        invalidate_derived_state(project)
        await commit_project_mutation(
            db,
            row,
            project,
            change_summary=(
                f"Marked keycap asset {asset_id} as {next_state.value}"
            ),
            expected_revision=req.expected_revision,
        )
    else:
        await persist_project_metadata(db, row, project)

    return {
        "asset_id": asset.asset_id,
        "acceptance_state": asset.acceptance_state.value,
        "revision": project.revision,
    }
