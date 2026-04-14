import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const PRODUCTS = [
  {
    id: "keyboard", name: "Keyboards",
    desc: "Staggered layouts from 60% to TKL with plate geometry, PCB matrix compilation, and QMK firmware.",
    color: "#818cf8",
    rows: [[1,1,1,1,1,1,1,1,1,1,1,1,1,2],[1.5,1,1,1,1,1,1,1,1,1,1,1,1,1.5],[1.75,1,1,1,1,1,1,1,1,1,1,1,2.25],[2.25,1,1,1,1,1,1,1,1,1,1,2.75],[1.25,1.25,1.25,6.25,1.25,1.25,1.25,1.25]],
  },
  {
    id: "macropad", name: "Macro Pads",
    desc: "Grid shortcut pads for productivity, gaming, and automation. The simplest path from idea to circuit board.",
    color: "#4ade80",
    rows: [[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]],
  },
  {
    id: "streamdeck", name: "Stream Decks",
    desc: "Wide-spaced content control surfaces for OBS, streaming, and media production workflows.",
    color: "#fbbf24",
    rows: [[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1]],
  },
  {
    id: "midi", name: "MIDI Controllers",
    desc: "Piano keys and rotary encoders for DAW control, live performance, and studio production.",
    color: "#f472b6",
    rows: [[0,1,0,1,0,1,0,0,1,0,1,0],[1,1,1,1,1,1,1,1,1,1,1,1,1]],
  },
];

function Sil({ rows, color, s = 6 }: { rows: number[][]; color: string; s?: number }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: `${s * 0.35}px` }}>
      {rows.map((r, i) => (
        <div key={i} className="flex" style={{ gap: `${s * 0.35}px` }}>
          {r.map((w, j) => w > 0 ? (
            <div key={j} className="rounded-[2px]" style={{ width: `${w * s - s * 0.35}px`, height: `${s - s * 0.35}px`, background: color, opacity: 0.7 }} />
          ) : <div key={j} style={{ width: `${s * 0.65}px` }} />)}
        </div>
      ))}
    </div>
  );
}

