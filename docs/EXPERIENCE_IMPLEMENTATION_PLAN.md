# BreakGen Experience Implementation Plan (for Codex)

> Detailed, self-contained implementation plan derived from `docs/MVP_READINESS_AND_ROADMAP.md` (Experience plan section) and `docs/COMPETITIVE_RESEARCH_2026_07.md` (verified research). Written to be executed by a coding agent with no prior conversation context.
> Assessment date: 2026-07-06. Every file path and claim below was verified against the code on that date.

## 0. Read this first — operating rules (non-negotiable)

This repository's documented failure mode is **unverified claims**, not bad code. Multiple prior subagent audits fabricated bugs and missed shipped features. Therefore:

1. **Verify before trusting.** Every "done" must be backed by a passing test or a direct code citation (`file:line`). Never assert a feature exists or is missing without reading the code.
2. **Branch + PR, one slice in flight.** Do not commit to `main`. One slice = one branch = one reviewable diff. Finish and get a slice merged before starting the next. Add the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` — but the human author is you (Codex); adjust as your harness requires.
3. **Docs ship with code.** When a slice lands, update `README.md` and `docs/CURRENT_STATE.md` in the *same* diff.
4. **Definition of done per slice:** code + test + docs updated + `make demo-proof` still passes + `./server/.venv/bin/pytest server/tests` green + `cd client && pnpm build` green + (frontend slices) `cd client && pnpm test` green.
5. **Never paywall correctness.** Validation, provenance, firmware/engineering outputs stay free forever. This is a verified strategic constraint: the only proven paid layer in this exact niche (Cosmos) charges a one-time fee for *cosmetic* options only. Premium = appearance/convenience, never trust.
6. **Keep AI at the appearance/exploration layer.** Deterministic compilers own the engineering layer (geometry, electronics, firmware, validation, export). AI-generated assets are not canonical until explicitly accepted. Do not blur this line.
7. **No over-claiming.** Every public/UI claim must match what an exported bundle actually contains. "Review-ready" ≠ "fabrication-ready." Preserve that distinction everywhere.
8. **No scope expansion.** Keyboard + macropad are the deep families; streamdeck/midi/gamepad stay labeled proof paths. Do not add new product families.

## 1. What BreakGen is (context)

BreakGen is an authenticated private-alpha "product studio" that turns a described programmable control surface (keyboard, macropad, stream deck, MIDI, gamepad) into **revisioned project state → compiled evidence → validation → a traceable export bundle**. Backend: FastAPI (`server/`). Frontend: React + Vite + Zustand + Three.js (`client/`). The core loop is real and works locally; the make-or-break gap is that it has **never been deployed** (that is a founder task: provision Neon Postgres + Cloudflare R2 + Fly, not yours).

**The category boundary claim** (how BreakGen differs from both flanks): AI-CAD startups sell "real CAD, not meshes"; the hobbyist keyboard chain (Ergogen etc.) stops before firmware/validation/fabrication. BreakGen's line is **"evidence, not renders"** — a compiled, validated, revision-linked build. The north-star metric is **Time-to-First-Trusted-Bundle (TTFB): under 15 minutes** from intent to a validated export bundle.

## 2. What already exists — DO NOT REBUILD (verified 2026-07-06)

Read these before writing anything; the slices below extend them, not replace them.

- **Full authenticated loop**: create → edit layout → generate/accept appearance → compile electronics → compile mechanical → validate → export. Endpoints in `server/api/{projects,generation,pcb,geometry,export,records}.py`.
- **Acceptance-state machine (the autonomy gate already exists)**: `AcceptanceState` = `preview_only | candidate | accepted | production_ready | rejected` (`server/models/project.py`). `apply_keycap` refuses to apply a non-accepted asset to the canonical layout (`server/api/generation.py:533`). Asset counts by state are synced into `project.assets["asset_counts"]` (`server/api/generation.py:94-122`).
- **Graceful provider fallback (not a silent placeholder)**: with no `BREAKGEN_MESHY_API_KEY`, generation resolves to the deterministic `shell_library` provider (`server/ai/providers/registry.py:65-72`). The submission carries `provider_id`; the UI just needs to *show* which provider produced an asset.
- **Firmware artifacts already ship**: `firmware/info.json`, `keymap.json`, `via.json`, `control-map.json` are written into every export bundle (`server/export/bundler.py:443-445`, `_included_files` at `:259-270`) and exposed live at `GET /api/projects/{id}/firmware/{info.json|keymap.json|via.json|control-map.json}` (client wrappers in `client/src/lib/api.ts:332-341`).
- **Evidence data already exists** (just not surfaced as one view): `GET /api/projects/{id}/records` (jobs, artifacts, latest validation, latest export), `GET /api/projects/{id}/quality-gate`, immutable `ProjectRevisionRow` snapshots, per-artifact `sha256` in the export manifest (`server/export/bundler.py:470-494`), owner-scoped artifact download at `GET /api/projects/{id}/artifacts/{artifact_id}/download`.
- **Usage + billing-intent telemetry**: `server/services/usage_registry.py`, `record_usage_event(...)`, event types like `generation_submitted`/`generation_completed`, `POST /api/projects/{id}/billing-intent`, per-project free generation cap `settings.free_generation_jobs_per_project` (`server/api/generation.py:216`).
- **Frontend spine**: staged workspace (`client/src/App.tsx`), project index (`client/src/pages/ProjectList.tsx`), Zustand stores (`client/src/stores/{projectStore,authStore,notificationStore}.ts`), toast deck (`ToastDeck.tsx`), action runways (`ActionRunway.tsx`), light/dark/system theming, CSS-variable design system, Vitest + Testing Library set up (`client/src/**/*.test.ts(x)`).

**Corollary — three things the inspiration docs got wrong; do not act on them:** (a) firmware is *not* missing from bundles; (b) the "no proposal gate" gap does *not* exist — the acceptance-state machine is the gate; (c) there is no "silent placeholder" bug — fallback is a real deterministic provider. Your job on these is **legibility and depth**, not construction.

## 3. The slices (sequenced, each a branch + PR)

Slices 1–4 are **code-only** and can proceed now without any hosting. Slice 5 is **research-gated**. Do them in order; each is independently shippable.

---

### Slice 1 — Evidence tab (Move 2) · code-only · HIGH value

**Goal.** Turn the provenance that already exists in data into a first-class, per-project **Evidence** view: a chronological ledger of revision → compile → validation → export, each entry showing artifact id, `sha256` (short), readiness tier, and honest "what this bundle is / is not" copy. This is the visible embodiment of "evidence, not renders."

**Why (verified).** Practitioner skepticism is the adoption barrier for the whole category (Xometry hands-on test: no text-to-CAD tool is yet a pro-CAD substitute; HN engineers: "meshes called CAD"). BreakGen's edge is making trust *visible*. Leo AI's knowledge-grounding and Kyrall's Context Manager are the verified enterprise-moat pattern; the maker-scale version of that moat is a legible evidence trail.

**Backend.** Data already exists — prefer composing existing endpoints. If a single consolidated read is cleaner, add `GET /api/projects/{id}/evidence` in `server/api/records.py` that merges `records` + `quality-gate` + revision list into an ordered timeline (revision index, event type, artifact ids + sha256 + category, validation status + check counts, export readiness). Do **not** invent data; only reshape what `records`/manifest already provide. Add a test in `server/tests/` (mirror `test_products.py`/`test_export.py` patterns) asserting the timeline is ordered and every artifact entry carries a real sha256.

**Frontend.** New component `client/src/components/EvidencePanel/EvidencePanel.tsx` (+ `index.ts`). Wire it as a workspace surface — either a new stage after `export` or a panel inside `ProjectSurfaces` (`client/src/components/PlatformSurfaces/ProjectSurfaces.tsx`), whichever fits the existing stage manifest model in `App.tsx` without faking a family-manifest stage. Reuse existing `api.records.get` / `api.records.qualityGate` (`client/src/lib/api.ts:381-400`) or the new `evidence` endpoint. Show, per entry: readiness pill (reuse `statusTone` conventions), short sha256 in `font-mono`, and a plain-language line distinguishing `review_ready` from fabrication-complete (copy source: `_missing_outputs()` in `server/export/bundler.py:273-279`). Add a Vitest component test.

**Acceptance criteria.** A user viewing a project with at least one validation + one export sees an ordered evidence timeline; every artifact row shows a verifiable sha256; copy never implies fabrication-ready when readiness is `review_ready`/`candidate`. Docs updated.

---

### Slice 2 — Legible autonomy gradient (Move 3) · code-only

**Goal.** Make the *existing* acceptance-state machine legible, and label the generation provider source. Three ideas the UI must convey: (1) AI appearance assets are **proposed, not in your build** until accepted; (2) the engineering layer (compile/validate/export) is deterministic and never AI; (3) whether an asset came from a real generative provider (`meshy`) or the deterministic `shell_library` fallback.

**Why (verified).** This is BreakGen's version of PTC Creo 13's shipped **Advise → Assist → Automate** labeled-autonomy pattern with an approval gate — the incumbent's answer to trust, directly stealable. The backend gate already exists (`server/api/generation.py:533`); this slice is purely making it readable so users trust the outputs.

**Frontend (primary).** In `client/src/components/KeycapStyler/KeycapStyler.tsx`: badge every asset with its `acceptance_state` (`preview_only`/`candidate` → "Proposed — not in your build"; `accepted`/`production_ready` → "In your build"); show the provider source badge from the asset/submission `provider` field (`meshy` = "AI generated", `shell_library` = "Deterministic library — no AI key configured"). Ensure the accept action (existing `api.keycaps.updateAcceptance`, `client/src/lib/api.ts:268`) reads as the moment a proposal enters the canonical build. Add a small persistent explainer near the compile/validate/export stages in `App.tsx` (or `ProjectSurfaces`) stating those outputs are deterministic, not AI. No backend change required unless the provider id isn't already on the asset payload — verify first (`server/models/project.py` `KeycapAsset`); only add it if genuinely absent.

**Acceptance criteria.** In the appearance stage, proposed vs in-build assets are visually distinct; provider source is shown; nowhere does the UI imply an unaccepted asset is part of the build; a test asserts the badge/label logic. Docs updated.

---

### Slice 3 — Intent-to-proposal first run + seeded sample (Move 1) · code-only · HIGH value

**Goal.** Kill the empty first-login. New users (a) land on a seeded sample project so the workspace is never empty, and (b) can describe intent in plain language and get a proposed family + template that opens a project which already compiles. This is the TTFB lever.

**Why (verified).** Raven and Zoo validate the intent→parametric pattern; the incumbent generative-geometry gap (Autodesk announced-not-shipped, Onshape advisory-only) is the timing. Adam's consumer-first funnel is the playbook for a maker audience.

**Keep it honest — this is NOT AI.** The "intent → proposal" mapping is a **deterministic keyword/rules mapping** over the existing `SUPPORTED_TEMPLATES` (`server/models/supported_configs.py`), not an LLM. Naming it a "proposal" is fine; implying AI designed it is not (rule 6/7).

**Backend.** Option A (preferred, simplest): do the mapping client-side against the existing `api.templates.list()` + `api.platform.productFamilies()`. Option B: add `POST /api/projects/propose` in `server/api/projects.py` taking `{ intent: str }` and returning a ranked list of `{family, template_id, rationale}` from a keyword table over `SUPPORTED_TEMPLATES` — with a test. Choose A unless the mapping needs server-side catalog data the client lacks. Creation still goes through the existing `POST /api/projects/` (which already requires an enabled family + valid `template_id`, `server/api/projects.py:117-186`).

**Seeded sample.** On first authenticated load with zero projects, offer a one-click "Open a sample project" that creates a project from a known-good template (e.g. the streamdeck template used by `make demo-proof`; confirm the id in `SUPPORTED_TEMPLATES`) and drops the user into it. Do not auto-create silently on every empty load — make it an explicit action so the index isn't polluted. Alternatively seed a read-only guided sample; pick whichever matches the existing empty-state pattern in `ProjectList.tsx:320-341`.

**Frontend.** Replace/augment the empty state in `client/src/pages/ProjectList.tsx` and the "Define" entry in `App.tsx` (`TemplateSelector`) with an intent input → proposed template chips → create. Reuse `api.projects.create` and the existing navigation to `/app/project/{id}`. Add component tests.

**Acceptance criteria.** A brand-new user reaches a working, compilable project in ≤ 3 clicks from first login; the intent mapping is deterministic and documented as such; nothing implies AI generated the layout. Measure a rough TTFB in the demo flow. Docs updated.

---

### Slice 4 — Metrics instrumentation (Move 7) · code-only

**Goal.** Instrument the funnel the research said is unproven, so the hosted alpha becomes the demand experiment: **TTFB, activation (first validated revision), export rate, revision depth, billing-intent CTR, weekly returning builders.**

**Why (verified).** Zero market-size / willingness-to-pay claims survived verification on either research pass. The hosted alpha *is* the experiment; without these events there is no read on whether the wedge is real. Pricing anchors when the time comes: free = full engineering loop with quotas; maker tier $10–20/mo (Raven $9.99–99, Kyrall €20/mo) metered on generation; premium = cosmetic/convenience; stay under Onshape's $1,500/yr floor.

**Backend.** Extend `server/services/usage_registry.py` with the missing event types (reuse `record_usage_event`; do not build a parallel system). Emit: `project_created`, `first_validation_passed` (activation), `export_created`, `revision_committed`, alongside existing generation + billing-intent events. Add an operator read (extend `server/scripts/operator_snapshot.py` and/or the `records` usage endpoint) that computes TTFB per user and the funnel counts. Tests in `server/tests/test_usage_registry.py`.

**Acceptance criteria.** Each funnel event fires exactly once at the right transition (asserted by tests); operator snapshot can report activation and export rates. No PII beyond what's already stored. Docs updated.

---

### Slice 5 — Firmware/fab handoff clarity + depth (Move 5) · RESEARCH-GATED · do last

**Goal.** Surface the firmware artifacts that already ship as first-class, clearly-labeled bundle members, and *only then* (separately, post-research) deepen toward the real fabrication gap (Gerbers → supplier BOM → enclosure STL → `prototype_ready`).

**Gate — do not skip.** A verified 0-3 refutation ("Cosmos stops at CAD export with no firmware path" is FALSE) means BreakGen's differentiation claim is currently **unbounded**. Open question #3 in `docs/COMPETITIVE_RESEARCH_2026_07.md` must be resolved (how far Cosmos / QMK Configurator / VIA / VIAL actually reach on firmware + fab) **before any marketing/positioning claim about the fab gap is written**. A background research task is already queued for this. Until it lands: surface existing firmware artifacts and label them accurately, but write **no** competitive "nobody else does firmware" copy.

**Now (safe, code-only).** Make the existing `firmware/*.json` artifacts and their download endpoints visible in the export/evidence UI with honest labels ("QMK/VIA-compatible firmware metadata," not "flashable firmware" unless verified). Confirm exactly what `server/firmware/qmk_generator.py` emits before labeling.

**Later (Phase 4, needs the async worker boundary — see roadmap items 7, 39–42).** Gerbers/drill via a KiCad worker → supplier-ready BOM → CadQuery enclosure STL/STEP → a `prototype_ready` export state that is only reachable once those artifacts are real. Do not introduce a `prototype_ready` claim before the artifacts back it (rule 7).

**Acceptance criteria (for the "now" part).** Firmware artifacts are discoverable and downloadable from the UI with labels that match `qmk_generator.py`'s actual output; no unverified competitive claim ships. Docs updated.

---

## 4. Out of scope for Codex (founder-owned / later)

- **Provisioning + deploy** (Neon Postgres, Cloudflare R2 bucket, Fly, domain, Resend/Postmark email, Sentry DSN) — founder-only; this is the make-or-break Phase 1 gap but not a coding task.
- **Async worker infrastructure** — required before Slice 5's deep fab outputs and before long Meshy generations on hosted infra (roadmap item 7). Can be its own later track.
- **Billing enforcement (Stripe)** — instrument now (Slice 4), enforce later.
- **New product families, OAuth, team/multi-user, marketplace** — post-MVP.

## 5. Suggested order & why

1. **Slice 1 (Evidence tab)** — highest trust-per-effort; pure surfacing of existing data.
2. **Slice 3 (Intent + sample)** — the TTFB lever; makes the product feel useful on first contact.
3. **Slice 2 (Autonomy legibility)** — small, sharpens the trust story.
4. **Slice 4 (Metrics)** — so the hosted alpha reads as an experiment the moment it deploys.
5. **Slice 5 (Firmware clarity)** — gated on research; do the safe surfacing, hold the claims.

Each merged slice keeps the product shippable. Stop and ask the founder if any slice would require breaking rules 5–8.
