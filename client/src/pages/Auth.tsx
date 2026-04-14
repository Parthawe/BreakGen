import { useEffect, useState } from "react";
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
    const ok = mode === "signup" ? await signup(email, name, password) : await login(email, password);
    if (ok) navigate("/app");
  };

  const isSignup = mode === "signup";
  useEffect(() => { document.title = `${isSignup ? "Sign Up" : "Log In"} — BreakGen`; }, [isSignup]);

  return (
    <div className="min-h-screen bg-[#08080a] flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden bg-[#0a0a0f]"
        style={{ borderRight: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #818cf8 0%, transparent 70%)" }} />

        <div className="relative text-center px-16 max-w-md">
          <div className="flex flex-col items-center gap-4 mb-10">
            {[
              { c: "#818cf8", r: [[1,1,1,1,1,1,1,1,1,1,1,1,1],[1.5,1,1,1,1,1,1,1,1,1,1,1,1.5],[2.25,1,1,1,1,1,1,1,1,1,1,2.75]] },
              { c: "#4ade80", r: [[1,1,1,1],[1,1,1,1],[1,1,1,1]] },
              { c: "#fbbf24", r: [[1,1,1,1,1],[1,1,1,1,1]] },
            ].map((p, i) => (
              <div key={i} className="flex flex-col items-center" style={{ gap: "3px" }}>
                {p.r.map((row, ri) => (
                  <div key={ri} className="flex" style={{ gap: "3px" }}>
                    {row.map((w, ci) => (
                      <div key={ci} style={{ width: `${w * 12 - 3}px`, height: "9px", background: p.c, borderRadius: "2px", opacity: 0.5 + i * 0.08 }} />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <h2 className="text-[22px] font-bold text-white mb-3">Intent compiler for hardware</h2>
          <p className="text-[14px] leading-[1.7] text-zinc-500">
            Keyboards, macro pads, stream decks, MIDI controllers.
            Design visually, export fabrication files.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-[380px]">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-12">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1" fill="#818cf8" />
                <rect x="9" y="3" width="6" height="4" rx="1" fill="#818cf8" opacity="0.5" />
                <rect x="1" y="9" width="14" height="4" rx="1" fill="#818cf8" opacity="0.25" />
              </svg>
            </div>
            <span className="text-[16px] font-semibold text-white">BreakGen</span>
          </Link>

          <h1 className="text-[26px] font-bold text-white mb-2">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-[14px] text-zinc-500 mb-10">
            {isSignup ? "Start designing hardware in minutes." : "Sign in to continue building."}
          </p>

          {error && (
            <div className="text-[13px] mb-6 px-4 py-3 rounded-xl bg-red-500/8 text-red-400 border border-red-500/15">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignup && (
              <Field label="Name">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name"
                  className="w-full h-11 rounded-xl px-4 text-[14px] bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors" />
              </Field>
            )}
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com"
                className="w-full h-11 rounded-xl px-4 text-[14px] bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors" />
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                placeholder={isSignup ? "6+ characters" : "Enter password"}
                className="w-full h-11 rounded-xl px-4 text-[14px] bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors" />
            </Field>
            <button type="submit" disabled={loading}
              className="w-full h-11 text-[14px] font-medium rounded-xl transition-all bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500">
              {loading ? "..." : isSignup ? "Create Account" : "Sign In"}
            </button>
          </form>

          <p className="text-center mt-8 text-[14px] text-zinc-500">
            {isSignup ? "Already have an account? " : "Don't have an account? "}
            <Link to={isSignup ? "/login" : "/signup"} className="text-white font-medium hover:text-indigo-400 transition-colors">
              {isSignup ? "Sign in" : "Sign up"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-zinc-400 block mb-2">{label}</label>
      {children}
    </div>
  );
}
