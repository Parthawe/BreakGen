# BreakGen Startup Operating System

> The company plan for turning BreakGen from a strong MVP into a real private-alpha product.

## Operating Thesis

BreakGen should not be presented as "AI for hardware." The sharper company is:

> BreakGen is the intent compiler for custom programmable devices.

The wedge is not broad hardware automation. The wedge is constrained control-surface products where creators already improvise across Thingiverse files, CAD edits, firmware snippets, and manual build notes:

- macro pads
- stream deck style controllers
- MIDI controllers
- compact gamepad/control surfaces
- keyboard-adjacent devices

The product wins if a user can move from intent to a revisioned device record, then compile trustworthy build evidence: layout, electronics metadata, mechanical artifacts, validation, export bundle, and provenance.

## Current Company Stage

BreakGen is in private-alpha preparation.

What exists:

- authenticated FastAPI backend
- React public site and demo workspace
- canonical project records with revision snapshots
- product families and templates
- electronics and mechanical compile paths
- validation, artifact, job, and export records
- deterministic reviewer proof command
- public GitHub Pages frontend

What is not yet company-complete:

- hosted backend and production database
- migration discipline
- production observability and backups
- private-alpha user operations
- pricing and billing instrumentation
- real support workflow
- analytics around activation and export intent
- fabrication partner or BOM workflow
- repeatable YC demo script with live hosted API

## North Star

The north star is not "projects created." That is too shallow.

Primary metric:

> Review-ready exports and physical build attempts per active maker per week.

Supporting metrics:

- percent of new users who create a project
- percent who run validation
- percent who compile mechanical artifacts
- percent who export a bundle
- percent of exports tied to passing validation
- median time from project creation to first export
- number of user-reported build attempts
- number of build attempts that become successful physical prototypes

## YC Application Story

The YC story should be direct:

1. People already want one-off programmable devices.
2. The current workflow is fragmented across file-sharing, CAD, firmware, and comments.
3. BreakGen turns that workflow into a product compiler with provenance.
4. The MVP starts with control surfaces because they are useful, constrained, and common.
5. The expansion path is a platform of domain compilers, not a generic CAD toy.

Do not overclaim:

- Do not claim factory-ready manufacturing.
- Do not claim arbitrary hardware generation.
- Do not claim AI is doing engineering truth.
- Do not claim all product families are equally mature.

Claim:

- constrained programmable-device authoring
- deterministic compiler-backed build evidence
- revisioned project state
- artifact lineage
- private-alpha workflow for makers and hardware founders

## Workstreams

### Product

Owner goal:

> Make one user journey feel inevitable: template to validated export.

Priority sequence:

1. Improve first-run project creation.
2. Make the next action obvious after each step.
3. Add visible validation/export readiness state.
4. Add build guide preview before export download.
5. Add template comparisons that map to real user goals.

Acceptance criteria:

- A new user can create a macro pad or stream deck project without reading docs.
- The UI shows what has been compiled, what is stale, and what is ready.
- Export readiness cannot be confused with a decorative render.

### Backend

Owner goal:

> Keep canonical truth, ownership, provenance, and exports correct under real use.

Priority sequence:

1. Keep project-scoped routes authenticated and owner-filtered.
2. Add migration tooling before hosted production data matters.
3. Add artifact download APIs by artifact id.
4. Add audit events for sensitive actions.
5. Move long-running compile/provider tasks to a worker queue.

Acceptance criteria:

- Cross-user project access returns 404.
- Production refuses unsafe secrets and unsafe CORS settings.
- Every generated durable output has a registered artifact row.
- Every provider-backed job has a durable job row.

### Manufacturing Truth

Owner goal:

> Make exports more useful than a ZIP of files.

Priority sequence:

1. Add BOM/build notes to export manifests.
2. Add case/enclosure constraints to macro pad and stream deck templates.
3. Add mounting, screw, USB, feet, and clearance notes.
4. Add printer/material assumptions to build guides.
5. Add fabrication preset profiles after real prototypes exist.

Acceptance criteria:

- Export bundles include build assumptions, not just geometry.
- Validation distinguishes "candidate", "review ready", and future "prototype ready" states.
- Claims in the public site match actual generated artifacts.

### Prototype-Backed Kickstarter

Owner goal:

> Turn one physically proven BreakGen output into a narrow campaign, not a broad platform preorder.

Kickstarter is a fit only after BreakGen can show a working prototype, real photos or video, pilot-build learnings, supplier assumptions, and an honest production plan. The first campaign should be one focused kit, most likely a split macro pad or creator command console, because those stay closest to the current compiler, footprint catalog, firmware metadata, and enclosure path.

Readiness gates:

1. One hero device selected.
2. Working prototype filmed.
3. Ten pilot units attempted.
4. Cost model includes PCB, case, switches/modules, packaging, failed units, and shipping buffer.
5. Pre-launch list and updates prove interest before the campaign goes live.
6. Risks explain prototype, manufacturing, firmware, supplier, and fulfillment uncertainty.

### Growth and GTM

Owner goal:

> Find 20 users who already tried to build custom devices and make them export something.

Channels:

