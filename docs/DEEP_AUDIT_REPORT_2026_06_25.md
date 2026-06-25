# BreakGen Deep Audit Report - 2026-06-25

This report summarizes the current product, engineering, operator, designer, and customer-facing issues found during the latest audit pass.

## Verification Snapshot

- Backend tests: `161 passed`
- Frontend production build: passed
- Demo proof command: `make demo-proof` passed
- Proof result: project status stays `validated`, export readiness is `review_ready`, and artifacts are revision-linked with hashes
- Public proof snapshot: `/proof/yc-proof-streamdeck-summary.json`, `/proof/manifest.json`, `/proof/validation_report.json`, and `/proof/BUILD_GUIDE.md`
- Mobile overflow checks:
  - `/`: clean
  - `/demo/`: clean
  - `/manufacturing/`: clean
  - `/app/new`: only decorative background overflow remains
- Fresh screenshots: `artifacts/deep-audit-2026-06-25/`

## Already Improved In This Pass

1. Mobile public-page overflow was reduced and measured clean on the main public routes.
2. Mobile site navigation no longer exposes half-cut navigation items; it wraps into a compact grid.
3. Mobile hero typography is less likely to push past the viewport.
4. Auth/onboarding layout now has stronger `min-width: 0` and smaller mobile heading pressure.
5. The backend proof path now matches the product truth: review-ready exports do not pretend to be fabrication-complete.
6. Family readiness tiers now live in backend manifests and are consumed by the UI.
7. Legacy frontend `exported` project-status helpers were removed.
8. Launch lead capture now has persisted per-email rate limiting in addition to local burst protection.
9. The public site now links to inspectable proof metadata, validation, and build-guide artifacts from the deterministic demo run.
10. A read-only operator snapshot script now summarizes leads, projects, artifacts, jobs, and usage signals with masked lead emails by default.

## Priority Improvements

### P1 - Must Fix Before Serious External Alpha

1. **Move readiness tiers out of hardcoded UI copy**
   - Status: fixed after this audit. Backend manifests now expose readiness tier, label, and detail.
   - Current issue: family confidence is duplicated in the frontend while backend manifests use broader `enabled` / `proof` states.
   - Risk: customers may see a family as "live" even when the actual artifact coverage is only proof-grade.
   - Improve: add explicit backend fields such as `confidence_tier`, `readiness_label`, and `readiness_detail` to product family manifests.

2. **Remove legacy `exported` project status paths**
   - Status: fixed after this audit. Frontend project status helpers no longer map `exported` to `review bundle`.
   - Current issue: frontend helpers still map `exported` to `review bundle`, even though backend now keeps review-ready bundle projects as `validated`.
   - Risk: old vocabulary survives and can reintroduce claim drift later.
   - Improve: remove or quarantine `exported` as a historical status only; derive export UI from latest export artifact readiness.

3. **Implement real production artifact storage**
   - Current issue: R2 config validation exists, but artifact writes still behave as local file writes.
   - Risk: deployed users can lose artifacts on ephemeral storage or across hosts.
   - Improve: add a storage adapter that writes, reads, and signs downloads through R2 or another object store.

4. **Add production database migrations**
   - Current issue: production config rejects SQLite, but there is no complete migration story.
   - Risk: external alpha deploys become fragile and hard to upgrade.
   - Improve: add Alembic migrations, migration tests, and deploy runbook steps.

### P2 - Important Product/UX Improvements

5. **Simplify mobile navigation**
   - Current issue: mobile nav is now technically clean, but still too dense for first impression.
   - Risk: customers encounter product complexity before understanding the main offer.
   - Improve: use priority nav plus a menu; keep primary CTA visible.

6. **Make one golden demo path dominant**
   - Current issue: multiple families are visible, but the safest proof path is only explained in copy.
   - Risk: a reviewer can start in a weaker proof path and judge the whole product by it.
   - Improve: default public/private alpha flow to the strongest Stream Deck or keyboard proof, with other families secondary.

