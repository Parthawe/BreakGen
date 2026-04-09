import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const FEATURES = [
  {
    title: "Describe it",
    desc: "Tell us how your keyboard should feel and look. Natural language in, engineering out.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
      </svg>
    ),
  },
  {
    title: "Design it",
    desc: "Visual layout editor with real-time 3D preview. Drag keys, pick switches, see it live.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    title: "Build it",
    desc: "Export plate DXF, PCB data, firmware metadata, and a validated fabrication bundle.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><path d="M3.27 6.96L12 12.01l8.73-5.05" /><path d="M12 22.08V12" />
      </svg>
    ),
  },
];

const STATS = [
  { value: "14.0mm", label: "Cherry MX cutout precision" },
  { value: "< 10 min", label: "Design to export" },
  { value: "37", label: "Automated tests passing" },
  { value: "6", label: "Step guided workflow" },
];

export function Landing() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-root)" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-muted)" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="3" width="6" height="4" rx="1" fill="var(--accent)" />
              <rect x="9" y="3" width="6" height="4" rx="1" fill="var(--accent)" opacity="0.6" />
              <rect x="1" y="9" width="14" height="4" rx="1" fill="var(--accent)" opacity="0.3" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>BreakGen</span>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <Link
              to="/app"
              className="px-4 py-2 text-[13px] font-medium rounded-lg transition-all"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Open App
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 text-[13px] font-medium rounded-lg transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="px-4 py-2 text-[13px] font-medium rounded-lg transition-all"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <div
          className="inline-block px-3 py-1 rounded-full text-[11px] font-medium mb-6"
          style={{ background: "var(--accent-muted)", color: "var(--accent-hover)", border: "1px solid rgba(99,102,241,0.2)" }}
        >
          NYU ITP Thesis Project
        </div>

        <h1
          className="text-[48px] leading-[1.1] font-semibold tracking-tight mb-5"
          style={{ color: "var(--text-primary)" }}
        >
          Describe a keyboard.
          <br />
          <span style={{ color: "var(--accent)" }}>Build a keyboard.</span>
        </h1>

        <p
          className="text-[17px] leading-relaxed max-w-xl mx-auto mb-10"
          style={{ color: "var(--text-tertiary)" }}
        >
          BreakGen turns your creative intent into fabrication-ready files.
          No KiCad. No CAD. No fragmented toolchain.
          Just describe what you want and export what you need.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            to={user ? "/app" : "/signup"}
            className="px-6 py-3 text-[14px] font-medium rounded-xl transition-all"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Start Designing
          </Link>
          <a
            href="https://github.com/Parthawe/BreakGen"
            target="_blank"
            rel="noopener"
            className="px-6 py-3 text-[14px] font-medium rounded-xl transition-all"
            style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
          >
            View Source
          </a>
        </div>
      </section>

      {/* Keyboard visual */}
      <section className="max-w-3xl mx-auto px-6 mb-20">
        <div
          className="rounded-2xl p-8 flex items-center justify-center"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
        >
          <KeyboardVisual />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl p-6"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
              >
                {f.icon}
              </div>
              <h3 className="text-[15px] font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                {f.title}
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div
          className="rounded-xl p-8 grid grid-cols-2 md:grid-cols-4 gap-6"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
        >
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-[24px] font-semibold font-mono mb-1" style={{ color: "var(--text-primary)" }}>
                {s.value}
              </div>
              <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-[24px] font-semibold text-center mb-10" style={{ color: "var(--text-primary)" }}>
          Six steps. One tool.
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { step: "1", name: "Layout", desc: "Pick a template or start blank" },
            { step: "2", name: "Feel", desc: "Choose switch type and sound" },
            { step: "3", name: "Design", desc: "Edit keys with live 3D preview" },
            { step: "4", name: "Style", desc: "AI-generate keycap aesthetics" },
            { step: "5", name: "Circuit", desc: "Auto-compile PCB matrix" },
            { step: "6", name: "Build", desc: "Validate and export bundle" },
          ].map((s) => (
            <div
              key={s.step}
              className="rounded-xl p-5"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center text-[12px] font-medium mb-3"
                style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
              >
                {s.step}
              </div>
              <div className="text-[14px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>{s.name}</div>
              <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
        <h2 className="text-[28px] font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Ready to build?
        </h2>
        <p className="text-[14px] mb-8" style={{ color: "var(--text-muted)" }}>
          Create an account and design your first keyboard in under 10 minutes.
        </p>
        <Link
          to={user ? "/app" : "/signup"}
          className="inline-block px-8 py-3.5 text-[14px] font-medium rounded-xl transition-all"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Get Started Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-6" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            BreakGen — NYU ITP Thesis, Spring 2025
          </span>
          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            Parth Pawar
          </span>
        </div>
      </footer>
    </div>
  );
}

function KeyboardVisual() {
  const rows = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
    [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
    [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
    [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
    [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
  ];

  return (
    <div className="flex flex-col items-center" style={{ gap: "3px" }}>
      {rows.map((row, ri) => (
        <div key={ri} className="flex" style={{ gap: "3px" }}>
          {row.map((w, ci) => (
            <div
              key={ci}
              className="rounded-[3px] transition-colors"
              style={{
                width: `${w * 14 - 3}px`,
                height: "11px",
                background: ri === 0 && ci === 0 ? "var(--accent)" : "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
