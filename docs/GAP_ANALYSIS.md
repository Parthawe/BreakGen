# BreakGen Gap Analysis

> What is happening, what is not happening, where the build is lacking, and what would improve it fastest.

## Current Read

The build has started in the correct direction, but most of the product promise still lives in specification rather than implementation. Right now the repo contains:

- a good product thesis
- a strong canonical model
- a presentable client shell
- almost none of the operational machinery required to make the product real

This is normal for the current stage, but it means the next decisions matter a lot.

## What Is Happening

These things are actively happening in the repo, even if they are still shallow:

- the app structure is separating client and server responsibilities
- the UI already encodes the product flow
- the backend model already encodes the source-of-truth philosophy
- the dependency choices suggest a serious path toward geometry and API work

These are good signs because they reduce the chance of the project collapsing into disconnected experiments.

## What Is Not Happening Yet

These are the missing loops that make the product actually behave:

- no project can be created, loaded, or persisted through an API
- no layout can be edited as structured data
- no frontend state change can trigger compilation or validation
- no background work exists for long-running generation
- no generated or compiled artifacts can be stored, versioned, or inspected
- no validation gates exist to decide whether something is safe to export

## The Main Lack

The build is currently lacking operational backbone more than it is lacking features.

That means the highest-value missing things are not:

- more visual polish
- more menu items
- more placeholder 3D scenes

The highest-value missing things are:

- project lifecycle
- revisioned persistence
- a thin but real API
- a job model
- a validation model

## Priority Order

If the team wants to keep the project possible and avoid rework, the sequence should be:

1. Make project state real.
2. Make revision changes observable.
3. Make client edits update the canonical project model.
4. Add validation as a first-class response shape.
5. Only then begin deeper compilers and generation workers.

That ordering keeps the foundation stable.

## Where The Architecture Can Still Go Wrong

### 1. Letting the frontend invent its own truth

If the client grows a rich local layout format that drifts from `KeyboardProject`, the project will fork into two systems.

Better approach:

- define one wire format
- make frontend editing operate on that format
- keep transforms from wire format to render format local and disposable

### 2. Treating generation as the product core too early

The AI surface is exciting, but the product breaks if generation arrives before state, validation, and artifacts are real.

Better approach:

- make the project lifecycle work first
- attach generation jobs into that lifecycle second

### 3. Leaving validation for later

If validation is added only after export and geometry pipelines exist, it becomes a patchwork of ad hoc checks.

Better approach:

- define validation result shapes now
- allow compilers to emit partial validation early

### 4. Building synchronous long-running endpoints

Mesh generation, mesh repair, and PCB compilation will not fit comfortably inside request/response handlers.

Better approach:

- define jobs and status polling early
- keep API endpoints fast and stateful, not blocking

## What Would Make The Build Better Fast

These improvements would create the most leverage:

### A. A real project API

Minimum useful endpoints:

- create project
- get project
- update project
- list projects
- request validation
- request export

This would immediately connect the frontend shell to a meaningful backend contract.

### B. A revision discipline

Every meaningful project update should:

- increment revision
- update `updated_at`
- invalidate stale validation/export state when necessary

Without this, the "compiler" part of BreakGen will be hard to trust later.

### C. A validation skeleton

Even before geometry and PCB compilers exist, the backend can already validate:

- required fields
- supported switch family
- valid key sizes
- stabilizer requirements for larger keys
- duplicate key ids
- impossible coordinates or matrix assignments

This gives the product a logic surface before it has a fabrication surface.

### D. A typed frontend store

The client needs:

- current project
- current revision
- active step
- dirty state
- async job state
- validation summary

Without that, every new UI feature will be harder to connect.

## Suggested Working Definition Of "Progress"

For this build, progress should mean:

- more of the spec becoming enforceable in code
- fewer placeholder surfaces
- clearer contract between UI, project state, and derived artifacts

Progress should not mean:

- more screens with no state
- richer rendering with no data model connection
- generated assets with no validation path

## Healthy Near-Term Milestone

A strong next milestone would be:

"A user can create a project, edit a small layout, persist it, fetch it back, and receive a validation response from the server."

That is small enough to finish and foundational enough to unlock everything else.

## Bottom Line

The build is promising because it started with the right abstractions. It is lacking because the runtime system around those abstractions does not exist yet.

The right move now is not to chase breadth. It is to connect the skeleton into a living system.
