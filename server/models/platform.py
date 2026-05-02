"""Platform-level manifest models for product families and generation providers."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from server.models.project import ProductDomain, ProductFamily


class ProductDomainManifest(BaseModel):
    """Top-level product domain used to group families in the app shell."""

    domain: ProductDomain
    display_name: str
    description: str
    enabled_families: list[ProductFamily] = Field(default_factory=list)
    status: Literal["enabled", "planned"] = Field(default="enabled")


class WorkspaceStageManifest(BaseModel):
    """A single workflow stage exposed by a product family workspace."""

    id: str
    label: str
    description: str
    requires_project: bool = Field(default=True)
    modules: list[str] = Field(default_factory=list)
    preview_mode: Literal["none", "3d"] = Field(default="none")


class ProductFamilyManifest(BaseModel):
    """Defines how a product family appears in the shared app shell."""

    domain: ProductDomain
    family: ProductFamily
    display_name: str
    description: str
    status: Literal["enabled", "planned"] = Field(default="enabled")
    stages: list[WorkspaceStageManifest] = Field(default_factory=list)
    required_inputs: list[str] = Field(default_factory=list)
    supported_capabilities: list[str] = Field(default_factory=list)
    available_templates: list[str] = Field(default_factory=list)
    editor_modules: list[str] = Field(default_factory=list)
    supported_module_types: list[str] = Field(default_factory=list)


class HardwareModuleManifest(BaseModel):
    """Reusable hardware module or shell feature manifest."""

    module_id: str
    module_type: str
    display_name: str
    description: str
    mechanical_constraints: dict = Field(default_factory=dict)
    electrical_constraints: dict = Field(default_factory=dict)
    mounting_requirements: dict = Field(default_factory=dict)
    supported_families: list[ProductFamily] = Field(default_factory=list)
    export_implications: list[str] = Field(default_factory=list)
    status: Literal["enabled", "planned"] = Field(default="enabled")


class GenerationProviderManifest(BaseModel):
    """Describes a generation provider that may be used by the platform."""

    id: str
    display_name: str
    description: str
    status: Literal["enabled", "fallback", "disabled", "planned"]
    feature_flag: str | None = None
    supported_asset_types: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    default_for: list[str] = Field(default_factory=list)