7. **Make public demo proof inspectable**
   - Status: fixed for the static reviewer snapshot. The actual ZIP remains reproducible via `make demo-proof`; public files expose the summary, manifest, validation report, and build guide.
   - Current issue: the public demo shows sample records, but does not link to a real generated proof bundle.
   - Risk: the trust layer is visible but not independently verifiable.
   - Improve: publish a real `make demo-proof` bundle and link manifest, validation report, hashes, and build guide.

8. **Improve launch lead operations**
   - Status: partially fixed. Rate limiting now includes a DB-backed per-email window; operator export/search remains open.
   - Current issue: lead rate limiting is in process memory.
   - Risk: weak under multiple API workers or restarts.
   - Improve: move rate limits to DB/Redis and add simple operator export/search for leads.

9. **Add usage and operator dashboards**
   - Status: partially fixed. A read-only CLI snapshot now exists; a richer authenticated operator UI remains open.
   - Current issue: usage rows exist, but there is no operator surface for export attempts, validation failures, active jobs, and high-intent users.
   - Risk: hard to learn from alpha users quickly.
   - Improve: build an internal operator page or script for leads, projects, exports, failures, and usage totals.

10. **Tighten fabrication vocabulary everywhere**
    - Current issue: the product is mostly honest now, but terms like `ready`, `proof`, `review_ready`, `validated`, and `export_ready` need one glossary.
    - Risk: claim drift across docs, UI, scripts, and investor/customer conversations.
    - Improve: define a single readiness vocabulary and use it in backend enums, frontend labels, README, and export manifests.

### P3 - Polish And Quality Improvements

11. **Reduce mobile hero density**
    - Current issue: mobile hero is now valid but still visually heavy.
    - Improve: slightly smaller type, shorter supporting copy, and earlier visual proof.

12. **Improve visual proof artifacts on public pages**
    - Current issue: generated UI-style device visuals are useful, but they still feel abstract.
    - Improve: add real screenshots of export manifest/build guide or real prototype photos when available.

13. **Budget the Three.js path**
    - Current issue: lazy chunks are okay, but `three-core` is large.
    - Improve: ensure public landing pages never load Three unless the demo/workspace needs it; monitor bundle regressions.

14. **Finish auth provider clarity**
    - Current issue: OAuth providers are shown as planned/configured states, but private alpha still relies on email/password.
    - Improve: make the login surface focus on the active path and keep planned providers visually secondary.

15. **Clean generated/local artifacts before PRs**
    - Current issue: `artifacts/` and `codex-note.txt` are untracked.
    - Improve: keep visual QA artifacts only when intentionally attached to review; otherwise exclude or clean before commit.

## Role-Based View

### Engineer

- Keep canonical state and artifact lineage as the first principle.
- Remove stale `exported` status helpers.
- Move readiness/confidence metadata to backend manifests.
- Add object-storage adapter and migrations.
- Keep tests around export readiness and artifact provenance.

### Designer

- Mobile is no longer broken, but still dense.
- Replace crowded mobile nav with a cleaner menu pattern.
- Give the safest proof path stronger visual dominance.
- Use more tangible proof visuals, not only abstract interface art.

### Operator

- Add lead, usage, validation failure, export, and job monitoring.
- Move launch rate limits out of process memory.
- Write production runbooks for database, storage, backup, and seeded reviewers.
- Decide which screenshots/artifacts belong in repo history.

### Customer

- Make it obvious which family is safest today.
- Show proof bundle contents before asking for trust.
- Avoid any language that sounds fabrication-complete unless the package truly includes fabrication outputs.
- Make the first mobile impression simpler.

## Recommended Fix Order

1. Add object storage adapter.
2. Add Alembic migrations.
3. Replace mobile nav with compact menu.
4. Promote the operator snapshot into an authenticated operator UI if alpha volume justifies it.
5. Tighten readiness vocabulary across docs/UI/API.
