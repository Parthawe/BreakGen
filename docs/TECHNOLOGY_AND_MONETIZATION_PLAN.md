# BreakGen Technology and Monetization Plan

> How BreakGen should use current tools, free tiers, paid subscriptions, usage-based models, and external software without losing the product truth.

## Strategy

BreakGen should integrate technology in layers:

1. Free or low-cost tools for private-alpha learning.
2. Open-source deterministic compilers for build evidence.
3. Usage-metered services only where the user action creates real variable cost.
4. Paid subscriptions only after repeated exports prove willingness to pay.
5. Fabrication integrations only after bundles are complete enough to send out.

This keeps the company cheap while making the product more real.

## What To Integrate First

### 1. Free/Low-Cost Infrastructure

Recommended alpha stack:

- hosted API service
- Neon or Supabase Postgres
- Cloudflare R2 artifact storage
- GitHub Pages/public demo
- GitHub Actions CI

Why:

- BreakGen already has a FastAPI backend, project records, artifact records, and export bundles.
- The next operational problem is hosted persistence and artifact storage, not a broader frontend.
- Neon and Supabase both have free-tier paths for early validation.
- Cloudflare R2 is a good fit for export ZIPs and generated artifacts because object egress bandwidth is not billed separately.

Implementation order:

1. Add Alembic migrations.
2. Add Postgres driver and production database URL support.
3. Add object-storage abstraction behind artifact registry.
4. Keep artifact downloads owner-scoped through registry rows.
5. Add backups before external alpha users store meaningful data.

Sources:

- Neon pricing: https://neon.com/pricing
- Supabase pricing: https://supabase.com/pricing
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/

### 2. Deterministic Build Software

Recommended compiler stack:

- KiCad CLI for Gerbers, drill files, and EDA outputs.
- CadQuery for parametric enclosure generation.
- OpenSCAD as a fallback for simple scripted printable geometry.

Why:

- BreakGen should keep AI at the exploration/appearance layer.
- Manufacturing truth needs deterministic compilers with recorded toolchain versions.
- Current exports are review-ready evidence bundles; KiCad and CadQuery are the path toward future prototype-ready bundles.

Implementation order:

1. Build a worker boundary for compile jobs.
2. Add toolchain manifest fields for compiler versions.
3. Generate Gerber/drill outputs for one control-surface family.
4. Generate enclosure STL/STEP-style artifacts for one macro pad or stream deck baseline.
5. Add validation checks for output completeness.
6. Only then introduce `prototype_ready` as a real export state.

Sources:

- KiCad CLI docs: https://docs.kicad.org/9.0/en/cli/cli.html
- CadQuery docs: https://cadquery.readthedocs.io/
- OpenSCAD docs: https://openscad.org/documentation.html

### 3. Billing and Subscriptions

Recommended sequence:

1. Stay free during private alpha.
2. Track usage signals.
3. Add pricing-intent prompts after repeated exports.
4. Choose billing provider once the paid boundary is clear.
5. Start with simple subscriptions plus credits, not complex marketplace billing.

Recommended billing candidates:

- Stripe Billing: best default for subscriptions, usage-based billing, invoices, trials, and customer portal.
- Lemon Squeezy: candidate if merchant-of-record simplicity matters more than deep billing control.

BreakGen pricing model:

- Free alpha: limited projects, limited provider generation, review-ready exports.
- Maker subscription: private projects, artifact history, higher export limits.
- Pro subscription: team/project history, advanced compilers, higher storage and generation limits.
- Usage add-ons: AI generation, large artifact storage, fabrication quotes, high-volume export runs.

What to meter:

- accepted generated assets
- provider generation jobs
- export bundles
- artifact storage
- worker minutes for CAD/EDA compile jobs
- team seats later

Do not meter:

- validation runs during early alpha
- public demo views
- failed jobs caused by platform issues

Sources:

- Stripe Billing docs: https://docs.stripe.com/billing
- Stripe usage-based billing: https://docs.stripe.com/billing/subscriptions/usage-based/advanced/about
- Lemon Squeezy usage-based billing: https://docs.lemonsqueezy.com/help/products/usage-based-billing

