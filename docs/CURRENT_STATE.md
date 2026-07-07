# BreakGen Current State

> Snapshot of the actual product and architecture currently present in the repository.

Date of assessment: July 6, 2026

## Product Boundary

BreakGen is no longer a keyboard-only concept prototype.

Current product scope is tiered:

- a private-alpha product studio for control-surface paths with explicit readiness tiers
- `keyboard`: proven/safest path
- `macropad` and `streamdeck`: alpha paths
- `midi` and `gamepad`: proof paths

Planned families and domains such as `handheld`, `ambient_device`, and `wearable` exist in platform manifests and proof infrastructure, but they are **not part of the live authenticated alpha flow**.

## What Is Real

### Authenticated product loop

The signed-in product already supports the main alpha path:

1. Create a project from a family/template baseline
2. Start from a deterministic intent-to-template proposal or sample project
3. Edit the layout through authoritative `layout.elements`
4. Generate and review appearance assets
5. Accept proposals before they enter the canonical build
6. Compile electronics metadata
7. Compile mechanical outputs
8. Run validation
9. Export a traceable bundle with QMK/VIA-compatible firmware metadata
10. Inspect jobs, artifacts, validation, evidence, and export history

### Platform spine

The repo has a real platform backbone:

- revisioned canonical project state
- immutable revision snapshots
- durable artifact records
- persistent job records
- validation artifacts
- export artifacts
- evidence ledger records that connect revisions, jobs, artifacts, validation, hashes, and export caveats
- usage events for revision commits, first passing validation, export creation, billing intent, and TTFB analysis
- family manifests
- provider manifests
- mechanical and electronics compile endpoints

### Client product shell

The client is no longer only a dark demo shell. It now has:

- light, dark, and system theme support
- authenticated and public routes
- a shared product shell across the tiered control-surface paths
- lazy-loaded heavy modules
- family-aware define, layout, appearance, electronics, validate, and export stages
- a signed-in Evidence Ledger surface for inspecting revision-linked artifact provenance
- empty-state sample/project proposal flows that use deterministic template matching
- autonomy labels showing whether appearance assets are proposed, in-build, or rejected
- export UI access to QMK/VIA-compatible firmware metadata without claiming compiled firmware

### Test health

The server suite is healthy. Current baseline in this repo is:

- `93` passing server tests before the current private-alpha hardening pass

## What Is Still Thin

### Private-alpha operations

The product has needed operator assumptions, but they still require explicit runbook discipline:

- seeded reviewer accounts
- local/dev stack startup
- provider-key expectations
- test-flow expectations for reviewers

### Collaboration and commercial surfaces

These are still out of scope:

- multi-user collaboration
- billing
- quotes and purchasing
- production manufacturing integrations
- compiled firmware binaries

### Broader product-family release

The architecture can represent additional domains, but those domains should not be treated as shipped:

- handheld is proof-only
- ambient devices are planned
- wearables are planned

## Current Architectural Read

BreakGen is now in the correct phase to become a **real private alpha**, but only if the team keeps the product boundary disciplined:

- deepen the signed-in loop
- keep provenance visible
- keep revision semantics strict
- keep exports honest
- do not expand scope faster than validation and export truth can support

The main risk is no longer “missing frontend.” The main risk is product drift: showing planned capability in places where the authenticated alpha cannot yet support it end to end.
