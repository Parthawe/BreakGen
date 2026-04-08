"""
Export manifest models.

Spec reference: PRODUCT_SPEC.md section 15.2, Appendix A
"""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class ArtifactEntry(BaseModel):
    """A single artifact in the export bundle."""

    path: str = Field(description="Relative path within the bundle")
    sha256: str = Field(description="SHA-256 hash of the file")
    category: str = Field(
        description="Artifact category: keycap, plate, pcb, firmware, doc"
    )


class ToolchainVersions(BaseModel):
    """Records versions of all tools used to produce the bundle."""

    breakgen: str = Field(default="0.1.0")
    meshy_api: str = Field(default="latest")
    kicad: str = Field(default="")
    qmk_schema: str = Field(default="")


class ExportManifest(BaseModel):
    """
    Manifest for an export bundle.

    Every export records exactly which project revision, toolchain versions,
    and validation state produced it.

    Spec reference: Appendix A
    """

    bundle_id: str
    project_id: str
    revision: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    toolchain: ToolchainVersions = Field(default_factory=ToolchainVersions)
    artifacts: list[ArtifactEntry] = Field(default_factory=list)
    validation_report_id: str = Field(default="")
