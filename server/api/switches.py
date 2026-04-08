"""Switch catalog endpoints."""

from fastapi import APIRouter

from server.models.supported_configs import SUPPORTED_SWITCHES

router = APIRouter(prefix="/api/switches", tags=["switches"])


@router.get("/")
async def list_switches():
    """Return all supported switches."""
    return [s.model_dump() for s in SUPPORTED_SWITCHES]
