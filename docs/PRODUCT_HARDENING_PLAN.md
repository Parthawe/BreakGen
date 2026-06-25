# BreakGen Product Hardening Plan

## Goal

Make BreakGen behave like a real product system for generated hardware: users can sign in safely, create scoped projects, produce artifacts, and understand whether the current revision is blocked, reviewable, or export-ready.

## Architecture Direction

BreakGen should keep the Python API as the source of product truth. Supabase can be introduced for managed Auth and Postgres, but it should not replace BreakGen's revision, artifact, job, and validation rules.

Recommended target:

- Supabase Auth for email, Google, Apple, magic link, password reset, and account linking.
- Supabase Postgres for durable `users`, `projects`, `project_revisions`, `project_artifacts`, `project_jobs`, and launch leads.
- Row Level Security as database defense in depth, mirroring the API owner checks.
- BreakGen API for all canonical project mutations, validation, export, generation, and manufacturing-readiness decisions.
- Object storage for artifact files, with registry rows remaining mandatory.

## Auth Plan

1. Keep local JWT auth for private alpha until Supabase project credentials exist.
2. Add Supabase mode behind configuration, not hard-coded client assumptions.
3. Verify Supabase access tokens server-side before accepting API requests.
4. Map Supabase user IDs to BreakGen user rows.
5. Preserve project ownership checks in the API even when RLS is active.
6. Enable social login only after redirect URLs, provider credentials, callback behavior, and account linking are verified.

## Quality Control Plan

Every project revision needs an operator-readable gate:

- `blocked`: hard validation failure, stale validation, or missing required project structure.
- `review_ready`: no hard blockers, but warnings or active jobs remain.
- `validated`: validation passed for the current revision, but no current export exists.
- `export_ready`: current revision has validation and an export bundle.

The gate must be computed from server-owned records:

- canonical project state
- latest validation report artifact
- export bundle artifact
- provider and compiler jobs
- asset acceptance state

## Implementation Slices

1. Quality gate endpoint and workspace panel.
2. Supabase auth readiness config and token verification path.
3. Postgres migration plan with RLS policies for project ownership.
4. Artifact storage adapter with signed download URLs.
5. Admin/operator dashboard for leads, users, jobs, validation failures, and exports.
6. Manufacturing escalation workflow for quote-ready and production-ready states.

## Current Slice Implemented

This pass implements slice 1:

- server-side quality gate computation
- authenticated `/api/projects/{project_id}/quality-gate` endpoint
- client API contract
- workspace quality gate panel
- tests for blocked, stale, review-ready, and export-ready states

## Sources Used

Supabase documentation confirms the product direction:

- Supabase Auth uses JWTs and integrates with Postgres authorization.
- Row Level Security provides database-level defense in depth.
- Social login is provider-backed and should be configured deliberately.

Those facts support using Supabase as managed identity/database infrastructure while keeping BreakGen's canonical revision and QC logic in the API.
