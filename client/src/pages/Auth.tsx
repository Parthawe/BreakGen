import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function Login() {
  return <AuthForm mode="login" />;
}

export function Signup() {
  return <AuthForm mode="signup" />;
}

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
    let success: boolean;
    if (mode === "signup") {
      success = await signup(email, name, password);
    } else {
      success = await login(email, password);
    }
    if (success) navigate("/app");
  };

  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-root)" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-muted)" }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1" fill="var(--accent)" />
                <rect x="9" y="3" width="6" height="4" rx="1" fill="var(--accent)" opacity="0.6" />
                <rect x="1" y="9" width="14" height="4" rx="1" fill="var(--accent)" opacity="0.3" />
              </svg>
            </div>
            <span className="text-[17px] font-semibold" style={{ color: "var(--text-primary)" }}>BreakGen</span>
          </Link>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-6"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
        >
          <h2 className="text-[18px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            {isSignup ? "Create your account" : "Welcome back"}
          </h2>
          <p className="text-[13px] mb-6" style={{ color: "var(--text-muted)" }}>
            {isSignup ? "Start designing keyboards in minutes" : "Sign in to continue"}
          </p>

          {error && (
            <div
              className="text-[12px] mb-4 px-3 py-2.5 rounded-lg"
              style={{ background: "rgba(239,68,68,0.1)", color: "var(--error)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                  className="w-full rounded-lg px-3 py-2.5 text-[13px] focus:outline-none transition-colors"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
                />
              </div>
            )}

            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-lg px-3 py-2.5 text-[13px] focus:outline-none transition-colors"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              />
            </div>

            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder={isSignup ? "6+ characters" : "Your password"}
                className="w-full rounded-lg px-3 py-2.5 text-[13px] focus:outline-none transition-colors"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-[13px] font-medium rounded-lg transition-all"
              style={{
                background: loading ? "var(--bg-elevated)" : "var(--accent)",
                color: loading ? "var(--text-muted)" : "#fff",
              }}
            >
              {loading ? "..." : isSignup ? "Create Account" : "Sign In"}
            </button>
          </form>
        </div>

        {/* Switch */}
        <div className="text-center mt-5">
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            {isSignup ? "Already have an account? " : "Don't have an account? "}
          </span>
          <Link
            to={isSignup ? "/login" : "/signup"}
            className="text-[13px] font-medium"
            style={{ color: "var(--accent)" }}
          >
            {isSignup ? "Sign in" : "Sign up"}
          </Link>
        </div>
      </div>
    </div>
  );
}
