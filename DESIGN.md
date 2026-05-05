# Design

## Product

BreakGen

## Design Intent

BreakGen should feel like a serious studio for programmable hardware: dark, precise, cinematic, and visibly technical without becoming cold enterprise software. The launch surfaces should communicate confidence and product depth. The authenticated surfaces should feel like a working tool, not a marketing page wearing app chrome.

## Visual Theme

- Dark hardware-native interface with tinted neutrals instead of pure black.
- Premium glass and translucent panels used as a material system, not as decorative clutter.
- Contrast comes from composition, typography, and selective color signal, not from loud gradients everywhere.
- Public launch pages lean slightly more narrative and brand-forward than the product shell, but both should still feel like one system.

## Color System

### Core surfaces

- `--bg-root`: near-black with subtle indigo and cyan atmospheric spill
- `--bg-surface`: deep graphite
- `--bg-elevated`: slightly lighter graphite for lifted content
- `--border-subtle` / `--border-default`: soft cool-gray borders

### Text

- Primary text: soft white, never pure white
- Secondary text: cool muted gray
- Tertiary and muted text: lower-contrast graphite-gray for metadata

### Accent strategy

- Primary accent: indigo (`--accent`)
- Supporting atmospheric colors: cyan and pink used as glow and ambient spill, not primary UI accents
- Product-family accents:
  - keyboard: indigo
  - macropad: green
  - streamdeck: amber
  - midi: pink
  - gamepad: cyan

### Semantic colors

- success: green
- warn: amber
- error: red

## Typography

- UI family: Geist
- Monospace family: Geist Mono
- Product shell uses restrained hierarchy and dense metadata labels
- Launch surfaces use larger display scale, but still within the same family for continuity
- Headings should feel compressed and intentional, not airy lifestyle typography

## Layout Principles

- Use asymmetric rhythm where the launch page benefits from it
- Keep product screens grid-driven and predictable
- Large sections should alternate between broad narrative blocks and denser technical evidence
- Avoid endless identical cards; vary density and composition
- The 3D preview should feel framed and curated, not like an unstyled canvas dropped into a split view

## Component Language

- `glass`, `glass-strong`, and `glass-soft` define the core material system
- Pill badges and chips should carry metadata, not generic decoration
- Primary actions are light, dense, and clearly actionable
- Secondary actions stay within the glass language
- Cards should have deliberate radius, edge light, and subdued internal contrast

## Motion

- Subtle float and ambient motion is allowed on brand surfaces
- Product motion should communicate state and depth, not theatrics
- Respect reduced motion preferences
- No bounce or elastic effects

## 3D Preview Direction

- Camera should present objects in a readable isometric/product-view angle by default
- Lighting should separate object silhouette from the dark background and make accepted assets legible
- The preview chamber should feel like a showcase surface with clear framing and status

## Anti-Patterns

- Beige AI landing-page gradients
- Random product cards with identical weight
- Decorative glow without product meaning
- Flat black backgrounds with no atmosphere
- Oversized glass blur applied to everything equally
- Detached marketing copy that does not match what the software actually does
