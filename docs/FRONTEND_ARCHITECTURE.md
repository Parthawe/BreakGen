# BreakGen Frontend Architecture Notes

> Documentation-only guidance aligned to the current React + Three.js scaffold.

## Current Read

The frontend already has the right outer shape:

- a left-step navigation model
- a full-screen 3D workspace
- a product identity that reads like an application, not a landing page

What it does not have yet is internal architecture.

## What The Frontend Needs To Own

The client should own:

- interaction flow
- optimistic editing experience
- 3D preview state
- step navigation
- local draft edits before save
- job progress display
- validation and export status display

The client should not own:

- canonical revision semantics
- artifact truth
- validation truth
- compilation results as hand-maintained local state

## Recommended Top-Level Structure

```text
client/src/
  app/
    AppShell.tsx
    routes or step-layout components
  features/
    project/
    template/
    switches/
    keycaps/
    layout/
    validation/
    export/
  scene/
    KeyboardScene.tsx
    CameraController.tsx
    lights/
    meshes/
  store/
    projectStore.ts
    uiStore.ts
  api/
    client.ts
    projects.ts
    jobs.ts
  types/
    project.ts
    validation.ts
```

The exact folders can vary. The important point is to separate:

- domain state
- API contracts
- UI features
- scene/rendering code

## Recommended Store Shape

Because `zustand` is already installed, the first useful store should be explicit and boring.

### `projectStore`

Suggested fields:

- `project`
- `activeStep`
- `isDirty`
- `isSaving`
- `saveError`
- `validationSummary`
- `activeJobs`

Suggested actions:

- `createProject`
- `loadProject`
- `patchProject`
- `saveProject`
- `setActiveStep`
- `requestValidation`
- `refreshJob`

### Why This Matters

Without a typed store, the app will quickly become:

- a growing tree of local component state
- duplicated derived values
- difficult to synchronize with backend revisions

## Step Model

The current sidebar already implies this flow:

1. Template
2. Switches
3. Keycaps
4. Layout
5. PCB
6. Export

That is a good product-level step model. The frontend should formalize it as data:

```ts
type StepId =
  | "template"
  | "switches"
  | "keycaps"
  | "layout"
  | "pcb"
  | "export";
```

Each step should declare:

- whether it is available
- whether it is complete
- whether it has warnings
- which project fields it depends on

This lets the sidebar stop being static decoration and become a real progress map.

## Scene Architecture

The current canvas should evolve into a composed scene, not a single monolithic `App.tsx`.

Recommended scene responsibilities:

| Component | Responsibility |
| --- | --- |
| `KeyboardScene` | Overall scene composition |
| `KeyboardAssembly` | Layout-driven placement of keys, plate, and case shell |
| `KeyMesh` | One key instance or instance source |
| `SelectionLayer` | Hovered or selected key visuals |
| `GroundPlane` | Contextual staging only |
| `CameraController` | Orbit presets, focus, constraints |

## Rendering Principle

Keep render geometry derived from project state. Do not let render-only transforms become a second layout model.

Better:

- transform `KeyboardProject.layout` into scene instances

Worse:

- maintain a second internal array of visual key positions and hope it stays synced

## Good Early UI Milestones

The first frontend milestones should be practical:

### Milestone 1

- create project from template
- fetch project from backend
- show project name and status

### Milestone 2

- render keys from `layout.keys`
- select a key
- edit simple key properties

### Milestone 3

- save edits through backend patch
- reflect updated revision/status
- display validation summary

These milestones make the scene useful before advanced generation exists.

## UI Risks To Avoid

### 1. Overbuilding the scene before data flows

Three.js can absorb a lot of time. If the scene gets detailed before project data is real, the frontend becomes a rendering demo instead of a product.

### 2. Treating the sidebar as permanent static UI

The sidebar should become:

- navigation
- completion state
- warnings
- action launch surface

Not just a nice list of labels.

### 3. Hiding backend lag

Generation and compilation will be asynchronous. The frontend should surface:

- queued
- running
- failed
- succeeded

If job state is hidden, the product will feel broken even when it is working.

## What Good Looks Like

The frontend will be in a strong state when:

- it can render a project directly from canonical backend data
- step navigation reflects real project status
- edits are typed, persistable, and revision-aware
- validation and job status are visible in the UI
- the 3D scene is a function of the project, not a separate source of truth

That is the standard to aim for.