### 4. Fabrication and Distribution

Recommended integrations:

- GitHub Releases for public sample export bundles and demo proof artifacts.
- JLCPCB API later for quote/order handoff after full Gerber/BOM completeness exists.

Why:

- Public proof should be inspectable without requiring backend access.
- Fabrication integrations are dangerous before BreakGen can generate complete and validated manufacturing packages.

Implementation order:

1. Generate one real sample bundle from `make demo-proof`.
2. Attach sample bundle, manifest, validation JSON, and SHA-256 to a GitHub release.
3. Link those public proof artifacts from the landing/demo surface.
4. Add quote-only fabrication handoff after Gerber/BOM/enclosure completeness.
5. Add order placement only with explicit user confirmation and account-level controls.

Sources:

- GitHub Releases API: https://docs.github.com/rest/releases/releases
- JLCPCB API platform: https://api.jlcpcb.com/

## Product Architecture

BreakGen should represent integrations as platform manifests:

```text
integration id
category
status
pricing model
capabilities
BreakGen use
phase
risk notes
source URL
```

The repo now exposes these through:

```text
GET /api/platform/integrations
GET /api/platform/integrations?category=monetization
GET /api/platform/integrations?status=recommended
```

This makes the roadmap visible to the app without hardcoding billing or vendor decisions into project state.

## Free vs Paid Boundary

Free should cover:

- public demo
- limited private alpha
- a small number of private projects
- review-ready exports
- limited generation credits
- public proof bundle inspection

Paid should cover:

- private project history
- more projects
- higher export limits
- advanced CAD/EDA compilers
- artifact retention
- team workflows
- priority compute
- fabrication handoff

Usage-based add-ons should cover:

- provider generation costs
- large artifact storage
- expensive worker jobs
- fabrication quote/order workflows

## Subscription Model Options

### Option A: Simple Maker Subscription

Use when:

- users repeat exports
- users care about project history
- support load is still founder-manageable

Shape:

- Free alpha
- Maker plan
- Pro plan
- add-on credits later

This is the recommended first paid model.

### Option B: Subscription Plus Metered Usage

Use when:

- AI/CAD/EDA worker costs become meaningful
- users export repeatedly
- users accept credit-style limits

Shape:

- monthly base subscription
- included export/generation credits
- usage overage

This is the likely long-term model.

### Option C: Marketplace/Take Rate

Use when:

- users publish templates
- users remix proven designs
- there is enough template liquidity

Shape:

- paid verified templates
- creator payout
- BreakGen take rate

Defer this. A marketplace before repeated creation is premature.

## What Not To Add Yet

Do not add:

- public self-serve billing before activation
- one-click fabrication order placement before complete manufacturing artifacts
- random plugin marketplace
- many AI providers with no cost controls
- CAD integrations that let edited CAD become canonical truth

## Next Build Steps

P0:

- Add hosted API and production database plan.
- Add artifact storage abstraction.
- Add usage-event table fed from durable jobs/artifacts.
- Add real public sample proof bundle.
- Add KiCad/CadQuery worker design doc and first job interface.

P1:

- Add Stripe/Lemon Squeezy decision record.
- Add billing-intent events in product UI.
- Add BOM/build-note compiler.
- Add artifact download APIs.
- Add quota checks around provider generation and export jobs.

P2:

- Add paid plan enforcement.
- Add fabrication quote handoff.
- Add creator/remix marketplace.

## Current Recommendation

Use this stack for the YC-ready hosted alpha:

- API: FastAPI, deployed as one hosted service.
- DB: Neon Postgres first, Supabase only if managed auth/storage becomes desirable.
- Storage: Cloudflare R2.
- Billing: no billing yet; instrument Stripe-compatible usage events.
- CAD: CadQuery worker first.
- EDA: KiCad CLI worker after one family has a real PCB target.
- Distribution: GitHub Releases for public proof bundles.
- Fabrication: JLCPCB quote handoff later, not order placement.

