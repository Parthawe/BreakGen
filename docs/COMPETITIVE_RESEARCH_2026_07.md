# Competitive Research — Verified (2026-07-06)

> Adversarially verified version of the "Kyrall Inspiration Report." Method: 5 search angles → 24 sources fetched → 115 claims extracted → 25 claims put through 3-vote adversarial verification → 23 confirmed, 2 refuted. Pricing verified live on 2026-07-06 (time-sensitive).
> Rule of use: findings below are citable; anything in the *unverified* list must not be asserted in strategy docs or investor material.

## Verdict on the inspiration report

**Where it checked out (high confidence, unanimous verification):** Zoo, Leo AI, Raven, Autodesk (announcement status), Onshape (advisory-only status + pricing), Ergogen, Cosmos (STEP export).
**Where it is unverified — including its own centerpiece:** **no claims survived for 6 of its 11 products: Kyrall itself, nTop, Synera, SimScale, aPriori, Shapr3D**, nor for most of the keyboard toolchain (KLE, ai03 plate gen, kbfirmware/swillkb, QMK Configurator, VIA/VIAL, JLCPCB/PCBWay paths). Unverified ≠ wrong, but do not build strategy on those sections.
**Two claims actively refuted — do not repeat them:**
- "Cosmos stops at CAD export with no firmware path" — **refuted 0-3.** Cosmos goes further than the report implied; its true firmware/assembly reach is an open question.
- "Zoo disclaims manufacturing-ready AI generation" — **refuted 1-2.** Zoo may be closer to intent-to-manufacturable than assumed.

## Verified landscape (citable)

