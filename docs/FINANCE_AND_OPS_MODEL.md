# BreakGen Finance and Operations Model

> A practical operating model for private alpha, YC, and the first paid product.

## Principle

BreakGen should stay cheap until the product proves repeated export behavior.

Do not spend like a hardware company before there is hardware pull. The early company should spend on:

- hosted product reliability
- user learning
- one or two physical prototype loops
- minimal provider credits
- basic legal/accounting hygiene

Avoid spending on:

- broad paid ads
- complex billing
- large cloud commitments
- fabrication partnerships before repeatable demand
- broad marketplaces before templates and exports prove usage

## Business Model Hypotheses

### Hypothesis 1: Maker Subscription

Customer:

- makers
- streamers
- musicians
- creative technologists
- keyboard and controller enthusiasts

Potential pricing:

- free: public demo, limited private-alpha projects
- maker: $12-19/month
- pro: $39-79/month

Paid trigger:

- private projects
- more export bundles
- artifact history
- advanced templates
- generation credits
- fabrication presets

Risk:

- makers may love the tool but resist subscription pricing.

Validation:

- ask after second export: "Would you pay to keep private project history and advanced exports?"
- track repeated export usage before launching billing.

### Hypothesis 2: Founder/Studio Pro Tool

Customer:

- hardware founders
- product designers
- small studios
- university labs

Potential pricing:

- $49-99/month per seat
- project packs
- team plan later

Paid trigger:

- repeatable prototype evidence
- version history
- collaboration
- export lineage
- support and priority compute

Risk:

- expectations may jump to professional CAD/EDA completeness.

Validation:

- interview hardware founders building demo devices.
- measure whether BreakGen shortens their first prototype loop.

### Hypothesis 3: Template/Remix Marketplace

Customer:

- creators who want proven device baselines
- makers who modify existing designs

Potential pricing:

- template sales
- creator marketplace take rate
- premium verified templates

Risk:

- marketplace before creation liquidity is premature.

Validation:

- wait until users repeatedly ask to reuse, remix, or publish templates.

## Cost Model

### Fixed Monthly Costs, Private Alpha

Target range:

- hosting API and database: $20-80
- artifact storage: $5-25
- monitoring/logging: $0-50
- domain/email/tools: $20-80
- accounting/legal reserve: $100-300

Goal:

- keep baseline burn under $500/month before paid users.

### Variable Costs

Main drivers:

- AI generation provider calls
- artifact storage
- outbound bandwidth
- prototype materials
- user support time

Controls:

- generation credits per alpha user
- artifact size limits
- provider key per environment
- manual approval for high-cost workloads
- delete or archive stale private-alpha artifacts after clear policy

### Prototype Budget

Monthly prototype budget:

- $100-300 before repeatable alpha demand

Use it for:

- one macro pad build
- one stream deck style build
- test fasteners, switch fit, USB clearance, panel tolerances

Do not use it for:

- broad inventory
- production runs
- custom PCBs before export demand is proven

## Metrics and Instrumentation

### Product Activation Metrics

Track:

- account created
- project created
- template selected
- layout edited
- asset accepted
- electronics compiled
- mechanical compiled
- validation run
- export bundle created
- export downloaded
- support issue opened

Activation definition:

> A user creates a project, runs validation, and exports a bundle.

Deeper success definition:

> A user attempts a physical build from an exported bundle.

### Revenue Intent Metrics

Track:

- second export by same user
- private project count
- request for project history
- request for team sharing
- request for fabrication help
- provider credit usage
- failed export recovery
- manual support time per user

Do not optimize for:

- page views
- raw signups
- demo opens without export intent

## Ops Workflow

### Alpha Invite

1. Identify maker/founder with existing custom-device pain.
2. Send short personal note.
3. Offer private-alpha access.
4. Seed or invite the account.
5. Ask them to build one concrete device.
6. Follow up within 24 hours after their first session.

### User Session Review

For each alpha user, record:

- user goal
- product family chosen
- where they stopped
- whether they validated
- whether they exported
- confusion points
- support issues
- payment signal
- physical build intent

### Support SLA

Private-alpha standard:

- same-day response for blocked exports
- 24-hour response for account/project issues
- 48-hour response for product questions

Support priority:

1. authentication or data access issue
2. failed export
3. validation false positive/false negative
4. compile failure
5. confusing UI
6. feature request

### Incident Process

Severity 0:

- leaked secret
- cross-user data access
- destructive project data loss

Action:

- disable affected endpoint or environment
- rotate secrets
- preserve logs
- write incident note
- fix before inviting more users

Severity 1:

- exports fail broadly
- validation or artifact lineage is wrong
- provider costs spike

Action:

- pause affected feature
- notify active alpha users if needed
- ship fix and regression test

Severity 2:

- UI confusion
- individual project issue
- provider job delay

Action:

- support the user manually
- backlog product fix

## Security and Compliance Baseline

Before hosted private alpha:

- production `BREAKGEN_JWT_SECRET` is non-default
- production `BREAKGEN_DEBUG=false`
- public signup disabled or invite-code gated
- CORS origins are explicit
- provider keys are environment-only
- no generated artifacts expose local server paths
- database backups are configured
- logs do not contain secrets

Before paid users:

- password reset
- logout/revocation
- rate limiting for auth
- migration discipline
- basic privacy policy
- terms of service
- data deletion request process
- billing provider webhook verification

## Finance Gates

### Gate 1: Do Not Charge Yet

Stay here while:

- fewer than 10 external users have exported
- no physical build attempt has happened
- support failures are mostly basic activation issues

Focus:

- learning
- activation
- trust

### Gate 2: Pricing Discovery

Enter when:

- 10 external users have exported
- 3 users have attempted physical builds
- 3 users ask for project history, private projects, team access, or advanced exports

Action:

- show pricing concepts manually
- ask what would make the product worth paying for
- do not add billing until the paid boundary is clear

### Gate 3: Paid Alpha

Enter when:

- users repeat exports
- support load is manageable
- export claims are honest
- billing boundary is obvious

Action:

- integrate Stripe or equivalent
- keep plans simple
- preserve a free reviewer/demo path

## YC Metrics Snapshot Template

Use this format in updates and applications:

```text
BreakGen private alpha
Date:
Active alpha users:
Projects created:
Validation runs:
Mechanical compiles:
Exports:
Review-ready exports:
Physical build attempts:
Physical build attempts:
Successful physical builds:
Weekly user conversations:
Most common blocker:
Most repeated payment signal:
Monthly burn:
Provider spend:
```

## Operating Cadence

Daily:

- check alpha sessions
- review failed jobs/exports
- respond to users
- ship one product improvement or one learning action

Weekly:

- run full tests and demo proof
- update metrics snapshot
- contact 50 targeted users
- run 5-10 user conversations
- review support themes
- choose next P0

Monthly:

- review burn
- review provider spend
- review prototype outcomes
- update YC narrative
- decide whether to expand or narrow scope

## Hiring and Help

Do not hire early for breadth.

Useful help before funding:

- one mechanical/electronics advisor
- one maker who physically tests exports
- one design partner building a real device
- one legal/accounting setup advisor

Avoid:

- large outsourced dev teams
- generic growth contractors
- expensive CAD consultants before the compiler target is narrower

## The Financial Discipline

BreakGen should act like a startup by doing fewer things more completely:

1. Prove one device path.
2. Make export trust real.
3. Watch repeated usage.
4. Price the repeated workflow.
5. Expand only after one loop works.
