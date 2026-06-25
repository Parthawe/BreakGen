# BreakGen Private Alpha Runbook

## Scope

This runbook is for the current private-alpha product only.

Live alpha families:

- `keyboard`
- `macropad`
- `streamdeck`
- `midi`
- `gamepad`

Planned families such as `handheld_companion`, `retro_handheld`, `desktop_speaker`, `smart_lamp`, and `sensor_pod` should not be presented to reviewers as part of the supported authoring scope.

## Stack Startup

From the repo root:

```bash
make install
BREAKGEN_ALPHA_PASSWORD="replace-with-a-strong-local-password" make seed-alpha-user
make dev
```

Expected local endpoints:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8000`
- docs: `http://localhost:8000/docs`

If port `5173` is occupied, Vite may move to the next available port. Confirm the actual local URL from the terminal output.

## Auth Expectations

BreakGen is invite-only for this milestone.

There is no public self-serve onboarding contract yet. Reviewer accounts should be provisioned explicitly.
For a hosted private-alpha environment, set `BREAKGEN_PUBLIC_SIGNUP_ENABLED=false`.
If signup is intentionally enabled outside debug mode, `BREAKGEN_SIGNUP_INVITE_CODE` must be set and supplied by the caller.

Default local reviewer seed command:

```bash
BREAKGEN_ALPHA_PASSWORD="replace-with-a-strong-local-password" make seed-alpha-user
```

That command runs:

```bash
cd server && BREAKGEN_ALPHA_PASSWORD="replace-with-a-strong-local-password" \
  PYTHONPATH=$(pwd)/.. python3 -m uv run python -m server.scripts.seed_alpha_user
```

Default local reviewer credentials created by the script:

- email: `pawar.d.parth@gmail.com`
- password: the value passed through `BREAKGEN_ALPHA_PASSWORD`
- name: `Parth`

To override:

```bash
cd server
PYTHONPATH=$(pwd)/.. python3 -m uv run python -m server.scripts.seed_alpha_user \
  --email reviewer@example.com \
  --name "Reviewer Name" \
  --password "stronger-password"
```

## Private Alpha Test Path

Reviewers should test the authenticated product in this order:

1. Sign in
2. Create a project in one of the five live families
3. Confirm the define baseline is correct
4. Edit layout and save
5. Generate or review appearance assets
6. Accept at least one canonical asset
7. Compile electronics
8. Compile mechanical outputs
9. Run validation
10. Export a bundle
11. Inspect jobs, artifacts, and revision-linked history

## What Reviewers Should Look For

### Lifecycle integrity

- Save operations should advance revision only on canonical mutations.
- Validation, mechanical compile, and export records should stay tied to the correct revision.
- Generated preview assets should not count as canonical until explicitly accepted.

### Family behavior

- `keyboard` and `macropad` should read as switch-oriented workflows.
- `streamdeck`, `midi`, and `gamepad` should read as control-surface workflows, not mislabeled keyboards.

### Error handling

- stale revision conflicts should be explicit
- expired sessions should be explicit
- backend outage should be explicit
- export truth should distinguish candidate, review-ready, and future prototype-ready states

## Provider Expectations

Current production provider policy for private alpha:

- Meshy is the only enabled production generation provider.
- Planned providers may appear in manifests for roadmap clarity, but should not be presented as active reviewer promises.

If Meshy credentials are missing:

- generation requests will not complete successfully
- the rest of the authenticated product should still work

Set the provider key through:

- `BREAKGEN_MESHY_API_KEY`

## Known Feature-Flag Reality

Architecture-ready but not alpha-public:

- handheld proof families
- ambient-device families
- broader provider expansion

Do not treat “present in manifest” as “supported in product.”

## Verification Commands

Before handing the build to a reviewer:

```bash
make demo-proof
./server/.venv/bin/pytest server/tests
cd client && pnpm build
```

`make demo-proof` creates a deterministic Stream Deck proof project, runs electronics compile, mechanical compile, validation, and export, then prints the generated bundle path and SHA-256.

Optional local smoke checks:

- sign in with the seeded reviewer account
- create one project in each live family
- compile electronics and mechanical outputs
- run validation and export

## Failure Triage

### Frontend loads, API actions fail

Check:

- backend is running on `:8000`
- token is still valid
- `BREAKGEN_MESHY_API_KEY` is set only if testing generation

### Session loops back to login

Check:

- token expired or invalidated
- local reviewer account exists
- backend database is the expected local `server/breakgen.db`

### Export is present but not trustworthy

Check:

- validation revision matches current project revision
- bundle readiness is `review_ready` when current validation gates pass
- do not call a bundle `prototype_ready` until BOM, enclosure, PCB/fabrication, and assembly assumptions are complete enough for a physical build attempt
- artifact history reflects the current revision
