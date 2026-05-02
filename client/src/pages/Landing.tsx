import { useEffect, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { PUBLIC_DEMO_PATH, PUBLIC_SITE, REPO_URL } from "../lib/runtime";
import { useAuthStore } from "../stores/authStore";

const PRODUCTS = [
  {
    id: "keyboard",
    name: "Keyboards",
    eyebrow: "Precision layouts",
    desc: "Staggered boards with switch-aware layout editing, plate geometry, matrix compilation, firmware metadata, and export provenance.",
    accent: "#8b7cff",
    rows: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
      [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
      [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
      [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
      [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
    ],
  },
  {
    id: "macropad",
    name: "Macro Pads",
    eyebrow: "Fastest route to hardware",
    desc: "Compact control pads that reuse the same creative loop, from grid editing to PCB metadata and fabrication bundle.",
    accent: "#49d17d",
    rows: [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ],
  },
  {
    id: "streamdeck",
    name: "Stream Decks",
    eyebrow: "Control surfaces",
    desc: "Wide-spaced command decks for streaming, broadcasting, scene changes, and content workflows.",
    accent: "#f0b24a",
    rows: [
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
    ],
  },
  {
    id: "midi",
    name: "MIDI Controllers",
    eyebrow: "Performance interfaces",
    desc: "Keys, encoders, and controller surfaces designed as one system instead of stitched across unrelated tools.",
    accent: "#ff72bf",
    rows: [
      [0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
  {
    id: "gamepad",
    name: "Gamepads",
    eyebrow: "Button-first controls",
    desc: "Compact controller surfaces that combine button clusters, layout editing, enclosure geometry, and export lineage in one workspace.",
    accent: "#38bdf8",
    rows: [
      [0, 1, 0, 1, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 0, 1, 0],
    ],
  },
];

const CREATIVE_LOOP = [
  {
    id: "01",
    title: "Imagine",
    subtitle: "Start from intent, not file formats",
    body: "Prompt a direction, choose a family, and turn an abstract idea into an editable product spec with visible structure.",
  },
  {
    id: "02",
    title: "Compose",
    subtitle: "Shape the object while the system keeps up",
    body: "Layout, switch choice, keycap generation, preview, and electronics all stay in one environment instead of bouncing across disconnected apps.",
  },
  {
    id: "03",
    title: "Manufacture",
    subtitle: "Leave with real outputs",
    body: "Validation, plate geometry, firmware metadata, export bundles, and artifact history are part of the same product record.",
  },
];

const STACK = [
  {
    title: "Creative input",
    body: "Natural-language direction, presets, templates, and family-specific editing.",
  },
  {
    title: "3D generation",
    body: "Meshy now, provider-ready pipeline next. Generated assets flow into normalization, validation, and provenance.",
  },
  {
    title: "Engineering output",
    body: "Layout, matrix, plate, firmware, validation, and export artifacts all derive from the same revisioned project state.",
  },
];

const DIFFERENTIATORS = [
  "Not just image generation. The output becomes assignable, traceable 3D product state.",
  "Not just CAD. Creative exploration and engineering constraints live in one loop.",
  "Not just firmware tools. Geometry, electronics, assets, and exports stay connected.",
];

function Glyph({
  rows,
  color,
  size = 8,
}: {
  rows: number[][];
  color: string;
  size?: number;
}) {
  return (
    <div className="flex flex-col items-center" style={{ gap: `${size * 0.35}px` }}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex" style={{ gap: `${size * 0.35}px` }}>
          {row.map((width, cellIndex) =>
            width > 0 ? (
              <div
                key={cellIndex}
                className="rounded-[3px]"
                style={{
                  width: `${width * size - size * 0.35}px`,
                  height: `${size - size * 0.35}px`,
                  background: color,
                  opacity: 0.72,
                }}
              />
            ) : (
              <div key={cellIndex} style={{ width: `${size * 0.65}px` }} />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#a39bff] mb-4">
      {children}
    </p>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
      <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <span className="ml-2 text-[12px] font-medium text-zinc-200">{value}</span>
    </div>
  );
}

function FeatureRail() {
  return (
    <div className="relative mx-auto max-w-[1200px] px-8">
      <div className="grid gap-4 rounded-[32px] border border-white/10 bg-[#0d0d12]/85 p-5 shadow-[0_40px_140px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Intent</div>
              <div className="mt-1 text-[15px] font-medium text-white">Build a cinematic 65% board in brushed graphite</div>
            </div>
            <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-emerald-300">
              live project
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {PRODUCTS.map((product, index) => (
              <div
                key={product.id}
                className={`rounded-[22px] border border-white/7 bg-black/20 p-4 ${index === 0 ? "md:col-span-2" : ""}`}
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.12em]" style={{ color: product.accent }}>
                      {product.eyebrow}
                    </div>
                    <div className="mt-1 text-[16px] font-semibold text-white">{product.name}</div>
                  </div>
                  <div
                    className="h-2.5 w-2.5 rounded-full shadow-[0_0_18px_currentColor]"
                    style={{ color: product.accent, background: product.accent }}
                  />
                </div>
                <div className="flex min-h-[84px] items-center justify-center rounded-[18px] border border-white/6 bg-white/[0.02]">
                  <Glyph rows={product.rows} color={product.accent} size={product.id === "keyboard" ? 6 : 9} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="float-slow rounded-[28px] border border-[#7e6dff]/16 bg-[radial-gradient(circle_at_top_left,rgba(126,109,255,0.18),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">3D pipeline</div>
            <div className="mt-2 text-[22px] font-semibold leading-[1.15] text-white">
              From visual direction to assigned printable assets.
            </div>
            <div className="mt-5 grid gap-3">
              {[
                "Mesh generation",
                "Normalization",
                "Preview mesh",
                "Accepted asset",
              ].map((item, index) => (
                <div key={item} className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                  <span className="text-[13px] text-zinc-200">{item}</span>
                  <span className="text-[11px] font-mono text-zinc-500">0{index + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="float-slow-delayed rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
            <div className="mb-4 text-[11px] uppercase tracking-[0.18em] text-zinc-500">Outputs</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Plate DXF", "Geometry"],
                ["Matrix + pins", "Electronics"],
                ["Firmware JSON", "QMK / VIA"],
                ["Export bundle", "Traceable"],
              ].map(([title, meta]) => (
                <div key={title} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-4">
                  <div className="text-[13px] font-medium text-white">{title}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.1em] text-zinc-500">{meta}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  const user = useAuthStore((state) => state.user);
  const cta = PUBLIC_SITE ? PUBLIC_DEMO_PATH : user ? "/app" : "/signup";

  useEffect(() => {
    document.title = PUBLIC_SITE
      ? "BreakGen — Public Launch Demo"
      : "BreakGen — Creative 3D Environment for Hardware";
  }, []);

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="landing-grid pointer-events-none fixed inset-0 opacity-70" />
      <div className="landing-orb pointer-events-none fixed left-[-12%] top-24 h-[34rem] w-[34rem]" />
      <div className="landing-orb-secondary pointer-events-none fixed right-[-8%] top-[28rem] h-[28rem] w-[28rem]" />

      <nav className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-18 max-w-[1240px] items-center justify-between px-6 lg:px-8">
          <Link to="/" className="glass rounded-full border border-white/10 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[linear-gradient(180deg,rgba(139,124,255,0.26),rgba(139,124,255,0.08))]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="3" width="6" height="4" rx="1.5" fill="#b7adff" />
                  <rect x="9" y="3" width="6" height="4" rx="1.5" fill="#b7adff" opacity="0.46" />
                  <rect x="1" y="9" width="14" height="4" rx="1.5" fill="#b7adff" opacity="0.24" />
                </svg>
              </div>
              <div>
                <div className="text-[14px] font-semibold tracking-[-0.02em] text-white">BreakGen</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">3D hardware environment</div>
              </div>
            </div>
          </Link>

          <div className="glass hidden items-center gap-1 rounded-full border border-white/10 px-2 py-2 md:flex">
            <a href="#families" className="rounded-full px-4 py-2 text-[13px] text-zinc-400 transition-colors hover:text-white">Families</a>
            <a href="#workflow" className="rounded-full px-4 py-2 text-[13px] text-zinc-400 transition-colors hover:text-white">Workflow</a>
            <a href="#stack" className="rounded-full px-4 py-2 text-[13px] text-zinc-400 transition-colors hover:text-white">Stack</a>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <Link to={PUBLIC_SITE ? PUBLIC_DEMO_PATH : "/app"} className="glass rounded-full border border-white/10 px-5 py-3 text-[13px] font-medium text-white transition-colors hover:border-white/20">
                {PUBLIC_SITE ? "Public demo" : "Dashboard"}
              </Link>
            ) : (
              <>
                {!PUBLIC_SITE && (
                  <Link to="/login" className="hidden rounded-full px-5 py-3 text-[13px] font-medium text-zinc-400 transition-colors hover:text-white sm:block">
                    Log in
                  </Link>
                )}
                <Link
                  to={PUBLIC_SITE ? PUBLIC_DEMO_PATH : "/signup"}
                  className="rounded-full bg-[#f5f3ff] px-5 py-3 text-[13px] font-semibold text-[#09090d] transition-colors hover:bg-white"
                >
                  {PUBLIC_SITE ? "Open demo" : "Get started"}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="relative overflow-hidden">
        <section className="px-6 pb-18 pt-34 lg:px-8 lg:pt-40">
          <div className="mx-auto max-w-[1240px]">
            {PUBLIC_SITE && (
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/18 bg-emerald-500/8 px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-emerald-300">
                Public launch build
                <span className="text-zinc-600">/</span>
                GitHub Pages + interactive demo
              </div>
            )}
            <div className="mb-12 max-w-[880px]">
              <SectionEyebrow>Creative environment for programmable hardware</SectionEyebrow>
              <h1
                className="max-w-[980px] text-[56px] font-semibold leading-[0.94] tracking-[-0.055em] text-white sm:text-[72px] lg:text-[104px]"
                style={{ textWrap: "balance" } as CSSProperties}
              >
                What should we build in
                <span className="ml-3 inline-block bg-[linear-gradient(90deg,#d9d2ff,#86e3ff,#ffc8eb)] bg-clip-text text-transparent">
                  3D?
                </span>
              </h1>
              <p
                className="mt-7 max-w-[720px] text-[17px] leading-[1.8] text-zinc-400 sm:text-[19px]"
                style={{ textWrap: "pretty" } as CSSProperties}
              >
                BreakGen is a creative operating surface for custom input hardware. Start from a mood, a layout, or a prompt, then move through 3D assets, electronics, validation, and export without falling out of the same environment.
              </p>
              {PUBLIC_SITE && (
                <p className="mt-4 max-w-[720px] text-[14px] leading-[1.8] text-zinc-500">
                  The public site ships a client-only demo for product feel and interaction. The full authenticated alpha with live backend compilers, jobs, and exports runs locally from the repository.
                </p>
              )}

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  to={cta}
                  className="rounded-full bg-[#f5f3ff] px-7 py-4 text-[14px] font-semibold text-[#09090d] transition-colors hover:bg-white"
                >
                  {PUBLIC_SITE ? "Open public demo" : "Open the workspace"}
                </Link>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener"
                  className="glass rounded-full border border-white/10 px-7 py-4 text-[14px] font-medium text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  View the codebase
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <StatPill label="Families" value="4 live categories" />
                <StatPill label="Loop" value="2D + 3D + export" />
                <StatPill label={PUBLIC_SITE ? "Launch" : "Providers"} value={PUBLIC_SITE ? "Demo now, full alpha in repo" : "Meshy now, provider-ready next"} />
              </div>
            </div>
          </div>
        </section>

        <section className="pb-26">
          <FeatureRail />
        </section>

        <section className="mx-auto max-w-[1200px] px-6 pb-28 lg:px-8">
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-7 lg:p-9">
            <div className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr]">
              <div>
                <SectionEyebrow>Why this shape works</SectionEyebrow>
                <h2 className="text-[34px] font-semibold leading-[1.03] tracking-[-0.04em] text-white sm:text-[44px]">
                  A new class of physical product needs a native creative canvas.
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {DIFFERENTIATORS.map((item) => (
                  <div key={item} className="rounded-[22px] border border-white/8 bg-black/20 p-5 text-[14px] leading-[1.75] text-zinc-400">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-[1200px] px-6 pb-28 lg:px-8">
          <div className="mb-14 max-w-[740px]">
            <SectionEyebrow>Workflow</SectionEyebrow>
            <h2 className="text-[38px] font-semibold leading-[1.03] tracking-[-0.04em] text-white sm:text-[54px]">
              Built like a creative loop, not a form wizard.
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {CREATIVE_LOOP.map((step, index) => (
              <div
                key={step.id}
                className={`rounded-[28px] border border-white/10 p-7 ${
                  index === 1
                    ? "bg-[radial-gradient(circle_at_top,rgba(117,161,255,0.18),transparent_60%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]"
                    : "bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]"
                }`}
              >
                <div className="text-[13px] font-mono text-zinc-500">{step.id}</div>
                <div className="mt-10 text-[28px] font-semibold tracking-[-0.03em] text-white">{step.title}</div>
                <div className="mt-3 text-[14px] font-medium text-[#b7adff]">{step.subtitle}</div>
                <p className="mt-5 text-[14px] leading-[1.8] text-zinc-400">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="families" className="mx-auto max-w-[1200px] px-6 pb-28 lg:px-8">
          <div className="mb-14 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[760px]">
              <SectionEyebrow>Families</SectionEyebrow>
              <h2 className="text-[38px] font-semibold leading-[1.03] tracking-[-0.04em] text-white sm:text-[54px]">
                One environment, four hardware directions.
              </h2>
            </div>
            <p className="max-w-[360px] text-[14px] leading-[1.8] text-zinc-500">
              Keyboard-first today, platform-ready by design. Every family reuses the same revisioned project state, asset flow, validation, jobs, and export history.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {PRODUCTS.map((product) => (
              <Link
                key={product.id}
                to={cta}
                className="group rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] p-7 transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[420px]">
                    <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: product.accent }}>
                      {product.eyebrow}
                    </div>
                    <h3 className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-white">{product.name}</h3>
                    <p className="mt-4 text-[14px] leading-[1.8] text-zinc-400">{product.desc}</p>
                  </div>
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-500 transition-colors group-hover:text-white"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M5 3.5L10.5 8L5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
                <div className="mt-8 rounded-[24px] border border-white/8 bg-black/20 px-6 py-8">
                  <Glyph rows={product.rows} color={product.accent} size={product.id === "keyboard" ? 8 : 11} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section id="stack" className="mx-auto max-w-[1200px] px-6 pb-28 lg:px-8">
          <div className="rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(139,124,255,0.18),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-8 lg:p-10">
            <div className="mb-12 max-w-[780px]">
              <SectionEyebrow>Integrated stack</SectionEyebrow>
              <h2 className="text-[38px] font-semibold leading-[1.04] tracking-[-0.04em] text-white sm:text-[52px]">
                Creative 3D generation only matters if it lands in a buildable system.
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {STACK.map((item) => (
                <div key={item.title} className="rounded-[26px] border border-white/10 bg-black/18 p-6">
                  <div className="text-[12px] uppercase tracking-[0.14em] text-zinc-500">{item.title}</div>
                  <p className="mt-4 text-[15px] leading-[1.85] text-zinc-300">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[24px] border border-white/10 bg-black/18 px-5 py-4 text-[13px] leading-[1.8] text-zinc-400">
              Reference direction: FLORA positions itself as a unified creative environment where many AI tools feed one workflow. That framing is right for BreakGen too, but here the system is specialized for 3D hardware creation rather than general media generation.
            </div>
          </div>
        </section>

        <section className="px-6 pb-28 lg:px-8">
          <div className="mx-auto max-w-[920px] text-center">
            <SectionEyebrow>Start building</SectionEyebrow>
            <h2 className="text-[38px] font-semibold leading-[1.03] tracking-[-0.04em] text-white sm:text-[58px]">
              Design the object, not the toolchain.
            </h2>
            <p className="mx-auto mt-6 max-w-[640px] text-[16px] leading-[1.85] text-zinc-400">
              BreakGen should feel like a creative studio for hardware: layout, 3D assets, electronics, validation, and export all moving in one coherent loop.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                to={cta}
                className="rounded-full bg-[#f5f3ff] px-7 py-4 text-[14px] font-semibold text-[#09090d] transition-colors hover:bg-white"
              >
                {PUBLIC_SITE ? "Open the public demo" : "Open BreakGen"}
              </Link>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener"
                className="glass rounded-full border border-white/10 px-7 py-4 text-[14px] font-medium text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
              >
                Read the repo
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/6 px-6 py-8 lg:px-8">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[14px] font-medium text-white">BreakGen</div>
            <div className="mt-1 text-[12px] text-zinc-600">Creative 3D environment for programmable hardware.</div>
          </div>
          <div className="flex items-center gap-6 text-[13px] text-zinc-500">
            <a href={REPO_URL} target="_blank" rel="noopener" className="transition-colors hover:text-zinc-300">
              GitHub
            </a>
            <span>Parth Pawar</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
