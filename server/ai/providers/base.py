"""Provider contracts for generated asset backends."""

from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel, Field

from server.models.platform import GenerationProviderManifest
from server.models.project import KeycapAsset


class GenerateAssetRequest(BaseModel):
    """Normalized request shape passed into a generation provider."""

    prompt: str | None = None
    preset: str | None = None
    positive_prompt: str
    negative_prompt: str
    variant_count: int = Field(default=4, ge=1, le=8)


class ProviderJobSubmission(BaseModel):
    """A single provider-backed submitted job."""

    external_ref: str
    variant_index: int = Field(default=0, ge=0)
    input_data: dict = Field(default_factory=dict)


class ProviderGenerateResponse(BaseModel):
    """Submission result from a generation provider."""

    provider_id: str
    status: str
    jobs: list[ProviderJobSubmission] = Field(default_factory=list)
    assets: list[KeycapAsset] = Field(default_factory=list)
    message: str | None = None


class ProviderPollResponse(BaseModel):
    """Normalized provider poll result."""

    provider_id: str
    status: str
    progress: int | float | None = None
    output_data: dict = Field(default_factory=dict)


class GenerationProvider(Protocol):
    """Common contract implemented by concrete generation providers."""

    provider_id: str

    def manifest(self) -> GenerationProviderManifest: ...

    async def submit_keycap_generation(
        self,
        request: GenerateAssetRequest,
    ) -> ProviderGenerateResponse: ...

    async def poll_keycap_generation(
        self,
        external_ref: str,
    ) -> ProviderPollResponse: ...

    async def cancel_keycap_generation(self, external_ref: str) -> None: ...

    async def download_model(self, model_url: str, output_path: str) -> str: ...
