"""Template listing and loading endpoints."""

import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from server.config import settings
from server.models.project import LayoutSpec, ProductDomain
from server.models.supported_configs import SUPPORTED_TEMPLATES

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("/")
async def list_templates(
    family: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
):
    """Return available layout templates, optionally filtered by product family."""
    templates = SUPPORTED_TEMPLATES
    if family:
        templates = [t for t in templates if t.product_family.value == family]
    if domain:
        try:
            selected_domain = ProductDomain(domain)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Unknown product domain: {domain}") from exc
        templates = [t for t in templates if t.resolved_domain == selected_domain]

    return [
        {
            "template_id": t.template_id,
            "name": t.name,
            "description": t.description,
            "key_count": t.key_count,
            "product_domain": t.resolved_domain.value,
            "product_family": t.product_family.value,
        }
        for t in templates
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

    try:
        layout_data = data.get("layout", {})
        LayoutSpec(**layout_data)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Template '{template_id}' has invalid layout: {e}",
        )

    data["product_family"] = template.product_family.value
    data["product_domain"] = template.resolved_domain.value
    return data
