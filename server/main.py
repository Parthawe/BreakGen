"""BreakGen API server."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from server.api import auth, export, geometry, launch, pcb, platform, projects, records, switches, templates
from server.config import SERVER_DIR, settings
from server.db.database import engine
from server.db.models import Base

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="BreakGen",
    description="Creative and engineering platform for custom electronic products — API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS origins are environment-backed so hosted API deployments only trust
# the configured frontend origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if request.url.path not in {"/docs", "/redoc", "/openapi.json"}:
        response.headers.setdefault(
            "Content-Security-Policy",
            (
                "default-src 'self'; "
                "base-uri 'self'; "
                "frame-ancestors 'none'; "
                "img-src 'self' data: https:; "
                "style-src 'self' 'unsafe-inline'; "
                "script-src 'self'; "
                "connect-src 'self' http://localhost:5173 ws://localhost:5173"
            ),
        )
    return response


# Core routers — always available
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(templates.router)
app.include_router(switches.router)
app.include_router(geometry.router)
app.include_router(pcb.router)
app.include_router(export.router)
app.include_router(records.router)
app.include_router(platform.router)
app.include_router(launch.router)

# AI generation router — isolated so missing httpx/meshy deps don't crash the server
try:
    from server.api import generation
    app.include_router(generation.router)
except ImportError as e:
    logger.warning(f"AI generation routes disabled: {e}")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


# Serve built frontend in production (client/dist)
FRONTEND_DIR = SERVER_DIR.parent / "client" / "dist"


def _resolve_frontend_file(path: str) -> Path | None:
    """Resolve a requested SPA file while enforcing the frontend root."""
    root = FRONTEND_DIR.resolve()
    candidate = (root / path).resolve()
    if candidate != root and root not in candidate.parents:
        return None
    if candidate.exists() and candidate.is_file():
        return candidate
    return None


if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="static")

    @app.get("/{path:path}")
    async def serve_spa(request: Request, path: str):
        """SPA fallback: serve index.html for all non-API routes."""
        file_path = _resolve_frontend_file(path)
        if file_path is not None:
            return FileResponse(str(file_path))
        if ".." in Path(path).parts:
            raise HTTPException(status_code=404, detail="Not found")
        return FileResponse(str(FRONTEND_DIR / "index.html"))
