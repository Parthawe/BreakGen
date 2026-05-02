"""Meshy-backed generation provider."""

from __future__ import annotations

from server.ai.meshy_client import MeshyClient
from server.ai.providers.base import (
    GenerateAssetRequest,
    ProviderGenerateResponse,
    ProviderJobSubmission,
    ProviderPollResponse,
)
from server.config import settings
from server.models.platform import GenerationProviderManifest


class MeshyGenerationProvider:
    """Wrap Meshy behind the provider contract used by the app."""

    provider_id = "meshy"

    def __init__(self, client: MeshyClient | None = None):
        self.client = client or MeshyClient()

    def manifest(self) -> GenerationProviderManifest:
        return GenerationProviderManifest(
            id=self.provider_id,
            display_name="Meshy",
            description="Primary remote text-to-3D provider for keycap generation.",
            status="enabled" if settings.meshy_api_key else "disabled",
            feature_flag="BREAKGEN_MESHY_API_KEY",
            supported_asset_types=["keycap"],
            capabilities=["text_to_3d", "async_jobs", "model_download"],
            default_for=["keycap"] if settings.meshy_api_key else [],
        )

    async def submit_keycap_generation(
        self,
        request: GenerateAssetRequest,
    ) -> ProviderGenerateResponse:
        jobs: list[ProviderJobSubmission] = []
        for idx in range(request.variant_count):
            task_id = await self.client.create_text_to_3d_task(
                prompt=request.positive_prompt,
                negative_prompt=request.negative_prompt,
            )
            jobs.append(
                ProviderJobSubmission(
                    external_ref=task_id,
                    variant_index=idx,
                    input_data={
                        "prompt": request.prompt,
                        "preset": request.preset,
                        "prompt_used": request.positive_prompt,
                        "negative_prompt": request.negative_prompt,
                        "variant_index": idx,
                    },
                )
            )
        return ProviderGenerateResponse(
            provider_id=self.provider_id,
            status="submitted",
            jobs=jobs,
        )

    async def poll_keycap_generation(
        self,
        external_ref: str,
    ) -> ProviderPollResponse:
        result = await self.client.get_task_status(external_ref)
        return ProviderPollResponse(
            provider_id=self.provider_id,
            status=result.get("status", "UNKNOWN"),
            progress=result.get("progress", 0),
            output_data=result,
        )

    async def cancel_keycap_generation(self, external_ref: str) -> None:
        return None

    async def download_model(self, model_url: str, output_path: str) -> str:
        return await self.client.download_model(model_url, output_path)
