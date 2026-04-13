import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const PRODUCTS = [
  {
    id: "keyboard", name: "Keyboards", tag: "Most Popular",
    desc: "60% to TKL. Staggered rows, stabilizers, Cherry MX plate geometry, full PCB compilation.",
    color: "#6366f1", bg: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
    rows: [[1,1,1,1,1,1,1,1,1,1,1,1,1,2],[1.5,1,1,1,1,1,1,1,1,1,1,1,1,1.5],[1.75,1,1,1,1,1,1,1,1,1,1,1,2.25],[2.25,1,1,1,1,1,1,1,1,1,1,2.75],[1.25,1.25,1.25,6.25,1.25,1.25,1.25,1.25]],
  },
  {
    id: "macropad", name: "Macro Pads", tag: "Quick Build",
    desc: "3x3 and 4x4 grids. Shortcuts, macros, OSDs. Simplest path from idea to PCB.",
    color: "#22c55e", bg: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
    rows: [[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]],
  },
  {
    id: "streamdeck", name: "Stream Decks", tag: "Content",
    desc: "Wide-spaced keys for labeling. OBS, Twitch, media production control surfaces.",
    color: "#f59e0b", bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    rows: [[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1]],
  },
  {
    id: "midi", name: "MIDI Controllers", tag: "Music",
    desc: "Piano keys plus rotary encoders. DAW control, live performance, studio production.",
    color: "#ec4899", bg: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
    rows: [[0,1,0,1,0,1,0,0,1,0,1,0],[1,1,1,1,1,1,1,1,1,1,1,1,1]],
  },
];

