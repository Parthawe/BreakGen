"""Platform-level catalog endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from server.ai.providers import provider_registry
from server.models.project import ProductDomain, ProductFamily
from server.services.hardware_catalog import list_hardware_modules
from server.services.hardware_sources import (
    list_footprint_source_specs,
    list_hardware_sources,
)
from server.services.artifact_storage import artifact_storage_config
from server.services.platform_catalog import (
    list_technology_integrations,
    list_product_domain_manifests,
    list_product_family_manifests,
)

router = APIRouter(tags=["platform"])


@router.get("/api/product-domains")
async def get_product_domains():
    """Return product domains used to group families in the shared workspace."""
    return [manifest.model_dump(mode="json") for manifest in list_product_domain_manifests()]


@router.get("/api/product-families")
async def get_product_families(domain: str | None = None):
    """Return family manifests used by the shared client workspace."""
    manifests = list_product_family_manifests()
    if domain is not None:
        try:
            selected_domain = ProductDomain(domain)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Unknown product domain '{domain}'") from exc
        manifests = [manifest for manifest in manifests if manifest.domain == selected_domain]
    return [manifest.model_dump(mode="json") for manifest in manifests]


@router.get("/api/hardware-modules")
async def get_hardware_modules(
    family: str | None = None,
    domain: str | None = None,
):
    """Return reusable hardware modules, optionally filtered by family or domain."""
    try:
        selected_family = ProductFamily(family) if family else None
        selected_domain = ProductDomain(domain) if domain else None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Unknown platform filter") from exc
    return [
        manifest.model_dump(mode="json")
        for manifest in list_hardware_modules(family=selected_family, domain=selected_domain)
    ]


@router.get("/api/hardware-sources")
async def get_hardware_sources():
    """Return source references used to ground hardware and PCB decisions."""
    return [source.model_dump(mode="json") for source in list_hardware_sources()]


@router.get("/api/footprint-sources")
async def get_footprint_sources():
    """Return supported footprint IDs with library/source readiness metadata."""
    return [spec.model_dump(mode="json") for spec in list_footprint_source_specs()]


@router.get("/api/generation/providers")
async def get_generation_providers():
    """Return generation provider manifests and current availability."""
    return [manifest.model_dump(mode="json") for manifest in provider_registry.manifests()]


@router.get("/api/platform/integrations")
async def get_platform_integrations(
    category: str | None = None,
    status: str | None = None,
):
    """Return external technology, monetization, and software integration options."""
    return [
        manifest.model_dump(mode="json")
        for manifest in list_technology_integrations(category=category, status=status)
    ]


@router.get("/api/platform/storage")
async def get_platform_storage():
    """Return artifact storage mode without exposing storage credentials."""
    config = artifact_storage_config()
    return {
        "backend": config.backend,
        "status": "active" if config.backend == "local" else "configured",
        "local_root": config.local_root if config.backend == "local" else None,
        "bucket": config.r2_bucket if config.backend == "r2" else None,
        "public_base_url_configured": bool(config.public_base_url),
        "owner_scoped_downloads": True,
        "notes": (
            "Local filesystem artifact storage is suitable for private-alpha development only."
            if config.backend == "local"
            else "R2-compatible artifact storage is configured; downloads should still flow through owner-scoped registry APIs."
        ),
    }
