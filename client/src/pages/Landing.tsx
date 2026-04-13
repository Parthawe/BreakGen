import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const PRODUCTS = [
  {
    id: "keyboard",
    name: "Keyboards",
    desc: "Full custom layouts from 60% to TKL. Switch selection, plate geometry, PCB compilation.",
    color: "#6366f1",
    keys: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,2],
      [1.5,1,1,1,1,1,1,1,1,1,1,1,1,1.5],
      [1.75,1,1,1,1,1,1,1,1,1,1,1,2.25],
      [2.25,1,1,1,1,1,1,1,1,1,1,2.75],
      [1.25,1.25,1.25,6.25,1.25,1.25,1.25,1.25],
    ],
  },
  {
    id: "macropad",
    name: "Macro Pads",
    desc: "Grid-based shortcut pads. 3x3, 4x4, or custom grids for productivity and gaming.",
    color: "#22c55e",
    keys: [[1,1,1],[1,1,1],[1,1,1]],
  },
  {
    id: "streamdeck",
    name: "Stream Decks",
    desc: "Content control surfaces. Wider key spacing for labels, streaming, and media production.",
    color: "#f59e0b",
    keys: [[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1]],
  },
  {
    id: "midi",
    name: "MIDI Controllers",
    desc: "Music production layouts. Keys, encoders, and sliders for DAW control.",
    color: "#ec4899",
    keys: [[0,1,0,1,0,1,0],[1,1,1,1,1,1,1,1,1,1,1,1]],
  },
];

function ProductSilhouette({ keys, color, scale = 5 }: { keys: number[][]; color: string; scale?: number }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: "2px" }}>
      {keys.map((row, ri) => (
        <div key={ri} className="flex" style={{ gap: "2px" }}>
          {row.map((w, ci) => (
            <div
              key={ci}
              style={{
                width: `${w * scale - 2}px`,
                height: `${scale - 2}px`,
                background: w > 0 ? color : "transparent",
                borderRadius: "1.5px",
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Landing() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-root)" }}>
      {/* Nav */}
      <nav
        className="glass fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "var(--accent-muted)" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="3" width="6" height="4" rx="1" fill="var(--accent)" />
              <rect x="9" y="3" width="6" height="4" rx="1" fill="var(--accent)" opacity="0.6" />
              <rect x="1" y="9" width="14" height="4" rx="1" fill="var(--accent)" opacity="0.3" />
            </svg>
          </div>
          <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>BreakGen</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/app" className="px-4 py-1.5 text-[12px] font-medium rounded-md" style={{ background: "var(--accent)", color: "#fff" }}>
              Open App
            </Link>
          ) : (
            <>
              <Link to="/login" className="px-3 py-1.5 text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>Log in</Link>
              <Link to="/signup" className="px-4 py-1.5 text-[12px] font-medium rounded-md" style={{ background: "var(--accent)", color: "#fff" }}>
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04]"
            style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }} />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <h1 className="text-[44px] leading-[1.08] font-bold tracking-tight mb-5" style={{ color: "var(--text-primary)" }}>
            Design physical products.
            <br />
            <span style={{ color: "var(--accent)" }}>Export fabrication files.</span>
          </h1>
          <p className="text-[16px] leading-relaxed max-w-lg mx-auto mb-10" style={{ color: "var(--text-tertiary)" }}>
            BreakGen is an intent compiler for hardware. Describe what you want,
            design it visually, and download production-ready geometry, circuits, and firmware.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to={user ? "/app" : "/signup"}
              className="px-6 py-2.5 text-[13px] font-medium rounded-lg"
              style={{ background: "var(--accent)", color: "#fff", boxShadow: "var(--shadow-glow)" }}
            >
              Start Building
            </Link>
            <a
              href="https://github.com/Parthawe/BreakGen"
              target="_blank" rel="noopener"
              className="px-6 py-2.5 text-[13px] font-medium rounded-lg"
              style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
            >
              GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-[22px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Four product families</h2>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Same pipeline. Different compilers. One canonical project model.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRODUCTS.map((p) => (
            <Link
              key={p.id}
              to={user ? "/app" : "/signup"}
              className="group p-6 rounded-xl transition-all duration-200"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-sm)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = p.color + "40";
                e.currentTarget.style.boxShadow = `0 0 20px ${p.color}12`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.boxShadow = "var(--shadow-sm)";
              }}
            >
              <div className="flex items-start gap-5">
                <div className="w-20 h-14 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: p.color + "0a", border: `1px solid ${p.color}15` }}>
                  <ProductSilhouette keys={p.keys} color={p.color} />
                </div>
                <div>
                  <h3 className="text-[14px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>{p.name}</h3>
                  <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{p.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="text-center mb-10">
          <h2 className="text-[22px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>How it works</h2>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {[
            { n: "01", title: "Design", desc: "Pick a product family, choose a template, and edit the layout visually with real-time 3D preview." },
            { n: "02", title: "Compile", desc: "BreakGen auto-generates the scanning matrix, plate geometry, firmware metadata, and validates everything." },
            { n: "03", title: "Build", desc: "Download a fabrication bundle with DXF plates, QMK firmware, VIA definitions, and a build guide." },
          ].map((s) => (
            <div key={s.n} className="p-5 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <div className="text-[11px] font-mono font-medium mb-3" style={{ color: "var(--accent)" }}>{s.n}</div>
              <h3 className="text-[14px] font-medium mb-2" style={{ color: "var(--text-primary)" }}>{s.title}</h3>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Precision */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="p-8 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="grid grid-cols-4 gap-6 text-center">
            {[
              { v: "14.0mm", l: "Cherry MX cutout precision" },
              { v: "4", l: "Product families" },
              { v: "8", l: "Layout templates" },
              { v: "47", l: "Automated tests" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-[22px] font-bold font-mono" style={{ color: "var(--text-primary)" }}>{s.v}</div>
                <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <h2 className="text-[26px] font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Ready to build?</h2>
        <p className="text-[13px] mb-8" style={{ color: "var(--text-muted)" }}>
          Create an account and design your first product in under 10 minutes.
        </p>
        <Link
          to={user ? "/app" : "/signup"}
          className="inline-block px-8 py-3 text-[13px] font-medium rounded-lg"
          style={{ background: "var(--accent)", color: "#fff", boxShadow: "var(--shadow-glow)" }}
        >
          Get Started Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>BreakGen</span>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Parth Pawar</span>
        </div>
      </footer>
    </div>
  );
}
