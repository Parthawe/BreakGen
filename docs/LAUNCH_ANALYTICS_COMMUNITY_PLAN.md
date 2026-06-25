# Launch Analytics and Community Plan

BreakGen can launch publicly before the whole product is self-serve if the site answers three questions every week:

1. Who is interested enough to leave an email?
2. Which device workflows do they actually want?
3. Where do they get stuck, confused, or excited?

This plan defines the minimum viable launch funnel for YC-style learning without adding secrets, dark patterns, or heavyweight growth tooling to the app.

## Launch Funnel

The current public site should measure this path:

| Stage | User action | Product signal |
| --- | --- | --- |
| Landing view | Visits the public homepage | Source, path, route view |
| Demo interest | Clicks demo or repository CTA | Technical buyer or reviewer intent |
| Alpha request | Opens or submits launch capture | Strong maker/founder intent |
| Community interest | Clicks Discord CTA | Wants to follow or contribute |
| Research lead | Selects research mode and submits details | High-value learning candidate |

The goal is not vanity traffic. The useful metric is qualified email submissions by role, desired device type, and source.

## Instrumented Events

The client now emits these optional events through the analytics adapter:

| Event | When it fires | Key properties |
| --- | --- | --- |
| `route_view` | React route changes | `path` |
| `landing_view` | Public landing page renders | `surface` |
| `public_demo_view` | Public demo renders | `surface` |
| `landing_cta_click` | Landing CTA is clicked | `cta`, `surface` |
| `public_demo_cta_click` | Demo CTA is clicked | `cta`, `surface` |
| `launch_capture_auto_open` | Capture modal opens after dwell time | `surface` |
| `launch_capture_open` | User opens capture from dock | `surface`, `mode` |
| `launch_capture_mode` | User switches alpha/community/research mode | `surface`, `mode` |
| `community_cta_click` | Discord CTA is clicked | `surface`, `has_invite` |
| `launch_capture_submit` | User submits email form | `surface`, `mode`, `role`, `endpoint` |
| `launch_capture_error` | Waitlist endpoint fails | `surface`, `mode` |
| `launch_capture_close` | User dismisses capture modal | `surface`, `mode` |

Plausible can receive custom events and custom properties. PostHog can receive manual product events and can also autocapture, but this repo keeps autocapture disabled by default so the first launch only records intentional signals.

Sources:

- [Plausible custom event goals](https://plausible.io/docs/custom-event-goals)
- [Plausible custom properties](https://plausible.io/docs/custom-props/for-custom-events)
- [PostHog web analytics installation](https://posthog.com/docs/web-analytics/installation/web)
- [PostHog capture events](https://posthog.com/docs/product-analytics/capture-events)

## Runtime Configuration

No analytics keys or waitlist endpoints should be committed. Configure these in the hosting provider:

```bash
VITE_WAITLIST_ENDPOINT=
VITE_DISCORD_INVITE_URL=
VITE_PLAUSIBLE_DOMAIN=
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://app.posthog.com
```

If `VITE_WAITLIST_ENDPOINT` is empty, the capture form falls back to a prefilled email handoff. This keeps the live site usable before backend lead capture is deployed.

## Waitlist Options

Use the smallest tool that closes the loop:

| Option | Use when | Notes |
| --- | --- | --- |
| Email fallback | First public test | No database, no secret, low volume only |
| Tally form endpoint | Fast no-code capture | Supports hidden fields for source and campaign parameters |
| Backend `/leads` endpoint | Private alpha is active | Store consented leads with role, intent, note, source, and timestamp |

Tally hidden fields can carry URL parameters and campaign source into a form submission. If Tally is used, include fields for `surface`, `path`, `intent`, `role`, `utm_source`, `utm_campaign`, and `referrer`.

Source: [Tally hidden fields](https://tally.so/help/hidden-fields)

## Discord Community Setup

Discord should be treated as a build room, not a generic fan server.

Recommended initial channel structure:

| Channel | Purpose |
| --- | --- |
| `#start-here` | One-paragraph promise, rules, useful links |
| `#introductions` | Role, device idea, build experience |
| `#device-ideas` | Macro pads, stream decks, MIDI controllers, pedals, gamepads |
| `#workflow-pain` | CAD, firmware, fabrication, export, sourcing pain |
| `#proof-bundles` | Users share generated bundles and validation issues |
| `#alpha-feedback` | Product feedback from invited testers |
| `#announcements` | Weekly release and learning notes |

Operational rules:

- Enable Community mode before inviting broad traffic.
- Require verified email for posting.
- Keep invite links controlled until moderation is ready.
- Pin what BreakGen can and cannot do today.
- Close the feedback loop weekly with what changed because of the community.

Sources:

- [Discord Community Server setup](https://support.discord.com/hc/en-us/articles/360047132851-Enabling-Your-Community-Server)
- [Discord custom invite links](https://support.discord.com/hc/en-us/articles/115001542132-Custom-Invite-Link)
- [Discord community guidelines](https://discord.com/guidelines)

## Privacy and Security Stance

The launch funnel should collect only what is needed:

- Email address
- User role
- Alpha/community/research intent
- Short freeform build note
- Page path, referrer, timestamp

Do not collect:

- Passwords in public forms
- API keys or hardware vendor credentials
- Full source files or private CAD files through the lead form
- Payment data before billing exists

Implementation requirements:

- Keep analytics keys in environment variables.
- Keep PostHog autocapture off until a privacy review is done.
- Add a hosted privacy note before paid or self-serve onboarding.
- If a backend lead endpoint is added, rate limit it and validate email, role, intent, source, and note length.
- Never expose backend admin tokens, JWT secrets, or vendor API keys through Vite variables.

## Weekly Launch Review

Every week, answer:

1. How many qualified leads came from landing, demo, GitHub, and community?
2. Which role/device combination repeats most often?
3. Which CTA has high clicks but low submissions?
4. What language in submitted notes proves or disproves the current positioning?
5. What product change can ship this week because of that evidence?

The YC framing is simple: launch narrow, measure the real funnel, talk to users, and turn the strongest repeated pain into product behavior.
