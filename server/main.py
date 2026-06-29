"""BreakGen API server."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from server.api import auth, export, geometry, launch, pcb, platform, projects, records, switches, templates
from server.config import SERVER_DIR, settings
from server.db.database import engine
from server.db.migrations import assert_database_migrated
from server.db.models import Base
from server.services.observability import (
    configure_observability,
    request_observability_middleware,
)

configure_observability()
logger = logging.getLogger(__name__)


class RequestBodyTooLarge(Exception):
    pass


class RequestBodyLimitMiddleware:
    """Reject HTTP request bodies above the configured byte ceiling."""

    def __init__(self, app, max_body_bytes: int):
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        content_length = headers.get(b"content-length")
        if content_length is not None:
            try:
                if int(content_length.decode("ascii")) > self.max_body_bytes:
                    await JSONResponse(
                        status_code=413,
                        content={"detail": "Request body too large"},
                    )(scope, receive, send)
                    return
            except ValueError:
                pass

        received = 0
        response_started = False

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_body_bytes:
                    raise RequestBodyTooLarge
            return message

        async def tracking_send(message):
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except RequestBodyTooLarge:
            if response_started:
                raise
            await JSONResponse(
                status_code=413,
                content={"detail": "Request body too large"},
            )(scope, receive, send)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.debug:
        # Local dev/test convenience only. Production must run Alembic first.
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    else:
        await assert_database_migrated(engine)
    yield


app = FastAPI(
    title="BreakGen",
    description="Creative and engineering platform for custom electronic products — API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    RequestBodyLimitMiddleware,
    max_body_bytes=settings.max_request_body_bytes,
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


def _is_local_origin(origin: str) -> bool:
    return origin.startswith(("http://localhost", "https://localhost", "http://127.0.0.1", "https://127.0.0.1"))


def _websocket_origin(origin: str) -> str | None:
    if origin.startswith("https://"):
        return f"wss://{origin.removeprefix('https://')}"
    if origin.startswith("http://"):
        return f"ws://{origin.removeprefix('http://')}"
    return None


def content_security_policy() -> str:
    """Return a deployment-aware CSP for API-served responses."""
    connect_sources = ["'self'"]
    for origin in settings.cors_origin_list:
        if settings.debug or not _is_local_origin(origin):
            connect_sources.append(origin)
            websocket = _websocket_origin(origin)
            if websocket and settings.debug:
                connect_sources.append(websocket)
    if settings.debug:
        connect_sources.extend(["http://localhost:5173", "ws://localhost:5173"])

    deduped_connect_sources = list(dict.fromkeys(connect_sources))
    return (
        "default-src 'self'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'; "
        "img-src 'self' data: https:; "
        "style-src 'self' 'unsafe-inline'; "
        "script-src 'self'; "
        f"connect-src {' '.join(deduped_connect_sources)}"
    )


@app.middleware("http")
async def observability(request: Request, call_next):
    return await request_observability_middleware(request, call_next)


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
            content_security_policy(),
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


async def _check_database() -> None:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))


async def _dependency_health_payload() -> tuple[int, dict]:
    checks: dict[str, str] = {}
    status_code = 200
    try:
        await _check_database()
        checks["database"] = "ok"
    except Exception:
        logger.exception("Database health check failed")
        checks["database"] = "unavailable"
        status_code = 503

    return status_code, {
        "status": "ok" if status_code == 200 else "unhealthy",
        "version": "0.1.0",
        "checks": checks,
    }


@app.get("/api/health")
async def health():
    status_code, payload = await _dependency_health_payload()
    return JSONResponse(status_code=status_code, content=payload)


@app.get("/api/readiness")
async def readiness():
    status_code, payload = await _dependency_health_payload()
    return JSONResponse(status_code=status_code, content=payload)


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
