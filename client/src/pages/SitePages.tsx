import { useEffect, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { LaunchCapture } from "../components/LaunchCapture";
import { SiteNav } from "../components/SiteNav";
import { trackEvent } from "../lib/analytics";

type ProcessVisual = "marketplace" | "compiler" | "creators" | "manufacturing";

const PROCESS_CAPTION: Record<ProcessVisual, string> = {
  marketplace: "Customizable products, constrained baselines, and proof before checkout.",
  compiler: "Layout, electronics, validation, and exports stay tied to one source record.",
  creators: "Research calls become controls, mappings, templates, and manufacturable pressure.",
  manufacturing: "Bench constraints, fit checks, sourcing, and pilot economics live together.",
};

const MARKET_PRODUCTS = [
  {
    name: "Creator Deck 15",
    family: "Command console",
    price: "$129 pilot target",
    build: "LCD buttons, USB-C, printed shell, scene profiles",
    status: "alpha interest",
    accent: "#4db7ff",
  },
  {
    name: "Split Macro Kit",
    family: "Macro pad",
    price: "$89 pilot target",
    build: "MX switches, encoders, OLED slot, RP2040 baseline",
    status: "closest to build",
    accent: "#8b93ff",
  },
  {
    name: "MIDI Sketch Surface",
    family: "Music controller",
    price: "$149 research target",
    build: "pads, sliders, knobs, USB MIDI map",
    status: "workflow calls",
    accent: "#d978b3",
  },
  {
    name: "Accessible Input Rig",
    family: "Assistive control",
    price: "co-design only",
    build: "large buttons, joystick, mountable panel",
    status: "partner research",
    accent: "#48d48b",
  },
  {
    name: "Dev Board Shell",
    family: "Enclosure kit",
    price: "$39 print target",
    build: "board carrier, port cutouts, screw posts, print profile",
    status: "fit checks",
    accent: "#d0a16c",
  },
  {
    name: "Performance Pedal Row",
    family: "Foot controller",
    price: "$119 proof target",
    build: "stomp switches, status LEDs, expression input",
    status: "durability tests",
    accent: "#ebb156",
  },
];

const COMPILER_STEPS = [
  {
    step: "Choose",
    title: "Start from a product family, not a blank canvas.",
    body: "A kit begins with real constraints: controls, ports, modules, enclosure strategy, firmware path, and the likely way it gets built.",
  },
  {
    step: "Customize",
    title: "Change the visible object while BreakGen keeps the engineering record attached.",
    body: "Layouts, modules, colors, labels, and case assumptions stay in one project so the shopper is not just decorating a flat preview.",
  },
  {
    step: "Prove",
    title: "Show manufacturability before anyone pays.",
    body: "The system exposes fit checks, source parts, validation notes, export readiness, and known risks before a product becomes a pilot SKU.",
  },
  {
    step: "Ship",
    title: "Move validated designs into limited runs.",
    body: "The business starts with small pilot batches and creator preorders, then adds fulfillment partners when the proof is repeatable.",
  },
];

const CREATOR_LANES = [
  {
    title: "Makers",
    body: "People who already remix files and want a cleaner path from idea to a physical control surface.",
    ask: "Vote on templates, test exports, report fit issues.",
  },
  {
    title: "Creators",
    body: "Streamers, musicians, video editors, and live performers who know exactly where their workflow hurts.",
    ask: "Bring real shortcuts, mappings, scenes, and naming pressure.",
  },
  {
    title: "Hardware founders",
    body: "Builders who want faster validation before paying for CAD, PCB, firmware, and manufacturing work separately.",
    ask: "Use BreakGen as the first prototype operating system.",
  },
];

const MANUFACTURING_GATES = [
  ["Source truth", "Named modules, board assumptions, suppliers, footprints, and part alternatives."],
  ["Fit proof", "Panel clearances, mounting, port access, screw strategy, print notes, and assembly risks."],
  ["Pilot economics", "Target price, estimated BOM, print time, labor time, packaging, and support load."],
  ["Fulfillment path", "Small batch first, then partner manufacturing only after defect patterns are known."],
];

function openCapture(mode: "alpha" | "research" | "discord", placement: string) {
  trackEvent("site_page_cta_click", { mode, placement });
  window.dispatchEvent(new CustomEvent("breakgen:open-launch-capture", { detail: { mode } }));
}

function SitePageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-shell marketing-shell--revamp min-h-screen overflow-hidden px-5 py-5 md:px-8 md:py-8">
      <div className="landing-grid absolute inset-0 opacity-60" />
      <div className="landing-beam landing-beam--one absolute left-[6%] top-[8rem]" />
      <div className="landing-beam landing-beam--two absolute right-[4%] top-[18rem]" />
      <div className="relative z-10 mx-auto max-w-[1380px]">
        <SiteNav />
        {children}
      </div>
      <LaunchCapture surface="landing" />
    </div>
  );
}

