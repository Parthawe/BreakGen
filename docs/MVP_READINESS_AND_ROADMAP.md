# BreakGen MVP Readiness & Roadmap

> Consolidated, ground-truth assessment of everything still pending for BreakGen to be a *good* MVP — backend, operations, security, and design/polish — plus a sequenced roadmap.
> Assessment date: 2026-06-29. Verified against the code, not the docs. Hosted-alpha prep is merged to `main`; 197 server tests plus 5 frontend tests pass on the Phase 2 observability/test branch.

## The one-sentence truth

The core promise — **create a constrained device → edit state → compile evidence → validate → export a revision-linked bundle** — is genuinely *real and works*, but only on the founder's laptop (localhost + SQLite + local disk + a hand-seeded account). It has **never been deployed**, so no real alpha user can touch it. That gap, not missing features, is what separates "impressive prototype" from "good MVP."

## What "good MVP" means here (the bar)

An **invited alpha user**, in their own browser on **hosted** infrastructure, can sign up → run the full loop → get a trustworthy bundle; the **founder can see and operate** it; and **nothing in the product over-claims**. Recommended scope: go deep on **keyboard + macropad**, keep streamdeck/midi/gamepad as clearly-labeled proof paths, defer everything else.

## Reality check — the code is AHEAD of the docs (verified 2026-06-26)

A line-by-line read found several items that earlier audits (and an earlier draft of this doc) listed as "pending" are **already implemented**. Trust the code, not the prose. Confirmed DONE:

- **Rate limiting** — `server/services/rate_limit.py` applied to auth (signup/login), generation, export, compile (pcb), geometry, and launch leads, with per-scope limits + per-project quotas (`config.py:44-52`). *Caveats below — it has real bugs.*
- **Layout payload caps** — `LayoutSpec.keys/elements` use `max_length`, plus a combined `MAX_LAYOUT_PAYLOAD_ITEMS` pre-parse guard (`models/project.py:199-209`). The "unbounded → OOM" claim was false.
- **R2 object storage transport** — real boto3 `upload_file`/`get_object`/`head_object`/paginated delete (`services/artifact_storage.py`); `boto3>=1.43.36` is a dependency. The "R2 config-only/rejected" claim was false. *Residual bug below.*
- **Alembic migrations** — `assert_database_migrated` runs in production startup (`main.py:29`); `git log` shows "Add Alembic migration discipline."
- **Health + readiness probes** — `/api/health` and `/api/readiness` both return **503** when the DB is down (`main.py:145-154`). The "health always 200" claim was false.
- **CSP `ws://localhost` in prod** — false; localhost/websocket sources are `settings.debug`-gated (`main.py:67-73`).
- **Artifact download owner-scoping** — correct; `download_project_artifact` enforces ownership via `load_project_state(..., owner_user_id=...)` then a project-scoped artifact lookup. No IDOR.

**Lesson for collaboration:** subagent audits in this repo have been unreliable (they missed rate-limiting, R2, probes, payload caps). Verify claims against code before acting.

## Confirmed bugs in current code (the real "mistakes")

These are verified by reading the code, not speculation. Severity in brackets.

> **STATUS (commit `2179c7c` + hosted-alpha prep branch, 2026-06-29):** #1, #2, #3, #5, #6, #7, and #8 are **FIXED with tests** (trusted-proxy rate-limit gating; `IntegrityError`→409; streaming R2 downloads; FK cascade migration; request body cap; dummy-hash login compare; stabilizer scope). The firmware "bugs" were fabricated and retracted. **Still open:** #4 (per-worker limiter → Redis, only matters past one instance).

