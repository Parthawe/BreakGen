# Launch Design Reference Audit

Date: June 25, 2026

This audit captures the reference pass behind the current BreakGen launch-page design iteration.

## Screenshots Captured

Screenshots are stored locally in:

```text
artifacts/design-research-2026-06-25/
```

Captured:

- `breakgen-local.png`
- `framework.png`
- `teenage-engineering-opxy.png`
- `kickstarter-hardware-rules.png`
- `linear.png`
- `breakgen-local-after-dock-desktop-v2.png`
- `breakgen-local-after-dock-mobile-v2.png`

The Framework screenshot hit a simple `Error 408` page through headless Chrome, so Framework analysis uses its page text and structured content instead of the screenshot.

## What The References Do Better

### Framework

Framework makes the product concrete immediately: a real hardware image, a clear claim, and direct configure/learn CTAs. It also reinforces credibility through repairability, customization, parts, downloads, and guides.

BreakGen takeaway:

- Make the build object visible earlier.
- Tie claims to real artifacts, source catalogs, and export evidence.
- Keep the CTA practical: inspect, configure, request access, choose first kit.

### Teenage Engineering

Teenage Engineering is sparse, strange, and object-led. The page sells desire through physical atmosphere before it explains every feature. The copy has a distinct voice and the product image carries the first impression.

BreakGen takeaway:

- Avoid dumping roadmap facts too early.
- Use fewer, stronger physical scenes: bench, prototype, receipt, device surface.
- Let copy feel authored, not generated.

### Linear

Linear uses disciplined navigation, large product UI, and careful whitespace. It shows a believable software surface instead of listing features abstractly.

BreakGen takeaway:

- Use product-like surfaces and structured artifacts.
- Let interface screenshots or credible UI objects carry trust.
- Reduce clutter in the first viewport.

### Kickstarter

Kickstarter's hardware guidance requires honesty, working prototypes, and production-plan clarity. Its pre-launch guidance emphasizes a project image, direct call to action, updates, and follower notification.

BreakGen takeaway:

- Do not imply a Kickstarter launch is ready before a working prototype exists.
- Keep the campaign lane framed around one hero kit and pilot-build proof.
- Use email capture to learn which kit deserves prototype investment.

## Current BreakGen Fixes From This Pass

- Add a studio bench visual to make the page feel more physical and warm.
- Add a hero build lens so the first viewport explains BreakGen as a build pipeline.
- Reduce the launch capture dock footprint so it does not block the first-fold design.

## Next Design Bets

1. Replace CSS-only hardware scenes with one high-quality generated or photographed prototype render after there is a chosen hero kit.
2. Add a compact campaign preference selector to capture which coming-soon device visitors want first.
3. Turn the public demo into the actual hero-kit walkthrough, not only a generic workspace demo.
4. Add a build-guide preview in the public site so the manufacturing story has a tangible artifact.
