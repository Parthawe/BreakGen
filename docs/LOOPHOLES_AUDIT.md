# BreakGen Loopholes Audit

> Broad architecture and implementation audit focused on loopholes, claim gaps, hidden drift, and places where the current product story is ahead of the current system.

Date: April 8, 2026
Scope: current `client/`, `server/`, README/spec claims, and the new Phase 2/3 server surfaces

## Reading Guide

This document separates issues into four classes:

- `Runtime break`: code can fail or behave incorrectly right now
- `State integrity gap`: canonical project data can drift or become misleading
- `Claim gap`: the product says more than the code actually guarantees
- `Platform constraint`: current architecture choices will make expansion harder later

The point is not to criticize the current stage. The point is to prevent the build from accumulating hidden debt while the product narrative gets stronger.

## 1. Runtime Breaks

### 1.1 API startup depends on dev-only `httpx`

Current state:

- `server.main` imports the generation router unconditionally
- the generation router imports `MeshyClient`
- `MeshyClient` imports `httpx`
- `httpx` is only declared under `[project.optional-dependencies].dev`

Why this matters:

- the whole API can fail to import even when the user never touches generation
- optional product features should not take down the base server

Reality:

- this is a real startup break in the current server environment

### 1.2 Generation route hard-couples startup to Meshy client availability

Current state:

- the server has no lazy-loading or optional import boundary around AI generation
- the stub mode for missing Meshy API key exists, but the import still requires the client module and its dependencies

Why this matters:

- "stub mode" sounds resilient, but startup still depends on AI path readiness

## 2. Canonical State Integrity Gaps

### 2.1 Revision discipline is no longer universal

The strongest architectural decision in BreakGen is that `KeyboardProject` is the canonical source of truth and all downstream artifacts are derived from a specific revision.

That rule is already being broken in multiple places.

#### PCB compile mutates persisted project data without revision semantics

Current behavior:

- matrix row/col assignments are written into layout keys
- PCB matrix dimensions are written into `project.pcb`
- `row.data` is updated and committed
- no revision increment occurs
- no revision snapshot is inserted

Impact:

- persisted project data changes while `project.revision` stays the same
- artifacts can no longer be trusted to correspond to a unique revision

#### Keycap apply mutates persisted project data without revision semantics

Current behavior:

- keycap asset ids are written onto keys
- the project row is committed directly
- no revision increment occurs
- no snapshot is created

Impact:

- the project history cannot explain why keycap assignments changed

#### Validation and export results are not part of canonical project state

Current behavior:

- validation returns a report but does not update project status or export state
- export returns a ZIP but does not persist `bundle_id`, `bundle_path`, or `validation_report_id`

Impact:

- users can receive exports that are invisible to the canonical project record
- the project cannot answer basic questions like:
  - What was the last validated revision?
  - Which bundle belongs to this revision?
  - What validation report justified that export?

### 2.2 Side-door mutations are multiplying

The current codebase now has multiple direct mutation paths:

- project CRUD updates
- PCB compile updates
- keycap apply updates

Only the CRUD path currently respects revision and history rules. That is the exact kind of drift that eventually produces untraceable bugs.

### 2.3 Client does not consume authoritative server truth after save

Current behavior:

- client `save()` sends a patch
- returned `KeyboardProject` is ignored
- local store just flips `dirty` to false

Impact:

- local `revision`, `status`, and timestamps can go stale
- client is not actually aligned with the backend’s optimistic locking model

## 3. Asset Integrity Gaps

### 3.1 Keycap asset registry is not actually authoritative

The model has `project.keycap_assets`, which implies a registry of valid keycap assets attached to the project.

Current behavior:

- generated stub variants are returned to the caller
- they are not persisted into `project.keycap_assets`
- `apply-keycap` accepts any arbitrary `asset_id`

Impact:

- `keycap_asset_id` can point to an asset that does not exist anywhere in canonical state
- the project model cannot be audited reliably

### 3.2 Artifact derivation is not consistently recorded

Current behavior:

- export manifest is created at bundle time
- generated firmware files and plate DXF exist in the ZIP
- none of those artifact paths are written back into canonical project state

Impact:

- the project model and the downloaded artifact world are separate systems

## 4. Claim Gaps

These are not necessarily bugs. They are places where the language of the product or module docstrings is ahead of what the code actually does.

### 4.1 "AI keycap pipeline" is still mostly aspirational

Claim surface:

- prompt wrapping
- generation
- normalization
- repair
- watertight validation
- usable keycap assets

Actual implementation:

- prompt wrapping exists
- Meshy task submission exists
- status polling exists
- stub placeholder generation exists
- no end-to-end download -> normalize -> persist asset -> apply asset flow exists

Gap:

- the system can start generation, but it does not yet turn that into durable project assets

### 4.2 Mesh normalization docstring overstates what the code does

Claimed in the file:

- orientation alignment
- consistent Z-up
- stem cavity insertion
- full normalization pipeline

Actually implemented:

- scale normalization
- centroid/bottom alignment
- watertight check + simple repair attempt
- preview decimation
- export of preview and STL

Not implemented:

