# BreakGen Server

FastAPI backend for the BreakGen private-alpha product studio.

Current live product scope:

- `keyboard`
- `macropad`
- `streamdeck`
- `midi`
- `gamepad`

## Requirements

- Python 3.12+
- `uv`

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

Or:

```bash
make dev-server
```

## Seed a Reviewer Account

Private alpha is invite-only for this milestone. Seed a local reviewer account with an explicit password:

```bash
BREAKGEN_ALPHA_PASSWORD="replace-with-a-strong-local-password" make seed-alpha-user
```

## Generate a Reviewer Proof Bundle

From the repo root:

```bash
make demo-proof
```

This creates a deterministic Stream Deck project, compiles electronics and mechanical artifacts, runs validation, exports a ZIP bundle, and prints the bundle path plus SHA-256 provenance.

## API

API docs:

- [http://localhost:8000/docs](http://localhost:8000/docs)

### Auth

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Create account |
| `POST` | `/api/auth/login` | Log in |
| `GET` | `/api/auth/me` | Current authenticated user |

### Project lifecycle

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/projects/` | List project summaries |
| `POST` | `/api/projects/` | Create project |
| `GET` | `/api/projects/{id}` | Load canonical project state |
| `PATCH` | `/api/projects/{id}` | Save canonical mutations with optimistic locking |
| `DELETE` | `/api/projects/{id}` | Delete project and revision snapshots |

### Catalog and manifests

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/templates/` | List templates |
| `GET` | `/api/switches/` | List supported switches |
| `GET` | `/api/product-domains` | Product domain manifests |
| `GET` | `/api/product-families` | Product family manifests |
| `GET` | `/api/hardware-modules` | Hardware module manifests |
| `GET` | `/api/generation/providers` | Provider manifests |

### Compile and export

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/projects/{id}/compile/mechanical` | Compile family-aware mechanical outputs |
| `POST` | `/api/projects/{id}/compile/pcb` | Compile electronics metadata |
| `POST` | `/api/projects/{id}/validate` | Run validation |
| `POST` | `/api/projects/{id}/export` | Build and download export bundle |

### Firmware and mechanical artifacts

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/projects/{id}/firmware/info.json` | Firmware metadata |
| `GET` | `/api/projects/{id}/firmware/keymap.json` | Keyboard-oriented keymap metadata |
| `GET` | `/api/projects/{id}/firmware/via.json` | VIA metadata where applicable |
| `GET` | `/api/projects/{id}/firmware/control-map.json` | Family-native control mapping metadata |
| `GET` | `/api/projects/{id}/export/plate.dxf` | Legacy panel DXF path |
| `GET` | `/api/projects/{id}/export/mechanical/{artifact}` | Durable mechanical artifact download |

### Appearance generation and acceptance

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/projects/presets/keycap-styles` | Appearance style presets |
| `POST` | `/api/projects/{id}/generate-keycaps` | Submit appearance generation |
| `GET` | `/api/projects/{id}/generation-status/{task_id}` | Poll generation status |
| `POST` | `/api/projects/{id}/keycap-assets/{asset_id}/acceptance` | Accept or reject an asset |
| `POST` | `/api/projects/{id}/apply-keycap` | Apply accepted asset to controls |

### Provenance

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/projects/{id}/records` | Unified jobs, artifacts, validation, and export view |

## Architecture

Canonical mutations follow one contract:

- load current project row
- enforce optimistic locking through `expected_revision`
- mutate canonical project state
- bump revision
- persist current row
- write immutable revision snapshot

Derived work does **not** create canonical revisions automatically:

- validation
- export
- generation jobs
- mechanical compile summaries

Those instead produce durable artifacts and job records tied to the current revision.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `BREAKGEN_DEBUG` | `true` | Enable debug logging |
| `BREAKGEN_DATABASE_URL` | local sqlite in `server/` | Database connection string |
| `BREAKGEN_ARTIFACTS_DIR` | `server/artifacts` | Durable artifact storage |
| `BREAKGEN_TEMPLATES_DIR` | `server/templates` | Template directory |
| `BREAKGEN_JWT_SECRET` | development-only secret | JWT signing secret; required when `BREAKGEN_DEBUG=false` |
| `BREAKGEN_JWT_EXPIRE_HOURS` | `72` | JWT lifetime in hours |
| `BREAKGEN_MIN_PASSWORD_LENGTH` | `8` | Minimum signup password length |
| `BREAKGEN_PUBLIC_SIGNUP_ENABLED` | `false` | Signup switch; keep `false` for invite-only hosted alpha |
| `BREAKGEN_SIGNUP_INVITE_CODE` | empty | Required when production signup remains enabled |
| `BREAKGEN_MESHY_API_KEY` | empty | Meshy provider key |
| `BREAKGEN_MESHY_MODEL_DOWNLOAD_MAX_BYTES` | `67108864` | Maximum provider model download size |

## Notes

- Generation routes are lazy-loaded. If Meshy dependencies are unavailable, the API boots with generation disabled instead of crashing.
- Planned families may exist in manifests or proof infrastructure, but the authenticated alpha should stay focused on the five live control-surface families.
