# BreakGen Platform Expansion Plan

> Long-range plan for turning BreakGen from a keyboard-specific product into a broader intent-to-fabrication platform without losing quality, identity, or manufacturability.

Date: April 8, 2026

## 1. The Core Strategic Question

If BreakGen expands beyond keyboards, what is the real product?

It is not:

- "AI for hardware"
- "text-to-CAD"
- "a marketplace for random fabricated objects"

The stronger answer is:

**BreakGen is an intent compiler for constrained physical products.**

That definition matters because it sets the boundary:

- users express intent in human terms
- domain compilers translate intent into structured, manufacturable outputs
- validation makes the result trustworthy

The system should generalize by preserving that shape, not by flattening everything into one generic generator.

## 2. What Should Generalize and What Should Stay Domain-Specific

### 2.1 General platform layers

These should become shared across all product categories:

- project lifecycle
- revisioning
- artifact registry
- validation report model
- job execution model
- export manifest model
- asset storage
- prompt/generation orchestration
- user-facing workflow scaffolding

### 2.2 Domain-specific compilers

These should remain modular and product-family-specific:

- keyboard layout + matrix compiler
- macro pad compiler
- MIDI controller compiler
- gamepad/controller compiler
- enclosure compiler
- desk object / organizer compiler
- wearable / jewelry compiler

This is the right split. The platform should be generic at the orchestration layer and opinionated at the compiler layer.

## 3. The Expansion Principle

BreakGen should not expand from "keyboards" to "everything."

It should expand from:

1. keyboard
2. keyboard-adjacent input devices
3. constrained electronic objects
4. constrained fabricated objects without electronics

That sequence preserves leverage from the current architecture.

## 4. Recommended Product Families in Order

### Phase A: Keyboard adjacency

These are the best next products because they reuse the highest percentage of the current system.

#### 1. Macro pads

Why:

- same switch-footprint logic
- same plate generation ideas
- same matrix scanning logic
- simpler layouts than keyboards

What it validates:

- the platform can handle different key counts and interaction patterns
- export and validation can work across multiple products sharing the same compiler family

#### 2. Numpads

Why:

- even simpler than macro pads
- strong real-world use case
- natural entry-level product for users

#### 3. Stream deck style input boards

Why:

- still matrix-driven
- can add display/legend concepts later
- extends from keyboard to programmable interface surface

### Phase B: General electronic control surfaces

#### 4. MIDI controllers

Why:

- still a constrained physical/electronic object
- introduces encoders, sliders, pads, knobs, LEDs
- requires a richer but still structured hardware compiler

What it validates:

- BreakGen can move from "keys only" to "modular control surfaces"

#### 5. Game controllers / custom input peripherals

Why:

- strong emotional design space
- mix of buttons, triggers, shells, and ergonomics
- more complex mechanical validation

This is a major jump and should come only after the platform abstraction hardens.

### Phase C: Fabricated objects without matrix electronics

#### 6. Device enclosures

Why:

- many users want custom housings more than full electronics
- enclosure generation is constrained by board dimensions, ports, mounting points
- strong commercial relevance

#### 7. Desk accessories / organizers / stands

Why:

- lower electronics complexity
- lets the platform express aesthetic intent through constrained geometry

#### 8. Jewelry / wearables / small sculptural fabricated objects

Why:

- high visual value
- fabrication pipeline matters
- uses AI style generation differently

This family should arrive only after the asset/geometry pipeline is mature enough to support non-electronic products.

## 5. Platform Architecture Required for Expansion

To grow beyond keyboards, the current `KeyboardProject` model cannot remain the top-level product abstraction forever.

### 5.1 Current state

Current source of truth is:

- `KeyboardProject`

This is good for current focus. It is not the correct final top-level model.

### 5.2 Target state

Introduce a platform-level model such as:

```text
IntentProject
  ├── product_family
  ├── domain_spec
  ├── assets
  ├── validation
  ├── exports
  └── revisions
```

Where:

- `product_family` identifies the domain compiler
- `domain_spec` contains the family-specific canonical model

Examples:

- `product_family = keyboard`
- `domain_spec = KeyboardSpec`

- `product_family = macropad`
- `domain_spec = MacroPadSpec`

