"""Template listing and loading endpoints."""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from server.config import settings
from server.models.project import LayoutSpec
from server.models.supported_configs import SUPPORTED_TEMPLATES

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("/")
async def list_templates():
    """Return available layout templates."""
    return [
        {
            "template_id": t.template_id,
            "name": t.name,
            "description": t.description,
            "key_count": t.key_count,
        }
        for t in SUPPORTED_TEMPLATES
    ]


@router.get("/{template_id}")
async def get_template(template_id: str):
    """Return full template data including validated key layout."""
    template = next(
        (t for t in SUPPORTED_TEMPLATES if t.template_id == template_id), None
    )
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    template_path = Path(settings.templates_dir) / f"{template_id}.json"
    if not template_path.exists():
        raise HTTPException(status_code=404, detail="Template file not found")

    with open(template_path) as f:
        data = json.load(f)

    # Validate layout against schema before serving
    try:
        layout_data = data.get("layout", {})
        LayoutSpec(**layout_data)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Template '{template_id}' has invalid layout: {e}",
        )

    return data
