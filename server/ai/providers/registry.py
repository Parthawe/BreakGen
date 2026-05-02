"""Provider registry and manifest helpers."""

from __future__ import annotations

from fastapi import HTTPException

from server.ai.providers.base import GenerationProvider
from server.ai.providers.meshy import MeshyGenerationProvider
from server.ai.providers.shell_library import ShellLibraryProvider
from server.config import settings
from server.models.platform import GenerationProviderManifest


def _planned_provider_manifests() -> list[GenerationProviderManifest]:
    return [
        GenerationProviderManifest(
            id="tripo",
            display_name="Tripo",
            description="Planned secondary 3D generation provider behind a feature flag.",
            status="planned",
            feature_flag="BREAKGEN_ENABLE_TRIPO",
            supported_asset_types=["keycap"],
            capabilities=["text_to_3d", "image_to_3d", "async_jobs"],
        ),
        GenerationProviderManifest(
            id="hyper3d_rodin",
            display_name="Hyper3D Rodin",
            description="Planned tertiary provider once the provider contract is stable.",
            status="planned",
            feature_flag="BREAKGEN_ENABLE_HYPER3D",
            supported_asset_types=["keycap"],
            capabilities=["text_to_3d", "multiview_to_3d", "async_jobs"],
        ),
    ]


class GenerationProviderRegistry:
    """Resolve live providers and expose a stable manifest view."""

    def __init__(self):
        self._providers: dict[str, GenerationProvider] = {
            "meshy": MeshyGenerationProvider(),
            "shell_library": ShellLibraryProvider(),
        }

    def manifests(self) -> list[GenerationProviderManifest]:
        manifests = [provider.manifest() for provider in self._providers.values()]
        return manifests + _planned_provider_manifests()

    def get(self, provider_id: str) -> GenerationProvider | None:
        return self._providers.get(provider_id)

    def require(self, provider_id: str) -> GenerationProvider:
        provider = self.get(provider_id)
        if provider is None:
            raise HTTPException(status_code=400, detail=f"Unknown provider '{provider_id}'")
        manifest = provider.manifest()
        if manifest.status == "disabled":
            raise HTTPException(
                status_code=400,
                detail=f"Provider '{provider_id}' is unavailable in this environment",
            )
        return provider

    def default_keycap_provider_id(self) -> str:
        return "meshy" if settings.meshy_api_key else "shell_library"

    def resolve_submit_provider(self, requested_provider: str | None) -> GenerationProvider:
        provider_id = requested_provider or self.default_keycap_provider_id()
        if provider_id == "meshy" and not settings.meshy_api_key and requested_provider is None:
            provider_id = "shell_library"
        return self.require(provider_id)


provider_registry = GenerationProviderRegistry()
