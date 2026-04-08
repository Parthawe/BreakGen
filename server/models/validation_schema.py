"""
Validation report models.

Spec reference: PRODUCT_SPEC.md sections 15.2–15.4
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class CheckStatus(str, Enum):
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"
    SKIPPED = "skipped"


class ValidationCheck(BaseModel):
    """A single validation check result."""

    id: str = Field(description="Check identifier (e.g. 'pcb_drc', 'keycap_wall_thickness')")
    category: str = Field(
        description="Check category: geometry, plate, pcb, firmware, export"
    )
    status: CheckStatus
    details: str = Field(default="")
    source: str = Field(
        default="digital",
        description="'digital' (automated check) or 'calibration' (empirical default)",
    )


class ValidationReport(BaseModel):
    """Complete validation report for a project revision."""

    report_id: str
    project_id: str
    revision: int
    status: CheckStatus = Field(description="Overall status (worst of all checks)")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    checks: list[ValidationCheck] = Field(default_factory=list)
    notes: Optional[str] = Field(default=None)
