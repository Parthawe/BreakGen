import { useEffect, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { LaunchCapture } from "../components/LaunchCapture";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { trackEvent } from "../lib/analytics";
import { PUBLIC_DEMO_PATH, PUBLIC_SITE, REPO_URL } from "../lib/runtime";
import { useAuthStore } from "../stores/authStore";

const PLATFORM_PILLARS = [
  {
    label: "Studio",
    title: "Shape the product surface without leaving the engineering record.",
    body: "Family, layout, placed modules, appearance, and preview stay attached to one authored project instead of drifting across design files.",
  },
  {
    label: "Compiler",
    title: "Compile mechanical, electronics, validation, and export state from one revision.",
    body: "Panel geometry, control maps, validation reports, and bundle metadata derive from the same canonical document.",
  },
  {
    label: "Records",
    title: "Keep artifacts, acceptance state, and history visible while you build.",
    body: "Generated assets, validation reports, mechanical outputs, and export bundles stay tied to the revision that produced them.",
  },
];

const CREATIVE_LOOP = [
  {
    step: "01",
    title: "Define the family and baseline",
    body: "Choose a control-surface family, lock the starting template, and enter the workspace with a constrained product skeleton instead of an empty file.",
  },
  {
    step: "02",
    title: "Compose layout and visible parts",
    body: "Edit controls, refine the preview, and curate accepted appearance assets without breaking the underlying engineering model.",
  },
  {
    step: "03",
    title: "Compile trust into the output",
    body: "Mechanical artifacts, electronics metadata, validation results, and exports remain explicit so the product can be judged as a build system, not a screenshot.",
  },
];

const BUILD_PIPELINE = [
  {
    label: "State",
    title: "One canonical product record",
    body: "The authored project owns family, layout, controls, accepted assets, electronics settings, derived outputs, and revision history.",
    artifact: "KeyboardProject r2",
  },
  {
    label: "Compile",
    title: "Family-specific compilers",
    body: "The same platform spine routes a keyboard, stream deck, MIDI surface, or gamepad through compilers that understand that family.",
    artifact: "electronics + panel",
  },
  {
    label: "Validate",
    title: "Truth before download",
    body: "Geometry, GPIO budget, module compatibility, labels, assets, and export readiness are checked before the bundle is trusted.",
    artifact: "9 checks / 0 warnings",
  },
  {
    label: "Record",
    title: "Artifacts with provenance",
    body: "Mechanical outputs, validation reports, and export bundles are stored with revision, source hash, producer, and checksum metadata.",
    artifact: "sha256 + lineage",
  },
];

const PROOF_RECEIPT = [
  ["command", "make demo-proof"],
  ["project", "yc_proof_streamdeck"],
  ["target", "hid_control_surface"],
  ["mechanical", "panel.dxf + summary"],
  ["readiness", "review_ready"],
];

const MAKER_SIGNALS = [
  {
    label: "Controls are mixed",
    body: "DIY projects combine switches, OLEDs, encoders, LCDs, sliders, knobs, joysticks, and arcade buttons. BreakGen should model modules directly instead of forcing every device through keyboard-only fields.",
  },
  {
    label: "Cases are the bottleneck",
    body: "Shared projects often solve the enclosure around a known board or controller. BreakGen should make mounting, access, screw points, feet, and panel separation first-class constraints.",
  },
  {
    label: "Build notes matter",
    body: "The useful designs include print orientation, hardware, fasteners, and assembly assumptions. BreakGen exports should include the same practical build evidence alongside geometry.",
  },
  {
    label: "Remix is the workflow",
    body: "Maker communities improve by modifying proven shapes. BreakGen can turn that habit into templates, locked baselines, revision history, and repeatable proof bundles.",
  },
];

const COMING_SOON_PRODUCTS = [
  {
    name: "Split macro pads",
    stage: "closest to alpha",
    lane: "Kit candidate 01",
    build: "MX PCB, plate, spacer stack, QMK map",
    why: "A small paid kit can prove the compiler because the parts are understandable and the build path is short.",
    modules: ["MX switches", "encoders", "OLED slot"],
    proof: "10-unit pilot",
    shape: "split",
    accent: "#8b93ff",
  },
  {
    name: "Creator command consoles",
    stage: "coming soon",
    lane: "Creator lane",
    build: "LCD grid, USB-C, enclosure, scene profiles",
    why: "Streamers and video editors already hack together shortcut decks. BreakGen can turn that into a repeatable device family.",
    modules: ["display keys", "tact buttons", "USB-C"],
    proof: "scene profile demo",
    shape: "console",
    accent: "#4db7ff",
  },
  {
    name: "MIDI sketch controllers",
    stage: "prototype lane",
    lane: "Music lane",
    build: "pads, knobs, sliders, USB MIDI firmware",
    why: "Music hardware buyers understand custom control surfaces, and early prototypes can be tested with real DAWs.",
    modules: ["rubber pads", "sliders", "encoders"],
    proof: "DAW mapping test",
    shape: "midi",
    accent: "#d978b3",
  },
  {
    name: "Accessibility input rigs",
    stage: "research lane",
    lane: "Assistive lane",
    build: "large buttons, joystick, mounting plate, HID map",
    why: "The most important use cases are not always mass-market. This lane should be developed with users and careful ergonomics.",
    modules: ["arcade buttons", "joystick", "mount points"],
    proof: "user fit session",
    shape: "access",
    accent: "#48d48b",
  },
  {
    name: "Pedal and footswitch boards",
    stage: "proof lane",
    lane: "Performance lane",
    build: "stomp switches, expression input, rugged enclosure",
    why: "Guitar, synth, and live-performance workflows need durable programmable controls that can be configured without rewiring.",
    modules: ["stomp switches", "TRS input", "status LEDs"],
    proof: "floor test",
    shape: "pedal",
    accent: "#ebb156",
  },
  {
    name: "Dev-board enclosure kits",
    stage: "fabrication lane",
    lane: "Shell lane",
    build: "board carrier, ports, screws, print profile",
    why: "Enclosures are a manufacturing wedge beyond keyboards because the artifact can be useful even before BreakGen owns the full PCB.",
    modules: ["RP2040", "ESP32", "sensor bay"],
    proof: "fit check",
    shape: "enclosure",
    accent: "#d0a16c",
  },
];

const PRODUCT_FAMILIES = [
  {
    id: "keyboard",
    name: "Keyboard",
    accent: "#818cf8",
    note: "Switch-aware layouts, plate geometry, matrix strategy, firmware metadata, and export provenance.",
    rows: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
      [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
      [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
    ],
  },
  {
    id: "macropad",
    name: "Macro Pad",
    accent: "#4ade80",
    note: "Compact shortcut hardware that uses the same revision, validation, and export spine as larger devices.",
    rows: [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ],
  },
  {
    id: "streamdeck",
    name: "Stream Deck",
    accent: "#fbbf24",
    note: "Wide-spaced control surfaces for scene changes, streaming, and command mapping.",
    rows: [
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
    ],
  },
  {
    id: "midi",
    name: "MIDI Controller",
    accent: "#f472b6",
    note: "Keys, encoders, and mappings as real element types instead of keyboard-shaped hacks.",
    rows: [
      [0, 1, 0, 1, 0, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
  {
    id: "gamepad",
    name: "Gamepad",
    accent: "#38bdf8",
    note: "Button clusters, joystick placement, panel geometry, and control mapping in one shell.",
    rows: [
      [0, 1, 0, 1, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 0, 1, 0],
    ],
  },
];

const PROOF_FAMILIES = [
  "pedal controller",
  "breath controller",
  "handheld companion",
];

const TRUST_STACK = [
  {
    label: "Mechanical",
    body: "Family-aware panel and shell artifacts compiled from placed elements instead of hand-maintained exports.",
  },
  {
    label: "Electronics",
    body: "Matrix, direct-pin usage, firmware target, and control protocol remain visible and family-specific.",
  },
  {
    label: "Validation",
    body: "Geometry, module compatibility, GPIO feasibility, and export readiness are explicit checks, not implied claims.",
  },
  {
    label: "Provenance",
    body: "Jobs, artifacts, and accepted assets stay revision-bound so the output can be trusted after the design changes.",
  },
];

const LIVE_SCOPE = [
  ["5", "live alpha families"],
  ["3", "proof templates"],
  ["1", "reviewer proof command"],
];

const COMPILER_TRACKS = [
  { label: "Layout", value: "17 controls placed", tone: "#7d87ff" },
  { label: "Electronics", value: "hid control surface", tone: "#48d48b" },
  { label: "Mechanical", value: "panel artifacts compiled", tone: "#d0a16c" },
  { label: "Export", value: "review-ready bundle", tone: "#4db7ff" },
];

const KICKSTARTER_PATH = [
  {
    gate: "Prototype",
    detail: "Show a working device with real photos, measured fit, and a short demo video.",
    status: "required",
  },
  {
    gate: "Pilot build",
    detail: "Build 10 units, document failures, lock suppliers, and update the cost model.",
    status: "next",
  },
  {
    gate: "Pre-launch",
    detail: "Collect emails, open a Kickstarter pre-launch page, and publish progress updates.",
    status: "growth",
  },
  {
    gate: "Campaign",
    detail: "Launch with limited rewards, conservative delivery dates, and explicit production risks.",
    status: "ready later",
  },
];

function Glyph({
  rows,
  color,
}: {
  rows: number[][];
  color: string;
}) {
  return (
    <div className="flex flex-col items-center" style={{ gap: "4px" }}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex" style={{ gap: "4px" }}>
          {row.map((width, cellIndex) =>
            width > 0 ? (
              <div
                key={cellIndex}
                className="rounded-[4px]"
                style={{
                  width: `${width * 10 - 4}px`,
                  height: "6px",
                  background: color,
                  opacity: 0.8,
                }}
              />
            ) : (
              <div key={cellIndex} style={{ width: "6px" }} />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function ProductSignal({ color }: { color: string }) {
  return (
    <div className="manufacture-signal" aria-hidden="true">
      <span style={{ "--signal-color": color } as CSSProperties} />
      <span style={{ "--signal-color": color } as CSSProperties} />
      <span style={{ "--signal-color": color } as CSSProperties} />
      <i />
    </div>
  );
}

function ProductSpecimen({ product }: { product: (typeof COMING_SOON_PRODUCTS)[number] }) {
  return (
    <div
      className={`product-specimen product-specimen--${product.shape}`}
      style={{ "--product-accent": product.accent } as CSSProperties}
      aria-hidden="true"
    >
      <div className="product-specimen__trace product-specimen__trace--one" />
      <div className="product-specimen__trace product-specimen__trace--two" />
      <div className="product-specimen__body">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function ComingSoonLab() {
  const heroProduct = COMING_SOON_PRODUCTS[0];
  const secondaryProducts = COMING_SOON_PRODUCTS.slice(1);

  return (
    <section className="manufacture-lab section-rule mt-10 pt-10">
      <div className="manufacture-lab__intro">
        <div className="eyebrow">Coming soon</div>
        <h2>
          A prototype lab for the manufactured devices BreakGen should earn next.
        </h2>
        <p>
          The roadmap stays close to control surfaces and enclosures because they share the
          same hard problems: placement, mounting, wiring, firmware maps, build notes, and export evidence.
          A lane only advances when the prototype evidence catches up to the story.
        </p>
      </div>

      <div className="manufacture-lab__stage">
        <article className="manufacture-hero">
          <div className="manufacture-hero__copy">
            <div className="eyebrow">{heroProduct.lane}</div>
            <h3>{heroProduct.name}</h3>
            <p>{heroProduct.why}</p>
            <div className="manufacture-hero__meta">
              <span>{heroProduct.stage}</span>
              <span>{heroProduct.proof}</span>
              <span>{heroProduct.build}</span>
            </div>
          </div>
          <ProductSpecimen product={heroProduct} />
        </article>

        <div className="manufacture-lanes">
          {secondaryProducts.map((product, index) => (
            <article
              key={product.name}
              className="manufacture-lane"
              style={{ "--product-accent": product.accent, "--lane-index": index } as CSSProperties}
            >
              <div className="manufacture-lane__head">
                <ProductSignal color={product.accent} />
                <div>
                  <div className="eyebrow">{product.lane}</div>
                  <h3>{product.name}</h3>
                </div>
              </div>

              <p>{product.why}</p>

              <div className="manufacture-lane__footer">
                <span>{product.stage}</span>
                <span>{product.proof}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="manufacture-lab__filter">
          <span>Manufacturing filter</span>
          <p>
            Every lane needs named footprints, enclosure assumptions, BOM gaps, and prototype risks before
            it can become a real kit or campaign promise.
          </p>
        </div>
      </div>
    </section>
  );
}

function KickstarterRunway() {
  return (
    <section className="kickstarter-runway section-rule mt-10 pt-10">
      <div className="kickstarter-runway__copy">
        <div className="eyebrow">Kickstarter path</div>
        <h2>Crowdfunding only works here if the prototype story is real.</h2>
        <p>
          The first campaign should not sell the whole platform. It should sell one focused device,
          likely a split macro pad or creator command console, with BreakGen shown as the system
          that produced the files, records, and build guide.
        </p>
        <div className="kickstarter-runway__actions">
          <button
            type="button"
            onClick={() => {
              trackEvent("landing_cta_click", { surface: "landing", target: "kickstarter_interest", placement: "kickstarter" });
              window.dispatchEvent(new CustomEvent("breakgen:open-launch-capture", { detail: { mode: "research" } }));
            }}
            className="surface-button-primary inline-flex h-11 items-center rounded-full px-5 text-[13px] font-semibold"
          >
            Help choose the first kit
          </button>
          <a
            href="https://help.kickstarter.com/hc/en-us/articles/115005134554-What-are-the-rules-for-hardware-and-product-design-projects"
            target="_blank"
            rel="noopener"
            onClick={() => trackEvent("landing_cta_click", { surface: "landing", target: "kickstarter_rules", placement: "kickstarter" })}
            className="surface-button inline-flex h-11 items-center rounded-full px-5 text-[13px] font-semibold"
          >
            Hardware campaign rules
          </a>
        </div>
      </div>

      <div className="kickstarter-runway__track">
        {KICKSTARTER_PATH.map((item, index) => (
          <article
            key={item.gate}
            className="kickstarter-gate"
            style={{ "--gate-index": index } as CSSProperties}
          >
            <div className="kickstarter-gate__index">0{index + 1}</div>
            <div>
              <span>{item.status}</span>
              <h3>{item.gate}</h3>
              <p>{item.detail}</p>
            </div>
          </article>
        ))}
      </div>

      <aside className="kickstarter-ledger">
        <div className="eyebrow">Campaign shape</div>
        <div className="kickstarter-ledger__stat">
          <b>10</b>
          <span>pilot units before a public campaign page</span>
        </div>
        <div className="kickstarter-ledger__stat">
          <b>1</b>
          <span>hero kit, limited variants, no broad marketplace promise</span>
        </div>
        <div className="kickstarter-ledger__stat">
          <b>6</b>
          <span>weeks for list building, supplier quotes, rewards, and fulfillment math</span>
        </div>
      </aside>
    </section>
  );
}

function NavCta() {
  const user = useAuthStore((state) => state.user);

  if (PUBLIC_SITE) {
    return (
      <Link
        to={PUBLIC_DEMO_PATH}
        onClick={() => trackEvent("landing_cta_click", { surface: "landing", target: "public_demo", placement: "nav" })}
        className="surface-button-primary inline-flex h-11 items-center rounded-full px-5 text-[13px] font-semibold"
      >
        Open demo
      </Link>
    );
  }

  if (user) {
    return (
      <Link
        to="/app"
        onClick={() => trackEvent("landing_cta_click", { surface: "landing", target: "workspace", placement: "nav" })}
        className="surface-button-primary inline-flex h-11 items-center rounded-full px-5 text-[13px] font-semibold"
      >
        Open workspace
      </Link>
    );
  }

  return (
    <Link
      to="/login"
      onClick={() => trackEvent("landing_cta_click", { surface: "landing", target: "login", placement: "nav" })}
      className="surface-button-primary inline-flex h-11 items-center rounded-full px-5 text-[13px] font-semibold"
    >
      Enter alpha
    </Link>
  );
}

function CompilerConsole() {
  return (
    <div className="compiler-console">
      <div className="compiler-console__toolbar">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
            Revision compiler
          </div>
          <div className="mt-1 text-[15px] font-semibold text-[var(--text-primary)]">
            yc_proof_streamdeck
          </div>
        </div>
        <div className="compiler-console__status">validated</div>
      </div>

      <div className="compiler-device">
        <div className="compiler-device__screen">
          <span>Stream</span>
        </div>
        <div className="compiler-device__button compiler-device__button--up" />
        <div className="compiler-device__button compiler-device__button--left" />
        <div className="compiler-device__button compiler-device__button--right" />
        <div className="compiler-device__button compiler-device__button--down" />
        <div className="compiler-device__button compiler-device__button--a" />
        <div className="compiler-device__button compiler-device__button--b" />
        <div className="compiler-device__speaker">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="compiler-device__battery">LiPo</div>
        <div className="compiler-device__port">USB-C</div>
      </div>

      <div className="compiler-tracks">
        {COMPILER_TRACKS.map((track) => (
          <div key={track.label} className="compiler-track">
            <div className="compiler-track__head">
              <span>{track.label}</span>
              <b style={{ background: track.tone }} />
            </div>
            <div className="compiler-track__value">{track.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Landing() {
  useEffect(() => {
    document.title = PUBLIC_SITE
      ? "BreakGen - Public Launch"
      : "BreakGen - Creative and Engineering Platform for Custom Electronic Products";
    trackEvent("landing_view", { surface: "landing" });
  }, []);

  return (
    <div className="marketing-shell marketing-shell--revamp min-h-screen overflow-hidden px-5 py-5 md:px-8 md:py-8">
      <div className="landing-grid absolute inset-0 opacity-70" />
      <div className="landing-beam landing-beam--one absolute left-[6%] top-[8rem]" />
      <div className="landing-beam landing-beam--two absolute right-[4%] top-[18rem]" />

      <div className="relative z-10 mx-auto max-w-[1380px]">
        <nav className="surface-toolbar mb-7 flex items-center justify-between rounded-[24px] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="surface-chip flex h-11 w-11 items-center justify-center rounded-2xl">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1" fill="var(--accent)" />
                <rect x="9" y="3" width="6" height="4" rx="1" fill="var(--accent)" opacity="0.48" />
                <rect x="1" y="9" width="14" height="4" rx="1" fill="var(--accent)" opacity="0.24" />
              </svg>
            </div>
            <div>
              <div className="text-[15px] font-semibold text-[var(--text-primary)]">BreakGen</div>
              <div className="hidden text-[12px] text-[var(--text-tertiary)] sm:block">
                Private alpha for custom programmable hardware
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener"
              onClick={() => trackEvent("landing_cta_click", { surface: "landing", target: "github", placement: "nav" })}
              className="surface-button hidden h-11 items-center rounded-full px-4 text-[13px] font-semibold lg:inline-flex"
            >
              GitHub
            </a>
            <NavCta />
          </div>
        </nav>

        <section className="hero-revamp grid gap-6 lg:grid-cols-[minmax(0,0.98fr)_minmax(380px,0.72fr)]">
          <div className="hero-revamp__copy rounded-[34px] p-7 md:p-10 lg:p-12">
            <div className="eyebrow">Programmable hardware studio</div>
            <h1 className="mt-6 max-w-[900px] text-[48px] font-semibold leading-[0.9] tracking-[-0.065em] text-[var(--text-primary)] md:text-[74px] lg:text-[92px]">
              From intent to validated hardware proof, with the receipts attached.
            </h1>
            <p className="mt-7 max-w-[700px] text-[16px] leading-[1.85] text-[var(--text-secondary)]">
              BreakGen is a product studio for custom programmable hardware.
              It lets makers shape the visible object, then compiles the build evidence:
              geometry, GPIO usage, firmware metadata, validation, exports, and provenance.
            </p>

            <div className="section-rule mt-10 grid gap-5 pt-7 md:grid-cols-3">
              {LIVE_SCOPE.map(([value, label]) => (
                <div key={label}>
                  <div className="text-[42px] font-semibold leading-none tracking-[-0.055em] text-[var(--text-primary)]">
                    {value}
                  </div>
                  <div className="mt-2 text-[13px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <NavCta />
              <Link
                to={PUBLIC_DEMO_PATH}
                onClick={() => trackEvent("landing_cta_click", { surface: "landing", target: "public_demo", placement: "hero_secondary" })}
                className="surface-button inline-flex h-11 items-center rounded-full px-5 text-[13px] font-semibold"
              >
                View workspace demo
              </Link>
            </div>
          </div>

          <aside className="hero-revamp__visual rounded-[34px] p-4 md:p-5">
            <CompilerConsole />
          </aside>
        </section>

        <section className="section-rule mt-10 pt-10">
          <div className="grid gap-8 lg:grid-cols-3">
            {PLATFORM_PILLARS.map((pillar) => (
              <article key={pillar.label} className="surface-soft rounded-[28px] p-6">
                <div className="eyebrow">{pillar.label}</div>
                <h2 className="mt-4 text-[26px] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--text-primary)]">
                  {pillar.title}
                </h2>
                <p className="mt-4 text-[14px] leading-[1.8] text-[var(--text-secondary)]">
                  {pillar.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-rule mt-10 grid gap-8 pt-10 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div>
            <div className="eyebrow">Workflow</div>
            <h2 className="mt-4 text-[36px] font-semibold leading-[0.96] tracking-normal text-[var(--text-primary)]">
              A product loop, not a disconnected stack of tools.
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {CREATIVE_LOOP.map((item) => (
              <article key={item.step} className="surface-panel rounded-[28px] p-6">
                <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  {item.step}
                </div>
                <h3 className="mt-4 text-[20px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.8] text-[var(--text-secondary)]">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-rule mt-10 grid gap-8 pt-10 lg:grid-cols-[minmax(0,0.84fr)_minmax(360px,0.52fr)]">
          <div>
            <div className="eyebrow">How it is built</div>
            <h2 className="mt-4 max-w-[760px] text-[40px] font-semibold leading-[0.95] tracking-[-0.055em] text-[var(--text-primary)] md:text-[52px]">
              BreakGen is an intent compiler with a visible evidence trail.
            </h2>
            <p className="mt-5 max-w-[700px] text-[15px] leading-[1.85] text-[var(--text-secondary)]">
              The product does not stop at a render. Each project moves through a
              revisioned state model, family-aware compilers, validation gates, and
              durable artifact records so the output can be inspected after the design changes.
            </p>

            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {BUILD_PIPELINE.map((item) => (
                <article key={item.label} className="surface-panel rounded-[26px] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="eyebrow">{item.label}</div>
                    <span className="surface-chip rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      {item.artifact}
                    </span>
                  </div>
                  <h3 className="mt-4 text-[20px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[13px] leading-[1.75] text-[var(--text-secondary)]">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <aside className="surface-strong rounded-[32px] p-6">
            <div className="eyebrow">Reviewer proof path</div>
            <h3 className="mt-4 text-[28px] font-semibold leading-[1] tracking-[-0.045em] text-[var(--text-primary)]">
              A real bundle can be generated from the repo.
            </h3>
            <p className="mt-4 text-[13px] leading-[1.8] text-[var(--text-secondary)]">
              The public site is static, but the repository includes a deterministic
              backend proof that creates a Stream Deck project, compiles it, validates it,
              exports a ZIP, and prints the SHA-256.
            </p>

            <div className="mt-6 overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-subtle)]">
              {PROOF_RECEIPT.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)] border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    {label}
                  </span>
                  <span className="font-mono text-[12px] text-[var(--text-primary)]">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="surface-panel rounded-[22px] p-4">
                <div className="text-[30px] font-semibold leading-none tracking-[-0.05em] text-[var(--text-primary)]">
                  r2
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  exported revision
                </div>
              </div>
              <div className="surface-panel rounded-[22px] p-4">
                <div className="text-[30px] font-semibold leading-none tracking-[-0.05em] text-[var(--text-primary)]">
                  4
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  durable artifacts
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="section-rule mt-10 grid gap-8 pt-10 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div>
            <div className="eyebrow">Thingiverse signal</div>
            <h2 className="mt-4 text-[36px] font-semibold leading-[0.96] tracking-[-0.05em] text-[var(--text-primary)]">
              The demand already exists. The missing layer is the compiler.
            </h2>
            <p className="mt-4 text-[14px] leading-[1.8] text-[var(--text-secondary)]">
              Public maker libraries are full of one-off macro pads, stream-deck alternatives,
              MIDI enclosures, and controller shells. They prove people want custom electronics,
              but the workflow still depends on copying files, reading comments, and hand-adapting geometry.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {MAKER_SIGNALS.map((signal) => (
              <article key={signal.label} className="surface-panel rounded-[26px] p-5">
                <div className="eyebrow">{signal.label}</div>
                <p className="mt-4 text-[14px] leading-[1.8] text-[var(--text-secondary)]">
                  {signal.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <ComingSoonLab />

        <KickstarterRunway />

        <section className="section-rule mt-10 pt-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="eyebrow">Families live now</div>
              <h2 className="mt-4 text-[36px] font-semibold leading-[0.96] tracking-[-0.05em] text-[var(--text-primary)]">
                Five alpha families sharing one platform spine.
              </h2>
            </div>
            <p className="max-w-[520px] text-[14px] leading-[1.8] text-[var(--text-secondary)]">
              The reviewer-facing scope stays on control surfaces. Pedal, breath, and handheld
              companion templates remain proof paths until their workflows are mature enough for alpha users.
            </p>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRODUCT_FAMILIES.map((family) => (
              <article key={family.id} className="surface-panel rounded-[28px] p-5">
                <div
                  className="surface-subcard flex h-20 items-center justify-center rounded-[20px]"
                  style={{ background: `${family.accent}14` }}
                >
                  <Glyph rows={family.rows} color={family.accent} />
                </div>
                <h3 className="mt-5 text-[18px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                  {family.name}
                </h3>
                <p className="mt-3 text-[13px] leading-[1.75] text-[var(--text-secondary)]">
                  {family.note}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {PROOF_FAMILIES.map((family) => (
              <span key={family} className="surface-chip rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                proof: {family}
              </span>
            ))}
          </div>
        </section>

        <section className="section-rule mt-10 grid gap-8 pt-10 lg:grid-cols-[420px_minmax(0,1fr)]">
          <div>
            <div className="eyebrow">Trust stack</div>
            <h2 className="mt-4 text-[36px] font-semibold leading-[0.96] tracking-[-0.05em] text-[var(--text-primary)]">
              The value is not the render. The value is the system behind it.
            </h2>
            <p className="mt-4 text-[14px] leading-[1.8] text-[var(--text-secondary)]">
              BreakGen works when the visible product and the build path stay connected.
              The export story becomes better when it tells the truth about what was compiled.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {TRUST_STACK.map((item) => (
              <article key={item.label} className="section-rule pt-4">
                <div className="eyebrow">{item.label}</div>
                <p className="mt-3 text-[14px] leading-[1.8] text-[var(--text-secondary)]">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="surface-strong mt-12 rounded-[34px] px-7 py-8 md:px-10 md:py-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="eyebrow">Final CTA</div>
              <h2 className="mt-4 text-[38px] font-semibold leading-[0.94] tracking-[-0.05em] text-[var(--text-primary)]">
                Launch the workspace. Inspect the demo. Judge the compiled evidence.
              </h2>
              <p className="mt-4 max-w-[760px] text-[15px] leading-[1.85] text-[var(--text-secondary)]">
                The public site is meant to feel like a product surface, not a decorative landing page.
                Use the demo to see the authoring loop, then inspect the repo for the deeper compiler path.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              <NavCta />
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener"
                onClick={() => trackEvent("landing_cta_click", { surface: "landing", target: "github", placement: "final" })}
                className="surface-button inline-flex h-11 items-center rounded-full px-5 text-[13px] font-semibold"
              >
                View repository
              </a>
            </div>
          </div>
        </section>
      </div>
      <LaunchCapture surface="landing" />
    </div>
  );
}
