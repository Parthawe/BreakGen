---
name: breakgen-architecture-review
description: Use when auditing BreakGen for loopholes, regressions, claim gaps, platform drift, or implementation risk. Focuses review on state integrity, provenance, manufacturability truth, and multi-product readiness.
---

# BreakGen Architecture Review

Use this skill when the task is review, audit, gap analysis, or "what is missing?"

## Review Priorities

Order findings by risk:

1. canonical state drift
2. revision history corruption
3. claim vs implementation mismatch
4. missing artifact or job provenance
5. product-family leakage
6. manufacturability or geometry false confidence
7. UX paths that hide stale server truth

## Required Questions

For every changed path, ask:

1. Does this mutate canonical project state?
2. If yes, is it using the correct lifecycle helper?
3. If it produces a file, where is that file recorded?
4. If it talks to an external provider, where is the durable job record?
5. Does the user-facing claim match the actual end-to-end path?
6. Does this still work if the product family is not a keyboard?

## Evidence Strategy

- Inspect the exact mutation or export path, not just nearby models.
- Prefer direct verification over assumption.
- Run tests.
- If behavior depends on persistence, verify against a temporary database or the existing test harness.
- Treat README/spec language as a claim surface that must be checked against the code.

## Output Shape

Return findings first.

Each finding should state:

- severity
- what is wrong
- why it matters
- exact file reference

After findings, summarize the deeper pattern only if it adds real value.

## Common BreakGen Failure Modes

- routes mutate project JSON but skip revision discipline
- validation/export data is stored only in JSON and not as durable artifacts
- provider-backed generation exists without job history
- docs promise fabrication completeness before the pipeline exists
- keyboard assumptions leak into shared platform code
- frontend save loops ignore authoritative backend state