function Silhouette({ rows, color, s = 6 }: { rows: number[][]; color: string; s?: number }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: "2px" }}>
      {rows.map((r, i) => (
        <div key={i} className="flex" style={{ gap: "2px" }}>
          {r.map((w, j) => w > 0 ? (
            <div key={j} style={{ width: `${w * s - 2}px`, height: `${s - 2}px`, background: color, borderRadius: "1.5px", opacity: 0.8 }} />
          ) : (
            <div key={j} style={{ width: `${s - 2}px` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Landing() {
  const user = useAuthStore((s) => s.user);
  const cta = user ? "/app" : "/signup";

  return (
    <div className="min-h-screen bg-[#08080a]">
      {/* ---- NAV ---- */}
      <nav className="fixed top-0 inset-x-0 z-50 glass" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1" fill="#6366f1" />
                <rect x="9" y="3" width="6" height="4" rx="1" fill="#6366f1" opacity="0.5" />
                <rect x="1" y="9" width="14" height="4" rx="1" fill="#6366f1" opacity="0.25" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold text-white">BreakGen</span>
          </Link>
          <div className="flex items-center gap-1">
            {user ? (
              <Link to="/app" className="h-8 px-4 text-[12px] font-medium rounded-lg bg-indigo-500 text-white flex items-center">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="h-8 px-4 text-[12px] font-medium text-zinc-400 hover:text-white flex items-center transition-colors">Log in</Link>
                <Link to="/signup" className="h-8 px-4 text-[12px] font-medium rounded-lg bg-white text-black flex items-center">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ---- HERO ---- */}
      <section className="relative pt-40 pb-32 px-6 overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-[0.07]"
          style={{ background: "radial-gradient(ellipse at center, #6366f1 0%, transparent 70%)" }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-white/[0.04] border border-white/[0.06] mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-medium text-zinc-400">4 product families available</span>
          </div>

          <h1 className="text-[56px] leading-[1.05] font-bold tracking-[-0.03em] text-white mb-6">
            From intent to
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">fabrication files</span>
          </h1>

          <p className="text-[17px] leading-[1.7] text-zinc-500 max-w-xl mx-auto mb-12">
            BreakGen compiles your design intent into production-ready geometry,
            circuits, and firmware. Keyboards, macro pads, stream decks, MIDI controllers.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link to={cta} className="h-11 px-7 text-[14px] font-medium rounded-xl bg-white text-black flex items-center hover:bg-zinc-200 transition-colors">
              Start Building
            </Link>
            <a href="https://github.com/Parthawe/BreakGen" target="_blank" rel="noopener"
              className="h-11 px-7 text-[14px] font-medium rounded-xl text-zinc-400 border border-white/[0.08] flex items-center hover:border-white/[0.15] hover:text-white transition-all">
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ---- PRODUCTS ---- */}
      <section className="max-w-5xl mx-auto px-6 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PRODUCTS.map((p) => (
            <Link key={p.id} to={cta}
              className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
              style={{ background: "#0f0f12", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {/* Top color bar */}
              <div className="h-1" style={{ background: p.bg }} />

              <div className="p-7">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <h3 className="text-[17px] font-semibold text-white">{p.name}</h3>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ color: p.color, background: p.color + "15" }}>
                        {p.tag}
                      </span>
                    </div>
                    <p className="text-[13px] leading-[1.6] text-zinc-500 max-w-[280px]">{p.desc}</p>
                  </div>
                  {/* Arrow */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.03] group-hover:bg-white/[0.06] transition-colors mt-1">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-zinc-600 group-hover:text-white transition-colors" />
                    </svg>
                  </div>
                </div>

                {/* Silhouette */}
                <div className="h-16 flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <Silhouette rows={p.rows} color={p.color} s={p.id === "keyboard" ? 5 : 7} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- HOW IT WORKS ---- */}
      <section className="max-w-4xl mx-auto px-6 pb-32">
        <h2 className="text-[28px] font-bold text-white text-center mb-4">Three steps</h2>
        <p className="text-[14px] text-zinc-500 text-center mb-14 max-w-md mx-auto">
          Same pipeline for every product family. Design visually, compile deterministically, export confidently.
        </p>

        <div className="grid grid-cols-3 gap-5">
          {[
            { n: "01", t: "Design", d: "Choose a product family and template. Edit the layout visually. See a real-time 3D preview as you work.", color: "#6366f1" },
            { n: "02", t: "Compile", d: "BreakGen generates the scanning matrix, plate cutouts, firmware metadata, and runs validation checks.", color: "#22c55e" },
            { n: "03", t: "Export", d: "Download a validated bundle: plate DXF, QMK firmware, VIA definition, build guide, and manifest.", color: "#f59e0b" },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl p-6" style={{ background: "#0f0f12", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                style={{ background: s.color + "12", border: `1px solid ${s.color}20` }}>
                <span className="text-[13px] font-bold font-mono" style={{ color: s.color }}>{s.n}</span>
              </div>
              <h3 className="text-[16px] font-semibold text-white mb-2">{s.t}</h3>
              <p className="text-[13px] leading-[1.7] text-zinc-500">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- NUMBERS ---- */}
      <section className="max-w-4xl mx-auto px-6 pb-32">
        <div className="rounded-2xl p-10 text-center" style={{ background: "linear-gradient(135deg, #0f0f12 0%, #13131a 100%)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="grid grid-cols-4 gap-8">
            {[
              { v: "14.0", u: "mm", l: "Switch cutout precision" },
              { v: "4", u: "", l: "Product families" },
              { v: "47", u: "", l: "Automated tests" },
              { v: "<10", u: "min", l: "Design to export" },
            ].map((s) => (
              <div key={s.l}>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-[32px] font-bold text-white tracking-tight">{s.v}</span>
                  {s.u && <span className="text-[14px] font-medium text-zinc-500">{s.u}</span>}
                </div>
                <div className="text-[11px] text-zinc-600 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section className="relative px-6 pb-32 overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-[0.05]"
          style={{ background: "radial-gradient(ellipse at center, #6366f1 0%, transparent 70%)" }} />
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-[32px] font-bold text-white mb-4">Start building</h2>
          <p className="text-[15px] text-zinc-500 mb-10">
            Free to use. Design your first product in minutes.
          </p>
          <Link to={cta} className="inline-flex h-12 px-8 text-[14px] font-medium rounded-xl bg-white text-black items-center hover:bg-zinc-200 transition-colors">
            Create Free Account
          </Link>
        </div>
      </section>

      {/* ---- FOOTER ---- */}
      <footer className="border-t border-white/[0.04] px-6 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-500/10 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1" fill="#6366f1" />
                <rect x="9" y="3" width="6" height="4" rx="1" fill="#6366f1" opacity="0.5" />
                <rect x="1" y="9" width="14" height="4" rx="1" fill="#6366f1" opacity="0.25" />
              </svg>
            </div>
            <span className="text-[12px] text-zinc-600">BreakGen</span>
          </div>
          <span className="text-[12px] text-zinc-600">Built by Parth Pawar</span>
        </div>
      </footer>
    </div>
  );
}
