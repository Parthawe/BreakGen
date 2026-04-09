# BreakGen Server

FastAPI backend for the BreakGen keyboard design platform.

## Requirements

- Python 3.12+
- uv (package manager)

## Setup

```bash
cd server
python3 -m uv sync
```

## Running

From the repo root:

```bash
PYTHONPATH=. python3 -m uv run --directory server uvicorn server.main:app --reload --port 8000
```

Or use the Makefile:

```bash
make dev-server
```

## API

Once running, API docs are at http://localhost:8000/docs

### Core endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/templates/ | List layout templates |
| GET | /api/switches/ | List supported switches |
| POST | /api/projects/ | Create project (from template) |
| GET | /api/projects/{id} | Get project |
| PATCH | /api/projects/{id} | Update project (bumps revision) |
| DELETE | /api/projects/{id} | Delete project + revisions |

### Geometry

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/projects/{id}/compile/plate | Compile plate metadata |
| GET | /api/projects/{id}/export/plate.dxf | Download plate DXF |

### AI Generation

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/projects/presets/keycap-styles | List style presets |
| POST | /api/projects/{id}/generate-keycaps | Generate keycap variants |
| POST | /api/projects/{id}/apply-keycap | Apply keycap to keys |

### PCB + Firmware

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/projects/{id}/compile/pcb | Compile matrix + firmware |
| GET | /api/projects/{id}/firmware/info.json | QMK keyboard definition |
| GET | /api/projects/{id}/firmware/keymap.json | Default QWERTY keymap |
| GET | /api/projects/{id}/firmware/via.json | VIA keyboard definition |

### Validation + Export

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/projects/{id}/validate | Run validation checks |
| POST | /api/projects/{id}/export | Download export bundle ZIP |

## Architecture

Every stateful mutation follows one contract: validate inputs, mutate canonical `KeyboardProject`, bump revision, update `ProjectRow`, insert `ProjectRevisionRow`, commit.

The AI generation router is lazy-loaded. If `httpx` or Meshy dependencies are unavailable, the server boots normally with generation routes disabled.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| BREAKGEN_DEBUG | true | Enable debug logging |
| BREAKGEN_DATABASE_URL | sqlite (server dir) | Database connection string |
| BREAKGEN_ARTIFACTS_DIR | server/artifacts | Generated artifact storage |
| BREAKGEN_TEMPLATES_DIR | server/templates | Layout template directory |
| BREAKGEN_MESHY_API_KEY | (empty) | Meshy AI API key for keycap generation |
