# Hardware Source Catalog

BreakGen should not invent PCB footprints, switch models, or firmware schemas. The realistic path is to keep a curated source catalog and make every compiler output say which source-backed assumptions it used.

## Current Implementation

The backend exposes two public catalog endpoints:

```text
GET /api/hardware-sources
GET /api/footprint-sources
```

PCB compilation now stores `derived.electronics.footprint_source_summary` and returns the same summary from:

```text
POST /api/projects/{project_id}/compile/pcb
```

Validation also includes:

```text
footprint_source_coverage
```

Unknown footprint IDs fail validation and PCB compilation. Proof placeholders are allowed for non-keyboard prototype families, but validation warns that they are not fabrication-ready.

## Source Tiers

| Tier | Meaning | Current use |
| --- | --- | --- |
| `library_ready` | Can be treated as a supported BreakGen V1 footprint family. | `mx_switch` |
| `reference_only` | Source-backed, but needs exact part/footprint lock before fabrication export. | encoders, tactile buttons, USB-C, selected display modules |
| `proof_placeholder` | Useful for product modeling and demos, not yet tied to a vetted footprint. | MIDI pads, sensors, OLED modules, battery envelopes |

## Grounding Sources

| Source | Why it matters |
| --- | --- |
| [KiCad official libraries](https://www.kicad.org/libraries/) | Baseline EDA libraries for standard symbols, footprints, and package models. |
| [KiCad library license](https://www.kicad.org/libraries/license/) | Confirms KiCad library data can be used in designs without forcing the design files under the library license, while redistributed library collections must preserve license terms. |
| [QMK info.json reference](https://docs.qmk.fm/reference_info_json) | Defines the metadata and layout structure needed by QMK build/configurator flows. |
| [QMK Firmware docs](https://docs.qmk.fm/) | Confirms QMK is an open-source input-device firmware ecosystem covering keyboards, MIDI, mice, and related devices. |
| [Ergogen PCB docs](https://docs.ergogen.xyz/pcbs/) | Good model for placing repeated keyboard footprints from point-level net attributes into KiCad outputs. |
| [ai03 KiCad keyboard parts index](https://wiki.ai03.com/books/pcb-design/page/list-of-kicad-keyboard-parts-libraries) | Community reference list for keyboard-specific KiCad footprint libraries such as MX/Alps, USB-C, LEDs, and Keebio parts. |
| [ai03 keyboard PCB guide example](https://github.com/ai03-2725/ai03-keyboard-pcb-guide) | MIT-licensed practical KiCad keyboard PCB reference project. |

## Current Keyboard Baseline

For keyboard realism, BreakGen V1 should stay narrow:

- MX-compatible switch footprints only.
- `19.05mm` unit pitch.
- COL2ROW diode matrix.
- RP2040 controller budget baseline.
- QMK/VIA-facing metadata for keyboard and macro-pad style outputs.
- KiCad as the target EDA export environment.

This is intentionally less broad than the product vision. It is more credible because it avoids pretending that every module has a fabrication-ready footprint.

## What Comes Next

1. Vendor-lock exact MX switch footprint names and diode footprints.
2. Add a controller footprint baseline for a specific RP2040 board or bare RP2040 design.
3. Add diode, reset, USB-C, ESD, and power footprints as first-class catalog items.
4. Generate a KiCad netlist/placement manifest from `footprint_source_summary`.
5. Add export-blocking validation for any `proof_placeholder` footprint when the user requests fabrication-ready PCB files.
6. Vendor or submodule approved open-source footprints only when their licenses are compatible with redistribution.

The rule is simple: if BreakGen cannot name the source and readiness tier for a PCB model, it should not make fabrication claims about it.
