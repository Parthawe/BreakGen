# BreakGen Current State

> Snapshot of what exists in the repository right now and what that means architecturally.

## Intent

This document is not a wishlist. It describes the implementation surface that currently exists so the team can see clearly:

- what is already real
- what is still scaffolding
- where the build is converging correctly
- where the build has not started yet

Date of assessment: April 7, 2026

## Repo Shape

The repo now has three layers:

| Layer | Status | Notes |
| --- | --- | --- |
| Root documentation | Present | The product spec and README now define the product and system clearly |
| `client/` | Early scaffold | React + Vite + Three.js shell exists |
| `server/` | Early scaffold | Python backend package exists, but runtime API is not yet implemented |

This is the right direction. The project has moved from concept-only into a split frontend/backend architecture, but it is still in foundation mode.

## What Is Actually Implemented

### 1. Frontend shell exists

Current signals:

- React 19, Vite, Tailwind, Three.js, `@react-three/fiber`, and `zustand` are installed
- the app renders a sidebar with the intended six-step flow
- the main viewport renders a placeholder 3D scene
- the UI language already matches the product thesis: "Keyboard Intent Compiler"

What that means:

- the client has a credible app shell
- the 3D stack choice is aligned with the product
- the interaction model is visible even though the functionality is not yet there

### 2. Canonical backend domain model exists

Current signals:

- `server/models/project.py` defines `KeyboardProject` and supporting models
- project status, switch families, controllers, stabilizers, layout, style request, keycap assets, PCB spec, and export state are already modeled
- the comments explicitly treat the project model as the single source of truth

What that means:

- the most important architectural decision is already represented in code
- the backend is starting in the right place: schema first, artifact second
- this model can anchor API design, persistence, validation, and compilation work

### 3. Packaging direction is set

Current signals:

- the server depends on FastAPI, SQLAlchemy, Pydantic, and optional geometry libraries
- the client stack is coherent for a real interactive product

What that means:

- the repo is not randomly exploring tools
- the likely path is web client + API + async workers or worker-like services

## What Is Not Implemented Yet

### 1. No runtime API

`server/main.py` is still a stub. There are no routes, no app factory, no request models, and no persistence wiring.

Impact:

- the domain model cannot be exercised
- the client cannot load or save projects
- there is no contract between the build surfaces yet

### 2. No persistence layer

SQLAlchemy is declared, but there are no database models, migrations, repositories, or storage boundaries.

Impact:

- project revisions are not durable
- artifacts cannot be referenced safely
- validation and export provenance cannot exist yet

### 3. No background job system

There is no queue, no job table, no worker process, and no async task contract for generation, geometry, PCB compilation, or export.

Impact:

- the architecture currently has no place for long-running work
- if generation is wired directly into request/response flows, the system will become brittle immediately

### 4. No compiler implementation

The product promise depends on compilation pipelines, but none are implemented yet:

- no layout compiler
- no plate generator
- no keycap normalization pipeline
- no PCB compiler
- no export bundler
- no validation engine

Impact:

- the current build is still a shell around a schema

### 5. No frontend state architecture

`zustand` is installed, but there is no store, no typed client domain state, no step machine, and no API integration.

Impact:

- the current sidebar is presentational only
- there is no project loading, editing, or recomputation loop

## What Is Going Right

These are the strongest signals in the current implementation:

- the project is splitting concerns correctly into client and server
- the product language and engineering model are coherent with the spec
- the canonical project model appeared early, which is exactly what this product needs
- the frontend did not start as a marketing page; it started as an application shell

## Where The Build Is Currently Thin

The thinnest points are not aesthetic. They are systems points:

- no API boundary
- no persistent project lifecycle
- no revision semantics
- no validation layer
- no artifact store contract
- no job execution model

If those are not established early, later work on generation and 3D rendering will pile onto unstable foundations.

## Maturity Assessment By Subsystem

| Subsystem | Maturity | Notes |
| --- | --- | --- |
| Product framing | Strong | Clear spec and repo direction |
| Client shell | Early but promising | Visual scaffold exists |
| Domain schema | Strong for this stage | Best implemented part of the system |
| API layer | Not started | Critical missing bridge |
| Persistence | Not started | Needed before meaningful stateful work |
| Validation | Not started | Should start early, not late |
| Geometry pipeline | Not started | Still conceptual |
| PCB pipeline | Not started | Still conceptual |
| Export system | Not started | Still conceptual |
| Tests | Not started | No system confidence yet |

## Immediate Interpretation

BreakGen is no longer "just an idea," but it is also not yet "a working compiler." It is in the most important early phase: the moment where the system can still be built cleanly if the boundaries are established before feature pressure takes over.

That is the main read on the current state.
