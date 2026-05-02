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
    <div className="app-shell min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden bg-[#0a0a0f]"
        style={{ borderRight: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="absolute left-[8%] top-[14%] h-[22rem] w-[22rem] rounded-full opacity-[0.14] blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(139,124,255,0.9) 0%, rgba(139,124,255,0.1) 52%, transparent 74%)" }} />
        <div className="absolute bottom-[10%] right-[6%] h-[18rem] w-[18rem] rounded-full opacity-[0.12] blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(122,219,255,0.72) 0%, rgba(122,219,255,0.08) 52%, transparent 72%)" }} />

        <div className="relative max-w-[520px] px-16">
          <div className="mb-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a39bff]">
            Creative 3D environment
          </div>
          <h2 className="text-[42px] font-semibold leading-[0.96] tracking-[-0.05em] text-white mb-5">
            Sign in to keep building the object, not the toolchain.
          </h2>
          <p className="text-[15px] leading-[1.9] text-zinc-500 max-w-[420px]">
            BreakGen keeps layout, 3D assets, electronics, validation, and export history inside one project record for programmable hardware.
          </p>

          <div className="mt-10 grid gap-4">
            {[
              { title: "One environment", copy: "Creative direction, 2D layout, 3D preview, and manufacturing outputs stay connected." },
              { title: "Five live families", copy: "Keyboards, macro pads, stream decks, MIDI controllers, and gamepads now share one platform backbone." },
              { title: "Real outputs", copy: "Validation, plate geometry, firmware metadata, and export bundles are part of the product lifecycle." },
            ].map((item) => (
              <div key={item.title} className="glass glass-soft rounded-[22px] px-5 py-4">
                <div className="text-[13px] font-medium text-white mb-1.5">{item.title}</div>
                <div className="text-[13px] leading-[1.75] text-zinc-500">{item.copy}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-[380px]">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-12">
            <div className="glass-chip w-9 h-9 rounded-lg flex items-center justify-center">
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
            <div className="glass-danger text-[13px] mb-6 px-4 py-3 rounded-xl text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignup && (
              <Field label="Name">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name"
                  className="glass-input w-full h-11 rounded-xl px-4 text-[14px] text-white placeholder:text-zinc-600 focus:outline-none transition-colors" />
              </Field>
            )}
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com"
                className="glass-input w-full h-11 rounded-xl px-4 text-[14px] text-white placeholder:text-zinc-600 focus:outline-none transition-colors" />
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                placeholder={isSignup ? "6+ characters" : "Enter password"}
                className="glass-input w-full h-11 rounded-xl px-4 text-[14px] text-white placeholder:text-zinc-600 focus:outline-none transition-colors" />
            </Field>
            <button type="submit" disabled={loading}
              className="glass-button-primary w-full h-11 text-[14px] font-medium rounded-xl transition-all disabled:opacity-40">
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
