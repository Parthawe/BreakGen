# BreakGen Server

FastAPI backend for the BreakGen private-alpha product studio.

Current live product scope:

- `keyboard`: safest path
- `macropad` and `streamdeck`: alpha paths
- `midi` and `gamepad`: proof paths

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

Local debug startup creates missing SQLite tables for convenience. Hosted
production startup does not create or mutate schema automatically; run Alembic
migrations before starting the API:

```bash
cd server
BREAKGEN_DATABASE_URL="postgresql+asyncpg://user:password@host:5432/breakgen" \
  uv run alembic -c ../alembic.ini upgrade head
```

Production must use `BREAKGEN_DEBUG=false`, a non-default JWT secret, and a
non-SQLite async database URL. If the database is not at the Alembic head,
startup fails before serving traffic.

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
| `GET` | `/api/platform/integrations` | Technology, monetization, storage, CAD/EDA, and fabrication manifests |
| `GET` | `/api/platform/storage` | Artifact storage mode without secrets |

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
| `GET` | `/api/projects/{id}/usage` | Owner-scoped usage and billing-intent telemetry |
| `POST` | `/api/projects/{id}/billing-intent` | Record pricing interest without enabling billing |

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
Usage events are additive telemetry rows used for activation and pricing research;
they do not mutate canonical project state.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `BREAKGEN_DEBUG` | `true` | Enable debug logging |
| `BREAKGEN_DATABASE_URL` | local sqlite in `server/` | Database connection string. Production must use `postgresql+asyncpg://...` and must be migrated with Alembic before startup. |
| `BREAKGEN_ARTIFACTS_DIR` | `server/artifacts` | Durable artifact storage |
| `BREAKGEN_ARTIFACT_STORAGE_BACKEND` | `local` | Artifact storage backend. Use `local` for development or `r2` for Cloudflare R2/S3-compatible object storage. |
| `BREAKGEN_ARTIFACT_STORAGE_PUBLIC_BASE_URL` | empty | Optional public artifact URL base; leave empty for owner-scoped API downloads |
| `BREAKGEN_R2_ENDPOINT_URL` | empty | Cloudflare R2/S3-compatible endpoint URL. Required when `BREAKGEN_ARTIFACT_STORAGE_BACKEND=r2`. |
| `BREAKGEN_R2_BUCKET` | empty | R2 bucket name. Required when `BREAKGEN_ARTIFACT_STORAGE_BACKEND=r2`. |
| `BREAKGEN_R2_ACCESS_KEY_ID` | empty | R2 access key from deployment secrets. Required when `BREAKGEN_ARTIFACT_STORAGE_BACKEND=r2`. |
| `BREAKGEN_R2_SECRET_ACCESS_KEY` | empty | R2 secret key from deployment secrets. Required when `BREAKGEN_ARTIFACT_STORAGE_BACKEND=r2`. |
| `BREAKGEN_TEMPLATES_DIR` | `server/templates` | Template directory |
| `BREAKGEN_JWT_SECRET` | development-only secret | JWT signing secret; required when `BREAKGEN_DEBUG=false` |
| `BREAKGEN_JWT_EXPIRE_HOURS` | `72` | JWT lifetime in hours |
| `BREAKGEN_MIN_PASSWORD_LENGTH` | `8` | Minimum signup password length |
| `BREAKGEN_PUBLIC_SIGNUP_ENABLED` | `false` | Signup switch; keep `false` for invite-only hosted alpha |
| `BREAKGEN_SIGNUP_INVITE_CODE` | empty | Required when production signup remains enabled |
| `BREAKGEN_TRUSTED_CLIENT_IP_HEADER` | empty | Platform-set client IP header to trust for rate-limit identity, for example `Fly-Client-IP`; set only when the platform strips inbound copies |
| `BREAKGEN_TRUSTED_PROXY_HOSTS` | empty | Comma-separated proxy socket hosts whose `X-Forwarded-For` headers may be trusted for rate-limit identity |
| `BREAKGEN_MAX_REQUEST_BODY_BYTES` | `2097152` | Maximum accepted HTTP request body size before returning `413` |
| `BREAKGEN_AUTH_RATE_LIMIT_PER_MINUTE` | `20` | Per-client login/signup throttle for alpha abuse control |
| `BREAKGEN_GENERATION_RATE_LIMIT_PER_MINUTE` | `8` | Per-user generation-submit throttle |
| `BREAKGEN_COMPILE_RATE_LIMIT_PER_MINUTE` | `12` | Per-user compile throttle for PCB/mechanical routes |
| `BREAKGEN_VALIDATION_RATE_LIMIT_PER_MINUTE` | `20` | Per-user validation throttle |
| `BREAKGEN_EXPORT_RATE_LIMIT_PER_MINUTE` | `6` | Per-user export throttle |
| `BREAKGEN_FREE_GENERATION_JOBS_PER_PROJECT` | `20` | Private-alpha generation job limit per project before operator intervention |
| `BREAKGEN_FREE_EXPORT_BUNDLES_PER_PROJECT` | `10` | Private-alpha export bundle limit per project before operator intervention |
| `BREAKGEN_GOOGLE_OAUTH_CLIENT_ID` | empty | Google OAuth client ID; exposed only as configured state until OAuth callbacks are implemented |
| `BREAKGEN_GOOGLE_OAUTH_CLIENT_SECRET` | empty | Google OAuth client secret; must be set with the Google client ID |
| `BREAKGEN_APPLE_OAUTH_CLIENT_ID` | empty | Apple Services ID for Sign in with Apple; exposed only as configured state until OAuth callbacks are implemented |
| `BREAKGEN_APPLE_OAUTH_TEAM_ID` | empty | Apple team ID; must be set with all Apple OAuth fields |
| `BREAKGEN_APPLE_OAUTH_KEY_ID` | empty | Apple private key ID; must be set with all Apple OAuth fields |
| `BREAKGEN_APPLE_OAUTH_PRIVATE_KEY` | empty | Apple private key from deployment secrets; never commit a real key |
| `BREAKGEN_MESHY_API_KEY` | empty | Meshy provider key |
| `BREAKGEN_MESHY_MODEL_DOWNLOAD_MAX_BYTES` | `67108864` | Maximum provider model download size |

## Notes

- Generation routes are lazy-loaded. If Meshy dependencies are unavailable, the API boots with generation disabled instead of crashing.
- Planned families may exist in manifests or proof infrastructure, but the authenticated alpha should stay focused on the tiered control-surface paths: keyboard as the safest path, macro pad and stream deck as alpha paths, and MIDI/gamepad as proof paths.
