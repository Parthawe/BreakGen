import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function Login() { return <AuthForm mode="login" />; }
export function Signup() { return <AuthForm mode="signup" />; }

function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const login = useAuthStore((s) => s.login);
  const signup = useAuthStore((s) => s.signup);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const success = mode === "signup"
      ? await signup(email, name, password)
      : await login(email, password);
    if (success) navigate("/app");
  };

  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-root)" }}>
      {/* Left — Visual */}
      <div className="hidden md:flex flex-1 items-center justify-center relative overflow-hidden"
        style={{ background: "var(--bg-surface)", borderRight: "1px solid var(--border-subtle)" }}>
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full opacity-[0.06]"
            style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }} />
        </div>
        <div className="relative text-center px-12">
          <div className="flex flex-col items-center gap-3 mb-8">
            {/* Product silhouettes */}
            {[
              { color: "#6366f1", rows: [[1,1,1,1,1,1,1,1,1,1],[1.5,1,1,1,1,1,1,1,1,1.5]] },
              { color: "#22c55e", rows: [[1,1,1,1],[1,1,1,1]] },
              { color: "#f59e0b", rows: [[1,1,1,1,1]] },
            ].map((p, pi) => (
              <div key={pi} className="flex flex-col items-center" style={{ gap: "2px", opacity: 0.4 + pi * 0.1 }}>
                {p.rows.map((row, ri) => (
                  <div key={ri} className="flex" style={{ gap: "2px" }}>
                    {row.map((w, ci) => (
                      <div key={ci} style={{ width: `${w * 8 - 2}px`, height: "6px", background: p.color, borderRadius: "1px", opacity: 0.5 }} />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <h2 className="text-[18px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Intent compiler for hardware
          </h2>
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Design keyboards, macro pads, stream decks, and MIDI controllers.
            Export fabrication-ready files.
          </p>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="inline-flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-muted)" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1" fill="var(--accent)" />
                <rect x="9" y="3" width="6" height="4" rx="1" fill="var(--accent)" opacity="0.6" />
                <rect x="1" y="9" width="14" height="4" rx="1" fill="var(--accent)" opacity="0.3" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>BreakGen</span>
          </Link>

          <h2 className="text-[20px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            {isSignup ? "Create your account" : "Welcome back"}
          </h2>
          <p className="text-[13px] mb-8" style={{ color: "var(--text-muted)" }}>
            {isSignup ? "Start designing hardware in minutes." : "Sign in to continue building."}
          </p>

          {error && (
            <div className="text-[12px] mb-5 px-4 py-3 rounded-lg"
              style={{ background: "rgba(239,68,68,0.08)", color: "var(--error)", border: "1px solid rgba(239,68,68,0.15)" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignup && (
              <FormField label="Name">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name"
                  className="w-full rounded-lg px-4 py-2.5 text-[13px] focus:outline-none"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
              </FormField>
            )}
            <FormField label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com"
                className="w-full rounded-lg px-4 py-2.5 text-[13px] focus:outline-none"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
            </FormField>
            <FormField label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                placeholder={isSignup ? "6+ characters" : "Your password"}
                className="w-full rounded-lg px-4 py-2.5 text-[13px] focus:outline-none"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
            </FormField>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 text-[13px] font-medium rounded-lg transition-all"
              style={{ background: loading ? "var(--bg-elevated)" : "var(--accent)", color: loading ? "var(--text-muted)" : "#fff" }}>
              {loading ? "..." : isSignup ? "Create Account" : "Sign In"}
            </button>
          </form>

          <div className="text-center mt-6">
            <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              {isSignup ? "Already have an account? " : "Don't have an account? "}
            </span>
            <Link to={isSignup ? "/login" : "/signup"} className="text-[13px] font-medium" style={{ color: "var(--accent)" }}>
              {isSignup ? "Sign in" : "Sign up"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}
