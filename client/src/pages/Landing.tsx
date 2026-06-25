import { useEffect, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { LaunchCapture } from "../components/LaunchCapture";
import { SiteNav } from "../components/SiteNav";
import { trackEvent } from "../lib/analytics";
import { PUBLIC_DEMO_PATH, PUBLIC_SITE, REPO_URL } from "../lib/runtime";
import { useAuthStore } from "../stores/authStore";

const HERO_RECEIPT = [
  ["family", "split macro kit"],
  ["source", "mx + rp2040"],
  ["artifact", "panel.dxf"],
  ["status", "review ready"],
];

const PROOF_CHAIN = [
  {
    label: "Author",
    title: "Shape the thing",
    body: "Family, layout, modules, shell intent, and accepted assets stay in one revisioned project.",
    code: "intent.locked",
  },
  {
    label: "Compile",
    title: "Derive the build",
    body: "Mechanical outputs, electronics metadata, firmware maps, and validation reports come from the same state.",
    code: "compiler.clean",
  },
  {
    label: "Prove",
    title: "Keep the receipt",
    body: "Artifacts carry revision, producer, checksum, and readiness context so the output can be judged later.",
    code: "sha256.bound",
  },
];

const FAMILY_RAIL = [
  {
    name: "Split macro pad",
    stage: "alpha kit candidate",
    detail: "MX plate, encoder, OLED slot, RP2040 map",
    accent: "#8991ff",
    cols: 4,
  },
  {
    name: "Creator console",
    stage: "coming soon",
    detail: "Display buttons, scene profiles, USB-C shell",
    accent: "#54bfff",
    cols: 5,
  },
  {
    name: "MIDI sketch deck",
    stage: "prototype lane",
    detail: "Pads, sliders, knobs, USB MIDI target",
    accent: "#df78b4",
    cols: 6,
  },
  {
    name: "Assistive input rig",
    stage: "research lane",
    detail: "Large controls, joystick, mounts, fit notes",
    accent: "#54d88c",
    cols: 3,
  },
];

const SYSTEM_RULES = [
  "No artifact without a revision",
  "No export without validation",
  "No product family without module truth",
  "No campaign promise without pilot evidence",
];

function openLaunchCapture(mode: "waitlist" | "research" = "waitlist") {
  window.dispatchEvent(new CustomEvent("breakgen:open-launch-capture", { detail: { mode } }));
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

function HeroInstrument() {
  return (
    <div className="front-instrument" aria-label="BreakGen hardware proof instrument">
      <div className="front-instrument__topline">
        <span>BreakGen canvas</span>
        <b>proof ready</b>
      </div>

      <div className="front-device-stage" aria-hidden="true">
        <div className="front-device-stage__orbit front-device-stage__orbit--outer" />
        <div className="front-device-stage__orbit front-device-stage__orbit--inner" />
        <div className="front-device">
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={index} style={{ "--key-index": index } as CSSProperties} />
          ))}
          <i className="front-device__dial" />
          <i className="front-device__port" />
        </div>
      </div>

      <div className="front-receipt">
        {HERO_RECEIPT.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProofChain() {
  return (
    <section className="front-proof section-rule">
      <div className="front-section-kicker">
        <span>Continuous loop</span>
        <h2>From sketch to build files and back, without losing the source of truth.</h2>
      </div>

      <div className="front-proof__chain">
        {PROOF_CHAIN.map((item, index) => (
          <article
            key={item.label}
            className="front-proof-step"
            style={{ "--step-index": index } as CSSProperties}
          >
            <div className="front-proof-step__index">0{index + 1}</div>
            <span>{item.label}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
            <code>{item.code}</code>
          </article>
        ))}
      </div>
    </section>
  );
}

function FamilyRail() {
  return (
    <section className="front-rail section-rule">
      <div className="front-rail__copy">
        <div className="front-section-kicker">
          <span>Device families</span>
          <h2>A product canvas for the workspace objects people actually want.</h2>
        </div>
        <p>
          Start with programmable control surfaces, then expand only where the parts, enclosures,
          validation, and supply chain repeat well enough to become real.
        </p>
      </div>

      <div className="front-family-track">
        {FAMILY_RAIL.map((family, familyIndex) => (
          <article
            key={family.name}
            className="front-family-card"
            style={{ "--family-accent": family.accent, "--family-index": familyIndex } as CSSProperties}
          >
            <div className="front-family-card__specimen" aria-hidden="true">
              {Array.from({ length: family.cols * 2 }).map((_, index) => (
                <span key={index} />
              ))}
            </div>
            <div>
              <span>{family.stage}</span>
              <h3>{family.name}</h3>
              <p>{family.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function EvidencePanel() {
  return (
    <section className="front-evidence section-rule">
      <div className="front-evidence__console">
        <div className="front-evidence__header">
          <span>yc proof bundle</span>
          <b>make demo-proof</b>
        </div>
        <div className="front-evidence__rows">
          {[
            ["project", "yc_proof_streamdeck"],
            ["mechanical", "panel.dxf + summary"],
            ["electronics", "hid control surface"],
            ["validation", "9 checks, 0 blockers"],
            ["export", "zip + sha256"],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="front-evidence__copy">
        <div className="front-section-kicker">
          <span>Code connected</span>
          <h2>The attractive surface still has to compile into proof.</h2>
        </div>
        <p>
          The website can feel soft and visual, but the product still needs hard edges:
          project state, validation gates, generated artifacts, owner scoped downloads, and export provenance.
        </p>
        <div className="front-rule-stack">
          {SYSTEM_RULES.map((rule) => (
            <span key={rule}>{rule}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Landing() {
  useEffect(() => {
    document.title = PUBLIC_SITE
      ? "BreakGen - Public Launch"
      : "BreakGen - Design Physical Hardware";
    trackEvent("landing_view", { surface: "landing" });
  }, []);

  return (
    <div className="marketing-shell marketing-shell--revamp front-system min-h-screen overflow-hidden px-5 py-5 md:px-8 md:py-8">
      <div className="landing-grid absolute inset-0 opacity-70" />
      <div className="landing-beam landing-beam--one absolute left-[6%] top-[8rem]" />
      <div className="landing-beam landing-beam--two absolute right-[4%] top-[18rem]" />

      <div className="relative z-10 mx-auto max-w-[1380px]">
        <SiteNav />

        <main className="front-page">
          <section className="front-hero">
            <div className="front-hero__copy">
              <div className="eyebrow">Programmable hardware canvas</div>
              <h1>design physical</h1>
              <p>
                BreakGen is a canvas for custom workspace devices. Shape the object visually,
                then keep the engineering proof attached: geometry, electronics, validation,
                exports, and provenance.
              </p>

              <div className="front-hero__actions">
                <NavCta />
                <button
                  type="button"
                  onClick={() => {
                    trackEvent("landing_cta_click", { surface: "landing", target: "waitlist", placement: "hero" });
                    openLaunchCapture("waitlist");
                  }}
                  className="surface-button inline-flex h-11 items-center rounded-full px-5 text-[13px] font-semibold"
                >
                  Join build list
                </button>
              </div>
            </div>

            <HeroInstrument />
          </section>

          <ProofChain />
          <FamilyRail />
          <EvidencePanel />

          <section className="front-community">
            <div>
              <span>Launch room</span>
              <h2>Open the workshop before the marketplace gets big.</h2>
              <p>
                The near term goal is a focused pilot, a community of early builders, and a public trail of what worked,
                what failed, and what needs to become manufacturable before a campaign.
              </p>
            </div>
            <div className="front-community__actions">
              <button
                type="button"
                onClick={() => {
                  trackEvent("landing_cta_click", { surface: "landing", target: "research", placement: "community" });
                  openLaunchCapture("research");
                }}
                className="surface-button-primary inline-flex h-11 items-center rounded-full px-5 text-[13px] font-semibold"
              >
                Help choose the first kit
              </button>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener"
                onClick={() => trackEvent("landing_cta_click", { surface: "landing", target: "github", placement: "community" })}
                className="surface-button inline-flex h-11 items-center rounded-full px-5 text-[13px] font-semibold"
              >
                Inspect the repo
              </a>
            </div>
          </section>
        </main>
      </div>
      <LaunchCapture surface="landing" />
    </div>
  );
}
