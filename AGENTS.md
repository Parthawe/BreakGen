# AGENTS.md — operating rules for coding agents in BreakGen

> Read this first, every session. BreakGen is an authenticated private-alpha "product studio" (FastAPI backend in `server/`, React + Vite + Zustand + Three.js frontend in `client/`) that turns a described programmable control surface into revisioned state → compiled evidence → validation → a traceable export bundle. Active work plan: `docs/EXPERIENCE_IMPLEMENTATION_PLAN.md`. Ground truth on status: `docs/MVP_READINESS_AND_ROADMAP.md`. Verified market context: `docs/COMPETITIVE_RESEARCH_2026_07.md`.

## The 8 rules (non-negotiable)

This repo's documented failure mode is **unverified claims**, not bad code. Multiple prior agent audits fabricated bugs and missed shipped features. Therefore:

1. **Verify before trusting.** Every "done" is backed by a passing test or a `file:line` citation. Never assert a feature exists or is missing without reading the code. If a previous note conflicts with the code, the code wins — flag the stale note.
2. **Branch + PR, one slice in flight.** Never commit to `main`. One slice = one branch = one reviewable diff. Get it merged before starting the next.
3. **Docs ship with code.** Update `README.md` and `docs/CURRENT_STATE.md` in the *same* diff as the feature that changes them.
4. **Never paywall correctness.** Validation, provenance, firmware, and engineering outputs stay free forever. Premium = appearance/convenience only. (Verified: the only proven paid layer in this niche, Cosmos, charges once for cosmetic options.)
5. **Keep AI at the appearance/exploration layer.** Deterministic compilers own geometry, electronics, firmware, validation, and export. AI-generated assets are **not canonical until explicitly accepted** (this gate already exists — `server/api/generation.py:533`). Do not blur this line, and never imply AI produced a deterministic output.
6. **No over-claiming.** Every UI/public claim must match what an exported bundle actually contains. `review_ready` ≠ fabrication-ready. Preserve that distinction everywhere; never add a `prototype_ready` state before real artifacts back it.
7. **No scope expansion.** Keyboard + macropad are the deep families; streamdeck / midi / gamepad stay labeled proof paths. Do not add product families, and do not surface planned families as if shipped.
8. **Stop and ask** the founder if a task would require breaking rules 4–7.

## Definition of done (per slice)

Code + test + docs, and all green:

```bash
make demo-proof
./server/.venv/bin/pytest server/tests
cd client && pnpm build
cd client && pnpm test        # frontend slices
```

## Already exists — DO NOT REBUILD (verified 2026-07-06; re-verify before relying)

- **Full authenticated loop**: create → edit layout → generate/accept appearance → compile electronics → compile mechanical → validate → export (`server/api/{projects,generation,pcb,geometry,export,records}.py`).
- **Acceptance-state machine = the AI-proposal gate**: `preview_only | candidate | accepted | production_ready | rejected` (`server/models/project.py`); non-accepted assets cannot be applied to the canonical layout (`server/api/generation.py:533`).
- **Graceful provider fallback, not a silent placeholder**: no `BREAKGEN_MESHY_API_KEY` → deterministic `shell_library` provider (`server/ai/providers/registry.py:65-72`).
- **Firmware artifacts already ship**: `firmware/{info,keymap,via,control-map}.json` in every bundle (`server/export/bundler.py:443-445`, `:259-270`) with live endpoints (`client/src/lib/api.ts:332-341`).
- **Evidence data already exists** (not yet one view): `GET /api/projects/{id}/records`, `/quality-gate`, immutable `ProjectRevisionRow` snapshots, per-artifact `sha256` in the manifest (`server/export/bundler.py:470-494`).
- **Telemetry**: `server/services/usage_registry.py` + `record_usage_event(...)`; billing-intent endpoint; per-project free generation cap (`server/api/generation.py:216`).

Corollary — do not act on these debunked claims: firmware is **not** missing; the proposal gate is **not** missing; there is **no** silent-placeholder bug. Work on them is legibility/depth, not construction.

## Out of scope for agents (founder-owned / later)

Provisioning + deploy (Neon Postgres, Cloudflare R2, Fly, Resend/Postmark email, Sentry DSN); async worker infrastructure; Stripe billing enforcement; OAuth, teams/multi-user, marketplace.

## Repository map

- `server/` — FastAPI backend: `api/` (routes), `models/`, `services/`, `eda/`, `firmware/`, `geometry/`, `export/`, `validation/`, `tests/`.
- `client/` — React workspace: `pages/`, `components/`, `stores/`, `lib/`.
- `docs/EXPERIENCE_IMPLEMENTATION_PLAN.md` — the current sliced work plan.
- `docs/MVP_READINESS_AND_ROADMAP.md` — verified status, bug ledger, roadmap.
- `docs/COMPETITIVE_RESEARCH_2026_07.md` — verified competitive research (citable findings only; unverified list must not be asserted).
