# BreakGen API and Job Contracts

> Documentation-only contract proposal for the current backend stage.

This document describes the thinnest serious backend surface that fits the current codebase and product spec.

## Goals

- expose the canonical `KeyboardProject` model cleanly
- avoid blocking requests on long-running work
- make revision and validation visible from the start
- keep the contract narrow enough to implement quickly

## API Shape

Recommended base path:

```text
/api/v1
```

## Core Resources

| Resource | Purpose |
| --- | --- |
| `/projects` | Create, list, fetch, and update canonical project records |
| `/projects/{project_id}/validate` | Trigger or perform validation on a project revision |
| `/projects/{project_id}/export` | Request export bundle generation |
| `/jobs/{job_id}` | Poll status of long-running operations |
| `/health` | Process and dependency health |

## Project Endpoints

### `POST /api/v1/projects`

Create a new project.

Request body:

```json
{
  "name": "My 65 Prototype",
  "template": "65_percent"
}
```

Response:

```json
{
  "project": {
    "project_id": "bg_01",
    "revision": 1,
    "status": "draft"
  }
}
```

### `GET /api/v1/projects`

List projects with lightweight summaries.

Suggested summary fields:

- `project_id`
- `name`
- `status`
- `template`
- `revision`
- `updated_at`

### `GET /api/v1/projects/{project_id}`

Fetch the full canonical project.

Response shape should match `KeyboardProject` closely. Avoid introducing a second nearly-identical DTO unless there is a strong reason.

### `PATCH /api/v1/projects/{project_id}`

Apply partial updates to the canonical project.

Important behavior:

- server owns revision increment
- server updates `updated_at`
- server invalidates stale validation/export state when relevant fields change

Suggested patchable sections:

- `name`
- `template`
- `layout`
- `switch_profile`
- `style_request`
- `pcb`

### `POST /api/v1/projects/{project_id}/validate`

Trigger validation for the latest revision.

Response options:

- synchronous for lightweight structural checks in early phases
- asynchronous once geometry and PCB checks are added

Preferred response:

```json
{
  "job_id": "job_validate_01",
  "status": "queued"
}
```

### `POST /api/v1/projects/{project_id}/export`

Request export bundle generation for a validated revision.

Guardrails:

- reject if project is not valid enough for export
- record which revision is being exported

## Job Model

Long-running work should not be hidden inside regular API handlers.

### Job Types

| Job type | Purpose |
| --- | --- |
| `validate_project` | Run structural, geometry, or PCB validation |
| `generate_keycap_style` | Call provider and ingest returned asset metadata |
| `normalize_keycap_asset` | Repair and normalize raw mesh output |
| `compile_pcb` | Derive matrix, emit KiCad project, run DRC |
| `export_bundle` | Assemble final package and manifest |

### Suggested Job Status Values

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`

### `GET /api/v1/jobs/{job_id}`

Suggested response:

```json
{
  "job_id": "job_validate_01",
  "job_type": "validate_project",
  "status": "running",
  "project_id": "bg_01",
  "revision": 3,
  "progress": 0.4,
  "message": "Running structural validation",
  "created_at": "2026-04-07T18:00:00Z",
  "updated_at": "2026-04-07T18:00:02Z"
}
```

## Persistence Boundaries

Even before full SQLAlchemy implementation exists, the architecture should preserve these boundaries:

| Concern | Store |
| --- | --- |
| Canonical project record | Database |
| Revisions or snapshots | Database |
| Binary artifacts | Filesystem or object store |
| Validation reports | Database, optionally mirrored into bundle |
| Export manifests | Database + object store |
| Job status | Database |

## Revision Rules

The backend should own revision semantics.

Revision should increment on:

- layout changes
- switch profile changes
- style request changes
- keycap asset assignment changes
- PCB parameter changes

Revision should not increment on:

- read operations
- health checks
- polling a job

## Validation Response Contract

Even a minimal validation result should already be structured.

Suggested shape:

```json
{
  "report_id": "vr_01",
  "project_id": "bg_01",
  "revision": 3,
  "status": "warn",
  "checks": [
    {
      "id": "layout_duplicate_key_ids",
      "status": "pass",
      "details": "All key ids are unique."
    },
    {
      "id": "layout_stabilizer_requirements",
      "status": "warn",
      "details": "Spacebar width requires stabilizer metadata."
    }
  ]
}
```

## Early Validation Categories

These can be implemented before any mesh or PCB compiler exists:

- project completeness
- supported template and switch family
- key uniqueness
- valid key dimensions
- stabilizer requirements
- row/column assignment consistency if present

## Recommended Sequence

Implement in this order:

1. `GET /health`
2. `POST /projects`
3. `GET /projects/{id}`
4. `PATCH /projects/{id}`
5. synchronous structural `validate`
6. asynchronous job table and `/jobs/{id}`
7. async validation/export flows

That path is narrow, realistic, and aligned with the current repo.
