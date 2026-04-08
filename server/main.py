"""BreakGen API server."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.api import geometry, projects, switches, templates
from server.db.database import engine
from server.db.models import Base


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
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(projects.router)
app.include_router(templates.router)
app.include_router(switches.router)
app.include_router(geometry.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