1. **[HIGH] Rate-limit bypass + memory-DoS via spoofable `X-Forwarded-For`.** `client_rate_key` takes the leftmost client-supplied XFF value (`services/rate_limit.py:20-27`). An attacker rotates the header per request to get a fresh bucket → auth brute-force protection is fully defeated. Same vector grows the in-process `_rate_events` dict without bound (keys are never evicted) → memory exhaustion. *Only safe if a trusted proxy overwrites XFF — there is no trusted-proxy config.* Fix: trust XFF only from a configured proxy hop (or use the rightmost trusted value) and cap/evict the key map.
2. **[MED-HIGH] Optimistic-lock race surfaces as an unhandled 500.** `commit_project_mutation` does `db.refresh(row)` + revision compare with **no `with_for_update`** (`services/project_state.py:137-146`); two concurrent edits both pass, then collide on the `uq_project_revision` unique constraint, raising `IntegrityError` that **nothing catches** (zero `IntegrityError` handlers in the codebase) → HTTP 500 instead of a clean 409. The unique constraint prevents data corruption (the saving grace), but the intended optimistic-lock path is not actually atomic. Fix: `SELECT … FOR UPDATE` on load, or catch `IntegrityError` → 409.
3. **[MED] R2 downloads buffer the whole artifact into memory.** `download_project_artifact` for non-local backends returns `Response(content=read_artifact_bytes(...))` (`api/records.py:177-181`), which does `body.read()` on the full object. A 64 MB mesh or large export ZIP is loaded entirely per request — no streaming, no presigned-URL redirect (despite docs promising "signed download URLs"). Fix: issue a presigned GET URL or stream.
4. **[MED] In-process rate limiter is per-worker.** Acknowledged in its own docstring. Under multi-worker/multi-instance hosting the effective limit = limit × workers and resets on deploy. Needs Redis (or similar) before horizontal scaling.
5. **[MED] DB-level cascade.** **FIXED** on the hosted-alpha prep branch with SQLAlchemy `ForeignKey` declarations, Alembic migration `0002_add_foreign_keys`, SQLite FK enforcement, and cascade tests.
6. **[LOW-MED] Request-body size cap.** **FIXED** on the hosted-alpha prep branch with `BREAKGEN_MAX_REQUEST_BODY_BYTES` and 413 middleware. Residual hardening later: add field-level size limits for the largest free-form dict/string fields.
7. **[LOW] Login user-enumeration timing oracle.** When the email doesn't exist, bcrypt is skipped (`api/auth.py:266-275`), so a missing email responds measurably faster than a real one. Fix: always run a dummy bcrypt compare.
8. **[LOW, debatable] Stabilizer check warns on wide non-key controls.** **FIXED** on the hosted-alpha prep branch by checking `KEY_SWITCH` elements when the generic layout view is available, with a wide-button regression test.

> **RETRACTED — two false "bugs" from a subagent audit (do not act on these):** an earlier draft listed "[HIGH] firmware pin truncation" and "[MED] ATmega32u4 always emits RP2040." Both were **fabricated** — the subagent quoted constants (`RP2040_ROW_PINS`/`RP2040_COL_PINS`) that **do not exist** in `qmk_generator.py`. Verified against the venv: the real code uses `CONTROLLER_QMK_PROFILES` keyed by `project.pcb.controller` (RP2040→26 pins, ATmega32u4→`atmega32u4`/`caterina`/18 pins) and **raises `ValueError` if `rows+cols` exceed the pin budget** — no truncation, no hardcoded MCU. This is the second unreliable subagent audit in this repo; it is *why* the verify-before-acting rule exists.

**Verified CORRECT (not bugs):** controller/firmware profile selection + over-budget guard; export bundler SHA-256/zip handling; `matrix_compiler` clustering/counts; `_balanced_matrix` pin minimization; `plate_generator` geometry. (These "it's fine" claims came from the same low-trust agent — treat as provisional, re-verify if touched.)

---

## Pending items (the big list)

Severity: **P0** = blocks a real user using it at all · **P1** = needed for a trustworthy/operable alpha · **P2** = credibility & polish · **P3** = post-MVP depth.

