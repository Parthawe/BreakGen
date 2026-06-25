# BreakGen Backend Architecture

BreakGen's backend should behave like a secure product compiler, not a loose CRUD API. The server owns canonical project state, revision history, derived artifacts, provider jobs, and all access control for user-owned work.

## Goals

- Keep `KeyboardProject` as the canonical project envelope across product families.
- Require authentication for every project-scoped read, mutation, compile, export, job, and artifact route.
- Scope project access by `projects.user_id`; cross-user access should look identical to a missing project.
- Route every spec-changing mutation through `load_project_state()` and `commit_project_mutation()`.
- Route metadata-only persistence through `persist_project_metadata()`.
- Register every durable output in `project_artifacts`.
- Register every provider-backed or long-running task in `project_jobs`.
- Keep secrets in environment-backed settings, never in route modules or source-controlled API clients.
- Avoid leaking server filesystem paths, provider secrets, or internal storage layout in API payloads.

## Backend Layers

### API Routers

- `auth`: signup, login, current user, token verification.
- `projects`: user-owned project lifecycle, optimistic locking, canonical mutations.
- `templates`, `switches`, `platform`: public read-only catalogs and manifests.
- `geometry`: mechanical panel/shell compiles and mechanical artifact downloads.
- `pcb`: electronics compile and firmware/control-map metadata.
- `generation`: provider-backed appearance generation, job polling, asset acceptance.
- `export`: validation and export bundle creation.
- `records`: provenance view over project artifacts and jobs.

### Services

- `project_state`: central project load, ownership filtering, revision persistence, metadata persistence, derived-state invalidation.
- `artifact_registry`: durable file storage, hashes, artifact lineage, latest-artifact lookup.
- `job_registry`: durable job rows, provider status updates, terminal-state handling.
- Provider registry and domain compilers should stay behind service boundaries; routes should not encode provider-specific secrets or lifecycle rules.

### Persistence

- `users`: account identity and password hashes.
- `projects`: latest canonical project row, including `user_id`.
- `project_revisions`: immutable snapshots for every committed spec mutation.
- `project_artifacts`: durable generated outputs tied to project revision and producer metadata.
- `project_jobs`: async/provider work tied to project revision and provider references.

## Access Model

Public routes:

- `/api/health`
- `/api/auth/signup`
- `/api/auth/login`
- `/api/templates/*`
- `/api/switches/*`
- `/api/product-domains`
- `/api/product-families`
- `/api/hardware-modules`
- `/api/generation/providers`
- `/api/projects/presets/keycap-styles`

Authenticated project-scoped routes:

- `/api/projects/`
- `/api/projects/{project_id}`
- `/api/projects/{project_id}/compile/*`
- `/api/projects/{project_id}/firmware/*`
- `/api/projects/{project_id}/validate`
- `/api/projects/{project_id}/export`
- `/api/projects/{project_id}/records`
- `/api/projects/{project_id}/artifacts`
- `/api/projects/{project_id}/jobs`
- `/api/projects/{project_id}/generate-keycaps`
- `/api/projects/{project_id}/generation-*`
- `/api/projects/{project_id}/keycap-assets/*`
- `/api/projects/{project_id}/apply-keycap`

## Security Rules

- JWT signing secret must come from `BREAKGEN_JWT_SECRET`; the development default is only acceptable while `BREAKGEN_DEBUG=true`.
- Production startup must fail if debug is disabled and the JWT secret remains the development default.
- Password policy belongs in settings and should be enforced consistently by signup and seed tooling.
- Hosted private-alpha signup must be disabled or invite-code gated through settings.
- Emails should be normalized before lookup and persistence.
- Project-scoped routes must call `require_user` and pass the user id into the central state loader.
- Artifact APIs should expose artifact ids, hashes, content type, lineage, and download URLs, but not local server paths.
- Template and artifact lookup should use catalog-validated identifiers and registry rows rather than arbitrary client-provided paths.
- Provider asset downloads must enforce HTTPS, public-network destinations, model content types, and byte limits before writing files.
- CORS should be environment-configurable before deployment beyond localhost.

## Implementation Sequence

1. Move auth secrets and token settings into `server/config.py`.
2. Add ownership-aware project loading and creation in `server/services/project_state.py`.
3. Require auth on project-scoped routers and pass `owner_user_id` through central project loading.
4. Filter project lists by `user_id` and set `user_id` when creating projects.
5. Redact internal artifact paths from records responses while retaining server-side access for validation report loading.
6. Delete project revisions, artifacts, and jobs together with the project row.
7. Add tests for project ownership persistence, owner loads, and cross-user denial.
8. Add route-level unauthorized and cross-user API tests around the FastAPI app.
9. Make CORS and deployment security settings environment-driven.
10. Add artifact download endpoints for registered artifact ids instead of exposing storage paths.