- `product_family = enclosure`
- `domain_spec = EnclosureSpec`

### 5.3 Why this matters

Without this split, expansion will result in one of two bad outcomes:

- a huge keyboard model with irrelevant fields for other products
- multiple disconnected products sharing no real platform layer

## 6. Proposed Canonical Model Evolution

### Stage 1: Keep `KeyboardProject`, but formalize compiler contracts

Do first:

- define compiler interface boundaries
- define validation interface boundaries
- define export interface boundaries

Example shape:

```text
compile(project) -> derived_artifacts
validate(project) -> validation_report
export(project) -> export_bundle
```

### Stage 2: Extract shared project envelope

Create a wrapper model:

```text
ProjectEnvelope
  id
  revision
  product_family
  status
  created_at
  updated_at
  payload
```

Where `payload` is still keyboard-specific at first.

### Stage 3: Split domain specs by family

Move from one payload shape to a union of family-specific payloads.

## 7. Domain Compiler Framework

BreakGen should become a platform of domain compilers, not a giant monolith.

### 7.1 Compiler interface

Each product family should implement:

- `normalize_input()`
- `derive_geometry()`
- `derive_electronics()` if relevant
- `derive_firmware()` if relevant
- `validate()`
- `export()`
- `preview_adapter()`

### 7.2 Shared runtime expectations

Every compiler should produce:

- a canonical domain spec
- explicit derived artifacts
- a validation report with standard categories
- a manifest-ready artifact inventory

### 7.3 Why this preserves identity

The product remains one thing:

- intent in
- validated artifact bundle out

The domain compilers make it credible across different product families.

## 8. UI Platform Plan

If BreakGen expands, the frontend should not be rebuilt from scratch for each product family.

### 8.1 Shared UI surfaces

These should become generic:

- project creation
- family selection
- step navigation
- validation panel
- export panel
- generation panel
- asset library
- project history / revisions

### 8.2 Domain-specific editors

These remain specific:

- keyboard layout editor
- macro pad grid editor
- MIDI surface editor
- enclosure parameter editor

### 8.3 Preview system

Shared:

- scene shell
- camera system
- lighting presets
- selection/highlight system

Specific:

- actual geometry adapters per domain

## 9. Validation Platform Plan

Validation is the deepest source of trust in this product. It should become platform infrastructure, not per-feature cleanup.

### 9.1 Shared validation categories

All product families should report into a common framework:

- geometry
- manufacturability
- electronics
- firmware
- export completeness
- calibration assumptions

### 9.2 Domain-specific validation rules

Keyboard examples:

- stabilizers
- switch cutouts
- matrix feasibility

MIDI controller examples:

- encoder clearance
- slider travel clearance
- MCU I/O capacity

Enclosure examples:

- wall thickness
- fastener clearance
- port alignment

### 9.3 Status philosophy

Validation should remain:

- structured
- revision-specific
- explainable
- storable

Not:

- ad hoc strings returned by endpoints

## 10. Artifact and Asset Platform

This is one of the most important generalization layers.

### 10.1 Asset classes

BreakGen should support a registry of:

- generated assets
- deterministic library assets
- uploaded reference assets
- derived artifacts

### 10.2 Required metadata for every asset

- asset id
- project id
- revision
- family
- source
- generator/toolchain version
- validation state
- storage path
- hashes

### 10.3 Why this matters for expansion

Once BreakGen goes beyond keyboards, assets become much more diverse:

- shell meshes
- electronics definitions
- plate files
- enclosure panels
- decorative overlays
- labels
- packaging assets

Without a serious asset registry, the platform cannot scale cleanly.

## 11. Job System Plan

This is mandatory for becoming a real platform.

### 11.1 Shared job types

- generation
- normalization
- geometry compile
- electronics compile
- firmware compile
- validation
- export

### 11.2 Required job properties

- project id
- revision
- product family
- job type
- status
- progress
- input artifact refs
- output artifact refs
- error report

### 11.3 Why it matters

As soon as BreakGen supports multiple families, synchronous request-driven orchestration becomes operationally brittle.

## 12. Product Identity Plan

The most important non-technical question:

