"""BreakGen API server."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.api import auth, export, geometry, pcb, projects, switches, templates
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
    description="Keyboard intent compiler — API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for local development (Vite dev server on :5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Core routers — always available
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(templates.router)
app.include_router(switches.router)
app.include_router(geometry.router)
app.include_router(pcb.router)
app.include_router(export.router)

# AI generation router — isolated so missing httpx/meshy deps don't crash the server
try:
    from server.api import generation
    app.include_router(generation.router)
except ImportError as e:
    logger.warning(f"AI generation routes disabled: {e}")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