### Top-down flank — big CAD
- **Autodesk**: "neural CAD" foundation models announced Sep 16 2025 (AU 2025); **no ship date, no pricing; still demo-stage as of Jul 2026**. Reps verbally claimed editable B-rep output; the press release does not.
- **Onshape (PTC)**: shipped AI as of Oct 14 2025 is **advisory-only** (AI Advisor); generative geometry explicitly "Future Vision"/roadmap, **agents signaled for 2026 — the window is closing**. Pricing floor **$1,500–$2,500/user/yr**; free tier is non-commercial with **all documents public** (ToS even lets third parties commercialize free users' public docs).

### AI-CAD startups
- **Zoo (zoo.dev)**: shipped **Zookeeper** agent (Feb 2026). Outputs are **editable parametric B-rep via KCL** against Zoo's own GPU geometry engine; full API/SDKs; STEP is the only true B-rep export. Quality degrades sharply on complex parts (independent test). **Closest analog to BreakGen's deterministic-compiler framing — the one to watch.**
- **Leo AI**: **$9.7M disclosed** (seed led by Flint Capital; ex-SolidWorks CEO angel). Knowledge-grounded copilot **inside SolidWorks** (beta listed by Dassault); learns from company PLM/CAD data; generates assemblies with real feature trees (mating still manual). **Validates the context-manager thesis.**
- **Raven (raven.build)**: GA copilot inside Rhino/Grasshopper emitting **native Grasshopper components** (not code blobs). Freemium, token-metered: Free / $9.99 student / $49 personal / $99 pro seat / enterprise. **Real pricing datapoints for intent→parametric tooling.**

### Bottom-up flank — keyboard domain
- **Ergogen**: single YAML → layouts, plates, cases, **un-routed** PCBs (user must route in KiCad, then fab). **Zero** firmware/QMK/VIA, validation, or fabrication-bundle scope (README verified verbatim; unchanged through 2025-26). **The downstream layers BreakGen compiles are unoccupied by the domain's leading config tool.**
- **Cosmos**: exports STL + **editable STEP** (no parametric feature history; some imports error). **Open-core: ~95% open-source; one-time Pro fee gates only cosmetic options** — engineering outputs free (2-1 vote → medium confidence). Developer also monetizes hardware. **Warning sign: the only proven paid software layer in this exact niche is cosmetic, one-time-purchase.**

## Strategy assessment (synthesis — medium confidence)

**The wedge is plausibly open on both flanks.** Top-down intent-to-geometry is announced-not-shipped; shipped AI-CAD startups are general-purpose copilots inside pro CAD; bottom-up tools deliberately stop before firmware/validation/fabrication evidence. No verified evidence that anyone unifies layout→plate→PCB→firmware→case→fabrication end-to-end.

**Report roadmap moves, scored against evidence:**
| Move | Verdict |
|---|---|
| Context manager | **Supported** (Leo validates knowledge-grounding demand) |
| Intent-to-proposal compiler | **Supported** (Raven/Zoo patterns + incumbent gap = timing) |
| Parametric workspace objects | **Partially supported** (Cosmos users demonstrably want editable STEP) |
| Evidence ledger | **Speculative** — zero competitive validation that buyers pay for provenance/evidence; plausible differentiator, unproven revenue driver |

**Strongest verified counter-arguments:**
1. PTC signaled geometry agents for 2026 — the incumbent gap is time-limited.
2. Onshape's free tier gives hobbyists full parametric CAD at $0 (privacy is the paid lever).
3. In the exact target niche, the proven willingness-to-pay is **one-time cosmetic fees, not recurring engineering-evidence subscriptions**.
4. **No market-size or willingness-to-pay claim survived verification** — group-buy volume, keyboard-market revenue, maker spend all unproven. The demand side of the wedge rests on indirect signals only (Cosmos Pro's existence, Raven's $49–99, Onshape's $1,500 floor).

## Addendum — second verified pass (2026-07-06, separate 105-agent run)

A second independent deep-research run (5 angles → 23 sources → 113 claims → 25 through 3-vote adversarial verification → 24 confirmed, 1 refuted) resolves part of open question 1 and adds verified players. Same citability rule applies.

**Kyrall is real and shipped (3-0 verified, resolves the "is Kyrall real?" question):**
- Launched publicly Jul 6 2026; AI "design agent" for hardware; **Munich** (Kyrall GmbH, HRB 301608) — *not Amsterdam* as startup maps list. Founders Ben Stickelbrucks + Osama Atwi (TUM aerospace). No known external funding.
- Output verified against its live production JS bundle: fully parametric, editable models from text/sketch/mesh; edge/face/parameter editing; **GLB/STEP/STL export**. No third-party benchmark of STEP quality exists.
- **Context Manager** = engineering-data repository → knowledge graph grounding generation (press-relayed vendor claim).
- **Pricing live in production (Stripe flows shipped):** Free 10 generations · €20/mo Premium (€16 yearly) · Enterprise custom · **metered per-call API credits**. This is a direct pricing anchor in the freemium+metered pattern.

**Additional verified (3-0) players from this pass:**
- **Adam (YC W25)**: $4.1M seed (TQ Ventures); consumer-viral text-to-3D (1M+ models per YC profile) pivoting to "Cursor for CAD" inside Onshape. *Refuted 0-3: its reported $5.99/$17.99 consumer pricing — do not cite.* Relevant as the consumer-first-then-pro playbook for a maker audience.
- **PTC Creo 13** (Jun 10 2026): tiered AI assistant — **Advise (GA) / Assist (Beta) / Automate (Alpha, human-approval sandbox)**. The labeled-autonomy-gradient pattern, directly stealable for BreakGen's AI/deterministic split.
- **Autodesk Fusion generative design**: multi-outcome, manufacturing-aware, subscription + paid extension (~$1,600/yr) + cloud tokens; practitioner consensus is outputs need refinement — "manufacturing-ready" is vendor-optimistic.

**Supplemental (multi-source confirmed, not adversarially verified):** Spectral Labs SGS-1 (foundation model → native B-rep STEP; no assemblies; funding undisclosed) · Foundation EGI ($23M Series A, MIT spinout, DSL-constrained validity) · Backflip ($30M NEA/a16z, scan-to-CAD, $20–40/mo credit tiers) · Neural Concept ($27M B + $100M C, simulation surrogates) · nTop ($135M+ total, quote-based) — partially covers the pass-1 unverified list (nTop yes; Synera/SimScale/aPriori/Shapr3D still open).

**Positioning patterns extracted across both passes (P1–P6):** (1) a category boundary claim ("real CAD, not meshes") is every credible player's lead; (2) speed-to-artifact is the universal hero claim, with editability as the trust mechanism; (3) grounding in the customer's own data is the enterprise moat; (4) three architecture camps — standalone gen / agent-writes-code / copilot-in-incumbent; (5) startup pricing = freemium quota + metered credits, or consumer-viral→pro; (6) autonomy sold on a labeled gradient with approval gates.

## Open questions (next research passes)
1. ~~Kyrall~~ (resolved above — real, shipped, Munich, freemium+metered) · nTop (funding now known; capabilities unverified) · Synera, SimScale, aPriori, Shapr3D — still unverified.
2. Actual market size + willingness-to-pay for custom control-surface creation — needs primary evidence (group-buy data, vendor revenue, builder surveys).
3. How far Cosmos/QMK Configurator/VIA actually go on firmware + fab handoff (the 0-3 refutation leaves this unresolved — it bounds BreakGen's differentiation claim).
4. Ship-watch: Autodesk neural CAD, PTC Onshape agents, Zookeeper trajectory — any of these shipping compresses the window.

## Implications for BreakGen (operator summary)
- **Keep the deterministic-compiler positioning** — verified as differentiated on both flanks today, but the moat is *time-limited*; ship the hosted alpha and get real usage before the 2026 incumbent agents land.
- **Prioritize context manager + intent-to-proposal** from the report's moves; treat the evidence ledger as a product-trust feature, not a pricing lever, until users prove they'll pay for it.
- **Price against the verified anchors**: below Onshape's $1,500 floor, in Raven's $9.99–$99/mo band; expect cosmetic/appearance features to carry early willingness-to-pay (consistent with BreakGen's existing "AI at the appearance layer" split).
- **Do not cite** market-size figures, Kyrall capabilities, or "Cosmos stops at CAD" in any deck or doc.