Should the name `BreakGen` remain keyboard-centric or become platform-centric?

### Option A: Keep `BreakGen` as the master platform

Positioning:

- BreakGen is the intent compiler platform
- keyboards are the first flagship domain

Sub-products:

- BreakGen Keyboard
- BreakGen Macro
- BreakGen Control
- BreakGen Enclosure

### Option B: Keep BreakGen keyboard-specific and create a parent platform later

Positioning:

- BreakGen remains the keyboard product
- a future parent system hosts multiple product families

Recommendation:

Option A is stronger if you truly intend to expand. The current brand already implies generation through breaking down complexity. It can stretch.

## 13. What Not to Generalize Too Early

These are traps:

- one universal "design anything" prompt surface
- one universal CAD schema
- one universal validation engine without domain plugins
- one editor trying to serve all products

That path sounds ambitious but usually produces shallow tools.

The better path is:

- one platform
- many constrained compilers

## 14. Suggested Expansion Roadmap

### Horizon 1: Make keyboards real first

Goal:

- make the keyboard compiler trustworthy end-to-end

Must include:

- universal revision discipline
- durable asset registry
- stored validation reports
- stored export metadata
- complete keyboard mutation pipeline

Do not expand before this is solid.

### Horizon 2: Keyboard-adjacent products

Goal:

- prove the platform abstraction without leaving the current hardware family

Targets:

- macro pads
- numpads
- programmable key clusters

Success signal:

- multiple product families sharing one platform envelope, job system, and validation framework

### Horizon 3: Control surfaces

Goal:

- move beyond pure key matrices

Targets:

- MIDI controllers
- custom button/encoder boards
- compact control consoles

Success signal:

- platform handles mixed interaction components, not just keys

### Horizon 4: Enclosures and non-electronic objects

Goal:

- prove BreakGen is about constrained fabrication, not only input devices

Targets:

- electronics enclosures
- docking shells
- desk organizers / stands
- fabrication-ready small objects

Success signal:

- product identity survives beyond the keyboard domain

## 15. Concrete Execution Plan

### Phase 1: Fix integrity before expansion

Deliver:

- one mutation service for all state changes
- revision snapshots for every project mutation path
- validation persistence
- export persistence
- asset registry enforcement

Exit criteria:

- every user-visible state change is revisioned and auditable

### Phase 2: Introduce platform envelope

Deliver:

- `ProjectEnvelope`
- `product_family`
- family-aware compiler registration
- family-aware validation registration

Exit criteria:

- keyboard still works through the new platform layer

### Phase 3: Extract keyboard compiler as plugin/module

Deliver:

- keyboard-specific compiler package
- keyboard-specific editor module
- keyboard-specific validation rules

Exit criteria:

- keyboard domain no longer defines the whole platform shape

### Phase 4: Launch macro pad domain

Deliver:

- `MacroPadSpec`
- macro pad layout presets
- plate + matrix + firmware compiler reuse
- export bundle reuse

Exit criteria:

- second product family ships without forking the platform

### Phase 5: Launch control-surface domain

Deliver:

- encoder/slider/button component library
- richer electronics compiler
- new preview adapter

Exit criteria:

- platform supports non-key-only input hardware

### Phase 6: Launch enclosure domain

Deliver:

- enclosure canonical model
- panel/port/mounting compiler
- enclosure validation rules

Exit criteria:

- BreakGen can credibly serve a non-keyboard product family

## 16. Metrics for Expansion

Track these instead of vanity metrics:

- percent of stateful mutations going through one canonical mutation pipeline
- percent of artifacts that are registered and revision-linked
- percent of exports with stored validation and manifest references
- time to launch a second product family without duplicating core systems
- number of shared platform services reused across families

These are the signals that the platform is real.

## 17. Final Recommendation

The best version of BreakGen is not "keyboard generator plus random extra things."

It is:

**a rigorous platform for turning constrained physical intent into validated, fabrication-aware outputs through family-specific compilers.**

To get there:

1. Harden canonical state and revision integrity first.
2. Extract platform layers second.
3. Expand into the closest adjacent families third.
4. Preserve identity by staying constraint-driven, not generic-for-generic’s-sake.

That is the path that makes it bigger without making it weaker.