### A. Hosting & infrastructure — *the unlock* (P0)
1. **No provisioned hosted backend yet.** A production Docker path, migration entrypoint, Fly config, and hosted-alpha runbook now exist. Remaining work is provisioning Postgres/R2/Fly secrets and deploying. **This is the single make-or-break gap.**
2. ~~Postgres + Alembic migrations~~ — **DONE** (Alembic + `assert_database_migrated`; SQLite rejected in prod). Remaining: a managed Postgres (Neon/Supabase) actually provisioned and the migration run wired into deploy.
3. ~~R2 artifact transport~~ — **DONE** (boto3 transport). Remaining: fix the buffer-whole-file download (bug #3) and provision a real bucket.
4. **Production secrets/config.** Real JWT secret, Meshy key, DB URL, explicit CORS origins. Guardrails exist; real values don't. *(operator task)*
5. **Backups & durability.** No backup automation. Single disk/bucket failure = total loss of projects, revisions, exports, leads. → Postgres PITR + R2 lifecycle/replication.
6. ~~Health/readiness probes~~ — **DONE** (`/api/health` + `/api/readiness`, 503 on DB down).

### B. Long-running work (P0/P1)
7. **Async worker boundary.** Generation and compiles run *inside the request*; real Meshy generation takes minutes → request timeouts on hosted infra. Jobs are poll-tracked records with no executor. → Add a worker (separate process/queue) for generate + compile + export.
8. **Job progress UX.** Surface real job status/progress instead of disabled buttons.

### C. Security & abuse hardening (P0/P1)
9. ~~Rate limiting~~ — **DONE** (auth/generation/export/compile/geometry + quotas), **but has real bugs** — see Confirmed bugs #1 (XFF spoof bypass) and #4 (per-worker only). Those must be fixed before hosting.
10. ~~Payload/size caps~~ — **DONE** for list counts and request body bytes. Residual later: bound largest free-form string/dict fields.
11. **CSP.** Only residual nit is `style-src 'unsafe-inline'` (low). The "`ws://localhost` in prod" claim was false (debug-gated).
12. **Signup trust.** Anyone can sign up with anyone's email (no verification) — see D.

### D. Account lifecycle & email (P1)
13. **Transactional email — none.** No SMTP/Resend/SES/Postmark anywhere. Blocks invite, welcome, export-ready, reset.
14. **Password reset / recovery — none.** Forgotten password = locked out forever.
15. **Email verification — none.**
16. **OAuth social login — stubbed** (Google/Apple return `enabled=false`). *Optional for MVP.*

### E. Operator & observability (P1)
17. **Operator dashboard.** Only a CLI snapshot (`server/scripts/operator_snapshot.py`); no web view of leads/users/projects/jobs/failures/exports.
18. ~~Structured logging + request IDs~~ — **DONE in code** on the Phase 2 observability branch: every HTTP response gets `X-Request-ID`, logs include request id/method/path/status/duration/client IP, and logs emit JSON lines.
19. ~~Error tracking (Sentry)~~ — **DONE in code** on the Phase 2 observability branch: env-gated `sentry-sdk` integration with `BREAKGEN_SENTRY_DSN`. Remaining: provision the Sentry project and set the DSN in hosting secrets.
20. **Uptime/metrics monitoring.**

### F. Data integrity (P1)
21. ~~DB-enforced cascades / FK constraints~~ — **DONE** on the hosted-alpha prep branch.
22. **Artifact cleanup TOCTOU.** Crash after DB delete but before filesystem delete leaks artifact files.
23. **Multi-step mutation atomicity.** Wrap revision+artifact+job writes in an explicit transaction (`async with session.begin()`).

### G. Design & polish — credibility (P2)
*Foundation is good: real CSS-variable design system, light/dark/system theming, coherent nav/breadcrumbs, designed empty states, good error banner, real Three.js preview (not a placeholder cube), polished landing.* Gaps:
24. ~~Loading states for async actions~~ — **DONE in code** on the premium action feedback branch: generate, electronics compile, mechanical compile, validation, and export now show inline action runways instead of only disabled buttons.
25. ~~Toast/notification system~~ — **DONE in code** on the premium action feedback branch: global toast deck with success, info, warning, and error feedback is wired into save, generate, asset actions, compile, validation, export, downloads, and billing-interest capture.
26. **Mobile workspace.** Landing/auth/project-list are responsive; the core editor + 3D preview are likely broken < 768px.
27. **Inline form validation.** Auth and key-properties inputs lack field-level error messages / `aria-describedby`.
28. **Accessibility.** Missing icon alt text/`<title>`, 3D canvas has no accessible name, errors not associated with inputs, possible contrast failures on tertiary text.
29. **Micro-polish.** Inconsistent transitions/hover depth, varying icon sizes, some verbose/unclear copy.
30. ~~Frontend tests — zero~~ — **DONE for unit/component test scaffolding** on the Phase 2 observability branch: Vitest + Testing Library + jsdom, initial API-helper and theme-switcher tests, and CI runs `pnpm test` before build. Remaining later: Playwright smoke tests for the core create→edit→export flow.
31. **Component internals audit.** Confirm SwitchExplorer, PCBPanel, TemplateSelector, KeyProperties, MechanicalReviewPanel have no dead/TODO handlers.

### H. Public surface & growth (P2)
32. **SEO/meta.** No robots.txt, sitemap, OG tags, meta description, or per-page `<title>`. Shared links show no preview.
33. **Legal/compliance.** No privacy policy, terms, or cookie consent — yet PostHog/Plausible load **unconditionally** (GDPR/CCPA exposure).
34. **Onboarding.** Empty app on first login; no sample project, guided first-run, or seeded starter content.

### I. API & repo hygiene (P2)
35. **API versioning.** Unversioned; add `/v1` before any external client depends on it.
36. ~~Dependabot/Renovate~~ — **DONE** with Dependabot for GitHub Actions, server Python dependencies, and client npm dependencies.
37. **Repo state.** 3 audit docs are deleted-but-uncommitted; decide commit vs restore. Consider consolidating the ~16 planning docs.

### J. Product depth — post-MVP (P3)
38. **Generation provider live** (set Meshy key) *or* an explicit "preview-only" UX so the appearance step isn't silently placeholders.
39. **Gerber/drill** via a KiCad worker (currently metadata-only).
40. **Supplier-ready BOM** (currently review-grade with sourcing gaps).
41. **Enclosure STL/STEP** via CadQuery (currently panel DXF + proof shell only).
42. **`prototype_ready` export state** — only after 39–41 are real.
43. **Billing** instrumentation → enforcement (Stripe); usage events already captured.

---

## Roadmap (sequenced)

### Phase 0 — Decide & tidy (≈2 days)
- Lock MVP family scope (recommend keyboard + macropad deep; rest = labeled proof).
- Resolve the uncommitted doc deletions; fold scattered plans into this file.

### Phase 1 — Real hosted alpha *(the make-or-break, ≈1–2 weeks now that infra primitives exist)*
Provision managed Postgres + R2 bucket · deploy API/client as one service · production secrets/CORS · backups (PITR + bucket lifecycle) · keep one worker until rate limiting moves to Redis.
**Exit:** an invited user runs the full loop in a browser on hosted infra; artifacts persist in R2; nightly backups verified.

### Phase 2 — Trust & operate *(≈2–3 weeks)*
Worker boundary for future long-running KiCad/CadQuery/export work · Sentry + structured logs + request IDs (code complete; DSN required in deploy) · operator web dashboard · transactional email (invite/verify/reset/export-ready) · atomic multi-step artifact/job writes where needed.
**Exit:** founder can see every signup/job/failure; long jobs don't time out; accounts are recoverable.

### Phase 3 — Credible UX & growth *(≈2 weeks)*
Loading states + toasts (code complete) · mobile workspace · inline form validation · a11y pass · onboarding + sample project · SEO/OG/meta · legal pages + cookie consent · first client smoke tests.
**Exit:** the product feels finished and trustworthy to a first-time user; analytics is consent-gated.

### Phase 4 — Depth *(post-MVP, parallelizable)*
KiCad Gerbers → supplier BOM → CadQuery enclosure → `prototype_ready` · API `/v1` · billing · OAuth · marketplace.

---

## Experience plan — research-grounded (2026-07-06)

> Synthesis of both verified research passes (`docs/COMPETITIVE_RESEARCH_2026_07.md`), the positioning patterns extracted from the AI-CAD landscape, and the "narrow product compiler" framing. This section answers one question: **what makes BreakGen a tool people actually use** — and maps each move onto the existing phases rather than creating a competing roadmap. Every move cites its evidence verdict; nothing below rests on a refuted or unverified claim.

### North star

**Time-to-first-trusted-bundle (TTFB):** an invited user goes from described intent to a validated, revision-linked export bundle, in their own browser, in under 15 minutes. Speed-to-artifact is the verified universal hero claim in this category (pattern P2); *trusted* is BreakGen's twist on it — the deterministic compiler + evidence lineage is what the AI-CAD players can't claim and the hobbyist chain doesn't attempt.

**The category boundary claim (pattern P1):** theirs is "real CAD, not meshes." Ours is **"evidence, not renders"** — a compiled, validated, revision-linked build, not an AI-shaped guess and not an un-routed PCB. Lead with it everywhere: landing, onboarding, export screen, README.

### The moves

**Move 1 — Intent-to-proposal first-run** *(verdict: Supported · lands in Phase 3, replaces roadmap item 34)*
Replace the empty first-login with intent capture: describe the control surface in plain language (or pick a template) → BreakGen proposes family + template + constraints → the user lands in a project that already compiles. Ship a seeded sample project (the `yc_proof_streamdeck` proof) so the workspace is never empty. Raven and Zoo validate the intent→parametric pattern; the incumbent gap is the timing. Success = median TTFB under 15 min for invited users.

**Move 2 — The evidence surface** *(verdict: trust feature, NOT a pricing lever · Phase 3)*
The provenance machinery already exists in data (revisions, artifact IDs, SHA-256, validation lineage). Make it a first-class **Evidence tab** per project: a timeline of revision → compile → validation → export, each entry with its artifact ID, checksum, and readiness tier, plus honest "what this bundle is / is not" copy. The verified practitioner skepticism (no AI tool is yet a pro-CAD substitute; "meshes called CAD") is the adoption barrier for everyone else — BreakGen wins by making trust visible. **Cosmos lesson applied: provenance and validation stay free forever;** the one proven paid layer in this exact niche is cosmetic, so never paywall correctness.

**Move 3 — Labeled autonomy gradient** *(steal PTC Creo 13's Advise/Assist/Automate pattern · Phase 3)*
BreakGen's core principle — AI at the appearance layer, deterministic compilers at the engineering layer, AI assets not canonical until accepted — is already the trust architecture the incumbents are converging on. Make it legible in the UI with three labeled tiers:
- **Advise** — explain validation results, suggest fixes (LLM, read-only)
- **Propose** — AI appearance/layout proposals, visibly marked "proposed — not in your build" until accepted into a revision
- **Compile** — the deterministic engineering layer, never AI
Also close roadmap item 38 here: live generation on hosted infra *or* explicit "preview-only" labeling — no silent placeholders.

**Move 4 — Jobs as experience** *(Phase 2 items 7–8, framed as UX)*
The worker boundary isn't just infra: real progress states for generate/compile/export, and an "export ready" email (rides the Phase-2 transactional-email work). A tool feels useful when long work is visible, not when buttons are disabled.

**Move 5 — Close the firmware + fab handoff gap** *(the differentiation layer · Phase 4, resequenced)*
Verified: Ergogen — the domain's leading config tool — has **zero** firmware/validation/fab-bundle scope. That unoccupied layer is where BreakGen's story lives. Sequence: QMK/VIA-ready firmware artifacts as first-class bundle members (cheapest unoccupied layer, firmware-facing maps already exist) → KiCad worker for Gerbers (item 39) → supplier BOM (40) → enclosure STL/STEP (41) → `prototype_ready` (42). **Precondition:** run the focused follow-up on how far Cosmos/QMK Configurator/VIA actually go (open question 3 — the 0-3 refutation bounds our differentiation claim). Do not write the fab-gap story into marketing until that lands.

**Move 6 — Context manager, BreakGen-style** *(verdict: Supported — Leo AI validates knowledge-grounding demand · Phase 4)*
Ground proposals in what the user actually has: the hardware source catalog, a "parts I have" inventory (switches, controllers), and their past projects — and only propose configurations that validate. Kyrall's Context Manager and Leo's PLM grounding are the verified enterprise-moat pattern (P3); BreakGen's maker-scale version is inventory- and catalog-grounding.

**Move 7 — Pricing experiment, not billing** *(anchors verified · Phase 4)*
Keep billing-intent telemetry running; build no billing until hosted usage data exists. When it comes, the verified shape: **free tier = full engineering loop with quotas** (validation/provenance never gated) · maker tier in the **$10–20/mo band** (Raven $9.99–99, Kyrall €20/mo) metered on generation credits (pattern P5) · premium carries **appearance/cosmetic + convenience** (the Cosmos-proven willingness-to-pay), staying under Onshape's $1,500/yr floor. The hosted alpha *is* the demand experiment the research couldn't find data for — set explicit thresholds (activation %, export %, billing-intent CTR) before calling the wedge proven.

### Metrics to instrument (usage events already exist)

TTFB · activation (first validated revision) · export rate per project · revision depth (return editing) · billing-intent CTR · weekly returning builders.

### Risks the research makes explicit

1. **The window is time-limited.** PTC signaled geometry agents for 2026; Zookeeper already ships editable parametric B-rep. Response: Phase 1 deploy urgency, and *no family expansion* — keyboard + macropad deep, everything else stays labeled proof.
2. **Demand is unproven.** Zero market-size/WTP claims survived verification on either pass. Response: treat the hosted alpha as the experiment, with kill/expand thresholds, not as a launch.
3. **This repo's own failure mode is unverified claims.** Response: every public claim traces to actual bundle contents (existing principle), and strategy docs cite only verified findings.

---

## Plan for further collaboration (how we work this down)

The codebase is healthier than the docs implied; the failure mode here is **drift and unverified claims**, not bad code. The collaboration model is built to kill both.

### Operating rules
- **Verify before trusting.** Every "done" is backed by a test or a code citation, never a subagent's summary. (This pass caught 6 false "missing" claims.)
- **Docs ship with code.** When a feature lands, `README` + `docs/CURRENT_STATE.md` update in the *same* change. Consolidate the ~16 planning docs down to this file + `CURRENT_STATE` to stop the drift.
- **Branch + PR, not main.** Move off direct-to-`main`. Each slice = a branch + a reviewable diff; I add the `Co-Authored-By` trailer.
- **CI gate.** **DONE** on the hosted-alpha prep branch: backend pytest plus frontend TypeScript/Vite build on push/PR, with Dependabot.
- **Definition of done per slice:** code + test + docs updated + verified via `make demo-proof`, the test suite, and (post-hosting) a hosted smoke test.

### Division of labor
- **I (Claude Code) own:** scoped implementation, tests, audits, bug fixes, the doc-sync, design/polish passes. I work on a branch and hand you a diff.
- **You (founder) own — these block hosting and only you can do them:** provision **Neon/Supabase Postgres**, **Cloudflare R2 bucket**, a **deploy target** (Fly/Render/Railway), **Resend/Postmark** (email), **Sentry** (errors), domain + secrets; and the **product calls** (family scope, what counts as "supported," who the first invited users are).

### Suggested working sequence
1. **Now — code-only quick wins (no accounts needed):** confirmed bugs #1, #2, #3, #6, #7 + the compiler/validation findings from this pass. All small, testable, high-value. *I can start immediately.*
2. **You provision** the Phase-1 accounts (Postgres, R2, deploy, email, Sentry) — I'll give you an exact shopping list + env template.
3. **Phase 1 hosting** together: I wire deploy + migrations + secrets; we run the hosted smoke test.
4. **Phase 2/3** slices one at a time off the roadmap, each as its own PR.

### Cadence
Pick one slice → I scope + implement on a branch → you review the diff → we verify → merge → update docs. Repeat. Keep exactly one slice in flight so the product never half-lands a feature.

## Launch checklist (definition of done for "good MVP")
- [ ] Invited user signs up + runs create→edit→compile→validate→export on hosted infra
- [ ] Postgres + migrations + verified nightly backups
- [ ] Artifacts in R2 with owner-scoped streaming downloads
- [ ] Long-running provider/CAD jobs have a worker path before they exceed hosted request limits
- [ ] Rate limits + payload/body caps + CSP hardened; no committed secrets
- [ ] Password reset + email verification working
- [ ] Operator dashboard live; Sentry DSN provisioned; request-correlated logs visible in hosting
- [ ] Loading states and toasts shipped; mobile workspace and form validation still pending
- [ ] Privacy/terms/consent live; analytics gated
- [ ] Every public claim matches what an exported bundle actually contains
