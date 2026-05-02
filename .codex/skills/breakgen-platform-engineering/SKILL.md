---
name: breakgen-platform-engineering
description: Use when implementing or refactoring BreakGen backend or frontend features. Applies repo-specific rules for canonical project state, revision semantics, artifact and job provenance, and product-family-safe changes.
---

# BreakGen Platform Engineering

BreakGen is not just a keyboard app. It is becoming an intent compiler for constrained physical products.

Use this skill when building features so the code stays compatible with that direction.

## Read First

- `server/models/project.py`
- `server/services/project_state.py`
- `server/services/artifact_registry.py`
- `server/services/job_registry.py`
- `server/models/product_adapter.py`

If the change touches UI state or save flows, also read:

- `client/src/stores/projectStore.ts`
- `client/src/types/project.ts`

## Non-Negotiable Rules

1. Spec-changing mutations must go through `load_project_state()` and `commit_project_mutation()`.
2. Metadata-only updates must use `persist_project_metadata()`.
3. Changes that invalidate downstream outputs must call `invalidate_derived_state()`.
4. Any durable file produced by the system must be registered in `project_artifacts`.
5. Any provider-backed or long-running task must be recorded in `project_jobs`.
6. Do not add keyboard-only assumptions to shared layers unless the field is explicitly domain-specific.
7. The client should prefer authoritative server responses over local guesses after save or mutation.

## What Counts as a Spec Change

These usually require a new immutable revision:

- layout edits
- switch selection changes
- keycap assignment changes
- matrix assignment changes
- product-family-specific structural changes

These usually do not require a new immutable revision:

- validation result persistence
- export bundle bookkeeping
- job status polling updates
- artifact registration

## Default Workflow

1. Inspect the canonical model and the relevant mutation path first.
2. Change shared lifecycle or provenance services before patching endpoints.
3. Wire API behavior next.
4. Update the client only after the server contract is correct.
5. Add or update tests for lifecycle, provenance, and user-visible behavior.
6. Run the narrowest verification that actually proves the change.

## Required Checks Before Finishing

- `./server/.venv/bin/pytest server/tests`
- `./server/.venv/bin/python -m py_compile ...` for touched Python files when the refactor is structural
- `pnpm build` in `client/` if client files changed

## Multi-Product Guardrails

When adding a new product family:

- extend `ProductFamily` intentionally
- add adapters/templates/tests together
- keep shared services product-family-agnostic
- only reuse keyboard compilers where the semantics genuinely match
- prefer domain compilers behind a shared project envelope instead of stuffing generic fields into `KeyboardProject`