- Thingiverse and Printables makers who publish macro pads/controllers
- Reddit communities around mechanical keyboards, MIDI controllers, stream decks, and DIY electronics
- university creative technology labs
- hardware founders building demo devices
- small creators who sell shortcut decks or desk gadgets

Manual outreach script:

> I am building BreakGen, a compiler for custom programmable devices. I saw your macro pad/controller build and wanted to ask: what was the most annoying part between layout, enclosure, wiring, firmware, and sharing files? I can show you a private alpha that turns a device idea into revisioned build evidence and exports.

Weekly target:

- 50 targeted maker messages
- 10 conversations
- 5 alpha invites
- 2 completed project exports
- 1 physical build attempt

### Finance

Owner goal:

> Keep the burn tiny while proving willingness to use and eventually pay.

Near-term pricing hypothesis:

- Free private alpha for selected users.
- Paid maker plan later: $12-19/month for private projects, advanced exports, and artifact history.
- Pro/prosumer plan later: $39-79/month for teams, version history, fabrication presets, and priority compute.
- Future marketplace/take-rate only after project creation and export usage are real.

Do not build billing before activation is proven. Do instrument billing intent:

- export count
- private project count
- accepted asset count
- provider generation count
- artifact storage usage
- requests for team/shared projects

### Operations

Owner goal:

> Make private-alpha usage supportable by one founder.

Minimum operator workflow:

1. Seed or invite user.
2. Watch whether they create, validate, and export.
3. Review logs and records for failed jobs.
4. Follow up with the user within 24 hours.
5. Convert their issue into a product backlog item.

Minimum support labels:

- account access
- project creation
- template mismatch
- validation confusion
- compile/export failure
- fabrication/build feedback
- billing/pricing interest

## Six-Week Execution Plan

### Week 1: Hosted Private Alpha Foundation

- Deploy backend with production env settings.
- Configure frontend to point at hosted API.
- Add production database and migrations.
- Add basic health, logs, and backup plan.
- Run `make demo-proof` against hosted-like settings.

Exit criteria:

- One seeded reviewer can sign in to the hosted product and export a bundle.

### Week 2: Activation Loop

- Improve first-run flow.
- Add clearer validation/readiness states.
- Add build guide preview.
- Add analytics events for create, validate, compile, export.
- Start 50-person targeted outreach list.

Exit criteria:

- Five external users create a project.
- Two external users export a bundle.

### Week 3: Manufacturing Credibility

- Add BOM/build notes to export bundles.
- Expand case/enclosure constraints.
- Add template-specific assembly assumptions.
- Prototype one real macro pad or stream deck path.

Exit criteria:

- One export is physically attempted.
- Build feedback is captured as product requirements.

### Week 4: Reliability and Support

- Add audit events.
- Add artifact download endpoint.
- Add job failure visibility.
- Add private-alpha operator dashboard or admin script.
- Tighten tests around export lineage and access control.

Exit criteria:

- Founder can diagnose failed alpha sessions without direct DB spelunking.

### Week 5: Pricing Discovery

- Add pricing-intent prompts after repeated exports.
- Interview 10 users about payment trigger.
- Define first paid plan boundary.
- Keep billing unlaunched unless there is repeated demand.

Exit criteria:

- Three users can name a payment-worthy feature or workflow.

### Week 6: YC Demo Lock

- Freeze one golden demo path.
- Record live hosted demo.
- Prepare metrics snapshot.
- Prepare user quotes and build attempts.
- Prepare honest roadmap and risk answers.

Exit criteria:

- YC application can show product, proof, traction, and why now in under two minutes.

## Decision Rules

Use these rules when choosing what to build:

1. If it does not improve activation, export trust, or user learning, defer it.
2. If it creates artifact/job/provenance drift, reject it.
3. If it makes keyboard assumptions leak into shared platform code, redesign it.
4. If it improves public claims without improving product truth, do not do it.
5. If a user would pay only after physical prototype success, prioritize the build loop first.

## Company Backlog

P0:

- hosted backend
- production database and migration plan
- hosted frontend API configuration
- artifact download by artifact id
- build guide/BOM in export bundle
- activation analytics
- alpha invite/seed workflow

P1:

- worker queue for long jobs
- operator/admin visibility
- audit event log
- richer enclosure constraints
- first physical prototype feedback loop
- pricing-intent tracking

P2:

- billing
- teams/orgs
- marketplace/remix templates
- fabrication partner presets
- richer CAD outputs
- public self-serve onboarding

## Founder Dashboard

Track weekly:

- active alpha users
- new projects
- validations run
- mechanical compiles
- export bundles
- review-ready exports
- physical build attempts
- physical build attempts
- successful physical builds
- support issues by label
- provider spend
- storage size
- infra spend
- user conversations
- user quotes

The dashboard should bias toward learning, not vanity.

## What "Real Product" Means

BreakGen becomes real when:

1. A user can use it without founder intervention.
2. The backend keeps ownership and revision truth correct.
3. Exports include enough evidence to attempt a build.
4. The company can explain who uses it, why now, and what they do next.
5. The founder can operate support, costs, and user learning without chaos.
