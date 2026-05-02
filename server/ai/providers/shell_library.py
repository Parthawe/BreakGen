"""Fallback shell-library provider used when remote generation is unavailable."""

from __future__ import annotations

import uuid

from server.ai.providers.base import (
    GenerateAssetRequest,
    ProviderGenerateResponse,
    ProviderPollResponse,
)
from server.models.platform import GenerationProviderManifest
from server.models.project import AcceptanceState, KeycapAsset


class ShellLibraryProvider:
    """Returns immediate placeholder assets for local and offline flows."""

    provider_id = "shell_library"

    def manifest(self) -> GenerationProviderManifest:
        return GenerationProviderManifest(
            id=self.provider_id,
            display_name="Shell Library",
            description="Immediate fallback provider that returns local placeholder keycap assets.",
            status="fallback",
            supported_asset_types=["keycap"],
            capabilities=["text_to_preview", "instant_placeholder"],
            default_for=["keycap"],
        )

    async def submit_keycap_generation(
        self,
        request: GenerateAssetRequest,
    ) -> ProviderGenerateResponse:
        assets: list[KeycapAsset] = []
        for _ in range(request.variant_count):
            assets.append(
                KeycapAsset(
                    asset_id=f"shell_{uuid.uuid4().hex[:8]}",
                    source="shell_library",
                    provider=self.provider_id,
                    prompt=request.prompt or request.preset,
                    mesh_path=None,
                    preview_mesh_path=None,
                    unit_sizes=[1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.75, 6.25],
                    normalized=True,
                    watertight=True,
                    acceptance_state=AcceptanceState.PREVIEW_ONLY,
                )
            )
        return ProviderGenerateResponse(
            provider_id=self.provider_id,
            status="completed",
            assets=assets,
            message="No remote provider configured. Using shell library placeholders.",
        )

    async def poll_keycap_generation(
        self,
        external_ref: str,
    ) -> ProviderPollResponse:
        return ProviderPollResponse(
            provider_id=self.provider_id,
            status="COMPLETED",
            progress=100,
            output_data={"external_ref": external_ref},
        )

    async def cancel_keycap_generation(self, external_ref: str) -> None:
        return None

    async def download_model(self, model_url: str, output_path: str) -> str:
        raise RuntimeError("Shell library assets do not expose downloadable meshes")