export function Landing() {
  const user = useAuthStore((s) => s.user);
  const cta = user ? "/app" : "/signup";
  useEffect(() => { document.title = "BreakGen — Intent Compiler for Hardware"; }, []);

  return (
    <div className="min-h-screen bg-[#050507] text-white antialiased">
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50">
        <div className="mx-auto max-w-[1200px] flex items-center justify-between h-16 px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 flex items-center justify-center border border-indigo-500/10">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1.5" fill="#818cf8"/>
                <rect x="9" y="3" width="6" height="4" rx="1.5" fill="#818cf8" opacity="0.45"/>
                <rect x="1" y="9" width="14" height="4" rx="1.5" fill="#818cf8" opacity="0.2"/>
              </svg>
            </div>
            <span className="text-[15px] font-semibold tracking-[-0.01em]">BreakGen</span>
          </Link>
          <div className="flex items-center gap-1.5">
            {user ? (
              <Link to="/app" className="h-9 px-5 text-[13px] font-medium rounded-full bg-white text-[#050507] flex items-center hover:bg-zinc-200 transition-colors">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="h-9 px-5 text-[13px] font-medium text-zinc-400 hover:text-white flex items-center transition-colors">Log in</Link>
                <Link to="/signup" className="h-9 px-5 text-[13px] font-medium rounded-full bg-white text-[#050507] flex items-center hover:bg-zinc-200 transition-colors">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-48 pb-40 px-8 overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[1000px] h-[700px] opacity-[0.08] pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 50% at center, #818cf8 0%, transparent 100%)" }} />

        <div className="relative mx-auto max-w-[720px] text-center">
          <h1 className="text-[64px] leading-[1.04] font-bold tracking-[-0.04em] mb-7" style={{ textWrap: "balance" } as React.CSSProperties}>
            From intent to{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">fabrication</span>
          </h1>

          <p className="text-[18px] leading-[1.75] text-zinc-400 max-w-[520px] mx-auto mb-14" style={{ textWrap: "pretty" } as React.CSSProperties}>
            BreakGen compiles design intent into production-ready geometry, circuits, and firmware for physical input devices.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link to={cta} className="h-12 px-8 text-[15px] font-semibold rounded-full bg-white text-[#050507] flex items-center hover:bg-zinc-200 transition-colors">
              Start Building
            </Link>
            <a href="https://github.com/Parthawe/BreakGen" target="_blank" rel="noopener"
              className="h-12 px-8 text-[15px] font-medium rounded-full text-zinc-400 flex items-center hover:text-white transition-colors">
              GitHub
              <svg className="ml-2" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 10L10 4M10 4H5M10 4v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
          </div>
        </div>
      </section>

      {/* HERO KEYBOARD VISUAL */}
      <section className="max-w-[900px] mx-auto px-8 pb-48">
        <div className="relative rounded-3xl overflow-hidden" style={{ background: "linear-gradient(180deg, rgba(129,140,248,0.06) 0%, rgba(129,140,248,0.01) 100%)" }}>
          <div className="absolute inset-0 rounded-3xl" style={{ border: "1px solid rgba(129,140,248,0.1)" }} />
          <div className="py-16 flex items-center justify-center">
            <Sil rows={PRODUCTS[0].rows} color="rgba(129,140,248,0.5)" s={14} />
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="mx-auto max-w-[1100px] px-8 pb-48">
        <div className="text-center mb-20">
          <p className="text-[13px] font-medium text-indigo-400/70 tracking-[0.15em] uppercase mb-4">Product Families</p>
          <h2 className="text-[40px] font-bold tracking-[-0.03em]" style={{ textWrap: "balance" } as React.CSSProperties}>
            Four compilers, one pipeline
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {PRODUCTS.map((p) => (
            <Link key={p.id} to={cta}
              className="group relative rounded-[20px] p-8 transition-all duration-300 hover:-translate-y-1"
              style={{ background: `linear-gradient(180deg, ${p.color}08 0%, transparent 100%)`, border: `1px solid ${p.color}12` }}
              onMouseEnter={e => e.currentTarget.style.borderColor = `${p.color}30`}
              onMouseLeave={e => e.currentTarget.style.borderColor = `${p.color}12`}
            >
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-[20px] font-semibold mb-2 tracking-[-0.01em]">{p.name}</h3>
                  <p className="text-[14px] leading-[1.7] text-zinc-500 max-w-[300px]" style={{ textWrap: "pretty" } as React.CSSProperties}>{p.desc}</p>
                </div>
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.03] group-hover:bg-white/[0.07] transition-all duration-300 mt-1 shrink-0 ml-4">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="group-hover:translate-x-0.5 transition-transform duration-300">
                    <path d="M5.5 3L10.5 7.5L5.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-zinc-600 group-hover:text-white transition-colors duration-300" />
                  </svg>
                </div>
              </div>
              <div className="h-20 flex items-center justify-center rounded-2xl bg-white/[0.015]">
                <Sil rows={p.rows} color={p.color} s={p.id === "keyboard" ? 7 : 10} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-[960px] px-8 pb-48">
        <div className="text-center mb-20">
          <p className="text-[13px] font-medium text-emerald-400/70 tracking-[0.15em] uppercase mb-4">Workflow</p>
          <h2 className="text-[40px] font-bold tracking-[-0.03em]">Three steps to fabrication</h2>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {[
            { n: "01", t: "Design", d: "Choose a product family. Pick a template. Edit the layout with a real-time 3D preview.", c: "#818cf8" },
            { n: "02", t: "Compile", d: "Auto-generate scanning matrix, plate cutouts, firmware metadata. Validation catches errors before you export.", c: "#4ade80" },
            { n: "03", t: "Export", d: "Download a validated bundle with DXF plates, QMK firmware, VIA definitions, and a build guide.", c: "#fbbf24" },
          ].map(s => (
            <div key={s.n} className="rounded-[20px] p-7" style={{ background: `linear-gradient(180deg, ${s.c}06 0%, transparent 100%)`, border: `1px solid ${s.c}10` }}>
              <div className="text-[13px] font-semibold font-mono mb-6" style={{ color: s.c }}>{s.n}</div>
              <h3 className="text-[18px] font-semibold mb-3 tracking-[-0.01em]">{s.t}</h3>
              <p className="text-[14px] leading-[1.75] text-zinc-500" style={{ textWrap: "pretty" } as React.CSSProperties}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* NUMBERS */}
      <section className="mx-auto max-w-[900px] px-8 pb-48">
        <div className="grid grid-cols-4 gap-px rounded-[20px] overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
          {[
            { v: "14.0", u: "mm", l: "Cutout precision" },
            { v: "4", u: "", l: "Product families" },
            { v: "47", u: "", l: "Automated tests" },
            { v: "<10", u: "min", l: "Idea to export" },
          ].map(s => (
            <div key={s.l} className="py-12 text-center bg-[#050507]">
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-[36px] font-bold tracking-[-0.03em]">{s.v}</span>
                {s.u && <span className="text-[15px] font-medium text-zinc-500">{s.u}</span>}
              </div>
              <div className="text-[12px] text-zinc-600">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-8 pb-48 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[400px] opacity-[0.06] pointer-events-none"
          style={{ background: "radial-gradient(ellipse 50% 70% at center bottom, #818cf8 0%, transparent 100%)" }} />
        <div className="relative mx-auto max-w-[600px] text-center">
          <h2 className="text-[40px] font-bold tracking-[-0.03em] mb-5" style={{ textWrap: "balance" } as React.CSSProperties}>
            Ready to build something?
          </h2>
          <p className="text-[16px] text-zinc-500 mb-12 leading-[1.7]">
            Create an account and go from idea to fabrication files in minutes. Free to use.
          </p>
          <Link to={cta} className="inline-flex h-13 px-10 text-[15px] font-semibold rounded-full bg-white text-[#050507] items-center hover:bg-zinc-200 transition-colors">
            Create Free Account
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.03] px-8 py-8">
        <div className="mx-auto max-w-[1100px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-[7px] bg-indigo-500/10 flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1.5" fill="#818cf8"/>
                <rect x="9" y="3" width="6" height="4" rx="1.5" fill="#818cf8" opacity="0.45"/>
                <rect x="1" y="9" width="14" height="4" rx="1.5" fill="#818cf8" opacity="0.2"/>
              </svg>
            </div>
            <span className="text-[13px] text-zinc-600">BreakGen</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com/Parthawe/BreakGen" target="_blank" rel="noopener" className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors">GitHub</a>
            <span className="text-[13px] text-zinc-600">Parth Pawar</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