- explicit orientation inference/alignment
- Cherry stem cavity creation
- unit-size-aware shell integration
- wall thickness validation

### 4.3 Export bundle is described as fabrication-ready in a broader sense than it currently is

Current export contents:

- plate DXF
- firmware JSON files
- validation report
- manifest
- build guide

Missing from the broader product promise:

- Gerbers
- drill files
- BOM
- actual PCB fabrication output
- case geometry
- keycap meshes from generation flow

The current bundle is useful, but not yet the "full fabrication package" implied by the broader product story.

### 4.4 VIA compatibility is overstated

The code claims the generated VIA definition is compatible, but the current `via.json` only includes layout rectangles.

What is missing for a real claim:

- the exact structure VIA expects for layouts and matrix mapping
- confidence that the output can be dropped into VIA tooling without manual intervention

### 4.5 Plate geometry claims are ahead of actual geometry fidelity

Claimed:

- rounded corners
- MX cutout details tied to spec
- configurable kerf compensation

Actual output:

- outer board outline is still a plain rectangle
- cutouts are plain rotated rectangles
- kerf compensation is applied to cutouts, but the overall board outline is not truly parameterized to manufacturing behavior

### 4.6 Validation sounds stronger than it currently is

The validation model and language are strong, but current checks are still basic:

- nonempty layout
- axis-aligned overlap
- wide-key stabilizer presence
- matrix pin count
- label presence
- switch presence

Missing relative to the product promise:

- rotated-key geometric collision checks
- plate cutout correctness
- mounting hole collision checks
- artifact existence checks
- export completeness checks tied to bundle output
- shell/keycap manufacturability checks

## 5. Geometry and Mechanical Loopholes

### 5.1 Plate metadata and plate DXF can disagree for rotated layouts

`generate_plate_dxf()` computes bounds using rotated key corners.
`get_plate_bounds()` computes bounds using unrotated rectangles.

Impact:

- API metadata can report dimensions that do not match the actual DXF for rotated layouts

### 5.2 Mounting holes are naive

Current behavior:

- 4 corners + 1 center hole
- no collision detection with keys or stabilizers

Impact:

- some layouts can easily produce impossible or awkward mounting points

### 5.3 Matrix compilation is intentionally naive but currently presented as general

Current behavior:

- keys are clustered into rows by Y-center
- columns are assigned by X ordering within each row

This is fine for many standard layouts, but it is not robust for:

- heavily rotated layouts
- more exotic ergonomic clusters
- split assemblies
- layouts that intentionally break visual rows

The compiler is fine as a V1 heuristic. It just should not be treated as a general keyboard compiler yet.

## 6. UX and Product Truth Gaps

### 6.1 Wizard completion is UI-driven, not state-driven

The sidebar currently marks completion based on the current step index, not on whether the project actually satisfies requirements for that step.

Impact:

- the interface can imply progress even when the underlying project is incomplete

### 6.2 Keycaps / PCB / Export steps still communicate roadmap more than capability

The main app presents a six-step flow, which is good product framing.

But only a subset is actually active end-to-end:

- Template: active
- Switches: active
- Layout: active
- Keycaps: partial backend only
- PCB: partial backend only
- Export: partial backend only

The app identity is strong. The actual flow is still uneven.

### 6.3 Identity is still keyboard-first at every layer

This is not a bug. It is a platform limitation.

Current assumptions are deeply keyboard-specific:

- layout units are keyboard units
- switch families are core domain concepts
- PCB compilation assumes matrix-scanned keys
- firmware generation assumes QMK/VIA
- geometry assumes keycaps, stabilizers, and switch cutouts

This is fine for BreakGen today. It becomes a problem if the product expands without a deeper abstraction pass.

## 7. Packaging and Ops Gaps

### 7.1 Server README is empty

That sounds minor, but it matters because the current system already requires:

- correct Python env
- backend deps beyond FastAPI
- proper launch command
- possibly optional AI/runtime constraints

Operational clarity is part of product integrity.

### 7.2 No persistent job model

Generation, export, and compilation are still request-driven and synchronous from the product’s point of view.

Impact:

- no durable job history
- no retries
- no idempotent long-running tasks
- no place to attach progress beyond immediate responses

This is one of the biggest gaps between current code and the product’s eventual identity.

## 8. Identity-Level Diagnosis

The current product identity is compelling:

- guided
- intentional
- creative
- fabrication-aware
- technical without exposing raw engineering tools

The current system identity is weaker:

- partially revisioned
- partially canonical
- partially exportable
- partially validated

The risk is not that BreakGen is too ambitious. The risk is that it becomes ambiguous about what is authoritative.

## 9. What Must Become Non-Negotiable

If BreakGen is going to be "better than possible" instead of just feature-rich, these rules need to harden:

1. Every stateful mutation must go through a single revisioned project-mutation pipeline.
2. No artifact reference should exist unless it is represented in canonical project state.
3. No export should claim more than the bundle actually contains.
4. No validation status should exist only as an ephemeral response.
5. Optional platform features must not break core app startup.
6. Product step completion must be derived from state, not from navigation order.

That is the foundation for the next stage.