function PageHero({
  eyebrow,
  title,
  body,
  visual,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  visual: ProcessVisual;
  children?: React.ReactNode;
}) {
  return (
    <section className="site-page-hero">
      <div className="site-page-hero__copy">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{body}</p>
        {children}
      </div>
      <figure className="site-photo-frame">
        <div className={`site-process-visual site-process-visual--${visual}`} role="img" aria-label={PROCESS_CAPTION[visual]}>
          <div className="site-process-visual__bench">
            <span />
            <span />
            <span />
          </div>
          <div className="site-process-visual__device">
            {Array.from({ length: 15 }).map((_, index) => (
              <i key={index} />
            ))}
          </div>
          <div className="site-process-visual__tools">
            <span />
            <span />
            <span />
          </div>
        </div>
        <figcaption>{PROCESS_CAPTION[visual]}</figcaption>
      </figure>
    </section>
  );
}

export function MarketplacePage() {
  useEffect(() => {
    document.title = "Marketplace - BreakGen";
    trackEvent("site_page_view", { page: "marketplace" });
  }, []);

  return (
    <SitePageShell>
      <PageHero
        eyebrow="Marketplace"
        title="A pilot catalog for customizable control hardware."
        body="The first BreakGen marketplace is a focused catalog, not an endless warehouse. Each item starts from a constrained baseline, then carries validation, pricing assumptions, and pilot-readiness before it becomes a SKU."
        visual="marketplace"
      >
        <div className="site-hero-actions">
          <button type="button" className="surface-button-primary" onClick={() => openCapture("alpha", "marketplace_hero")}>
            Join marketplace alpha
          </button>
          <Link to="/demo/" className="surface-button" onClick={() => trackEvent("site_page_cta_click", { target: "demo", placement: "marketplace_hero" })}>
            Inspect compiler demo
          </Link>
        </div>
      </PageHero>

      <section className="marketplace-board section-rule">
        <div className="marketplace-board__intro">
          <div className="eyebrow">Pilot catalog</div>
          <h2>Shop the kind of thing, then shape the exact device.</h2>
          <p>
            The catalog is organized around real buying intent: streamers want decks,
            musicians want controllers, founders want prototype shells, makers want kits.
          </p>
        </div>
        <div className="marketplace-grid">
          {MARKET_PRODUCTS.map((product) => (
            <article key={product.name} className="market-product" style={{ "--market-accent": product.accent } as CSSProperties}>
              <div className="market-product__top">
                <span>{product.family}</span>
                <b>{product.status}</b>
              </div>
              <div className="market-product__device" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <h3>{product.name}</h3>
              <p>{product.build}</p>
              <div className="market-product__footer">
                <span>{product.price}</span>
                <button type="button" onClick={() => openCapture("research", `marketplace_${product.name}`)}>
                  Request
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </SitePageShell>
  );
}

export function HowItWorksPage() {
  useEffect(() => {
    document.title = "How It Works - BreakGen";
    trackEvent("site_page_view", { page: "how_it_works" });
  }, []);

  return (
    <SitePageShell>
      <PageHero
        eyebrow="How it works"
        title="A product configurator with an engineering compiler underneath."
        body="Most custom shops collect options. BreakGen has to collect intent, then maintain the state needed to make the product real: geometry, electronics, validation, exports, and source proof."
        visual="compiler"
      >
        <div className="site-hero-actions">
          <Link to="/marketplace/" className="surface-button-primary">
            Browse pilot catalog
          </Link>
          <button type="button" className="surface-button" onClick={() => openCapture("research", "how_it_works")}>
            Show us a workflow
          </button>
        </div>
      </PageHero>

      <section className="compiler-road section-rule">
        {COMPILER_STEPS.map((item, index) => (
          <article key={item.step} className="compiler-road__step">
            <div className="compiler-road__index">0{index + 1}</div>
            <div>
              <span>{item.step}</span>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </div>
          </article>
        ))}
      </section>
    </SitePageShell>
  );
}

export function CreatorsPage() {
  useEffect(() => {
    document.title = "Creators - BreakGen";
    trackEvent("site_page_view", { page: "creators" });
  }, []);

  return (
    <SitePageShell>
      <PageHero
        eyebrow="Creator network"
        title="The community is the product discovery engine."
        body="BreakGen learns from people who actually build, stream, perform, repair, remix, and ship. Creators get clear paths into alpha access, research calls, and template decisions."
        visual="creators"
      >
        <div className="site-hero-actions">
          <button type="button" className="surface-button-primary" onClick={() => openCapture("discord", "creators_hero")}>
            Join the build room
          </button>
          <button type="button" className="surface-button" onClick={() => openCapture("research", "creators_hero")}>
            Book a research call
          </button>
        </div>
      </PageHero>

      <section className="creator-lanes section-rule">
        {CREATOR_LANES.map((lane) => (
          <article key={lane.title} className="creator-lane">
            <h2>{lane.title}</h2>
            <p>{lane.body}</p>
            <span>{lane.ask}</span>
          </article>
        ))}
      </section>

      <section className="creator-dispatch">
        <div>
          <div className="eyebrow">Dispatches</div>
          <h2>Posts worth adding next</h2>
        </div>
        <div className="creator-dispatch__list">
          {[
            "What we learned from the first 20 custom-control workflows",
            "The split macro pad BOM we would trust for a 10-unit pilot",
            "How to turn a Thingiverse-style remix into a manufacturable kit",
          ].map((title) => (
            <article key={title}>
              <span>Coming soon</span>
              <h3>{title}</h3>
            </article>
          ))}
        </div>
      </section>
    </SitePageShell>
  );
}

export function ManufacturingPage() {
  useEffect(() => {
    document.title = "Manufacturing - BreakGen";
    trackEvent("site_page_view", { page: "manufacturing" });
  }, []);

  return (
    <SitePageShell>
      <PageHero
        eyebrow="Manufacturing"
        title="A custom marketplace only works if the promise survives the bench."
        body="BreakGen keeps the manufacturing promise visible. Customizable products become credible when sourcing, fit, pilot economics, and fulfillment live inside the product record."
        visual="manufacturing"
      >
        <div className="site-hero-actions">
          <button type="button" className="surface-button-primary" onClick={() => openCapture("alpha", "manufacturing_hero")}>
            Follow pilot builds
          </button>
          <Link to="/how-it-works/" className="surface-button">
            See compiler path
          </Link>
        </div>
      </PageHero>

      <section className="manufacturing-ledger section-rule">
        <div className="manufacturing-ledger__intro">
          <div className="eyebrow">Readiness gates</div>
          <h2>Every product listing gets a proof ledger before it looks shippable.</h2>
        </div>
        <div className="manufacturing-ledger__grid">
          {MANUFACTURING_GATES.map(([title, body], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </SitePageShell>
  );
}
