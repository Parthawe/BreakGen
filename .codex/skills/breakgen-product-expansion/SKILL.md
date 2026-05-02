---
name: breakgen-product-expansion
description: Use when planning or implementing support for macro pads, stream deck style devices, MIDI controllers, or other future BreakGen product families. Keeps expansion aligned with the platform architecture instead of growing keyboard-only debt.
---

# BreakGen Product Expansion

BreakGen should expand as a platform of domain compilers, not as one oversized keyboard schema.

## Strategic Frame

Treat BreakGen as:

- intent in
- constrained domain compiler in the middle
- manufacturable artifacts and validation out

Do not generalize by flattening every product into vague geometry or random assets.

## Expansion Order

Prefer this sequence:

1. macro pads
2. numpads or stream-deck-style boards
3. MIDI controllers
4. controller-like input devices
5. enclosures and non-matrix fabricated objects

This preserves leverage from the current layout, matrix, and export stack.

## Shared Layers vs Domain Layers

Shared platform layers:

- project lifecycle
- revisioning
- artifact registry
- job registry
- validation persistence
- export bookkeeping

Domain-specific layers:

- layout semantics
- matrix compilation
- firmware derivation
- geometry rules
- validation rules tied to manufacturability

## Rules for Adding a Product Family

1. Add the family enum and templates together.
2. Add a domain adapter before touching downstream compilers.
3. Reuse existing compilers only if their assumptions still hold.
4. Add tests for templates, validation, and export behavior for the new family.
5. Keep the canonical shared contract stable even if the domain spec grows.

## What to Avoid

- adding generic-sounding fields that are secretly keyboard-specific
- expanding `KeyboardProject` as the forever top-level platform model
- reusing keyboard validation language for non-keyboard products
- claiming "multi-product support" before templates, tests, and provenance exist for that family

## Default Implementation Pattern

1. define the family and template surface
2. define or adapt the domain-to-layout conversion
3. verify compiler compatibility
4. add family-specific validation
5. add export expectations
6. add tests before broad UI claims
