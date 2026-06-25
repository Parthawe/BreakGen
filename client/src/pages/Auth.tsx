import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { useAuthStore } from "../stores/authStore";

const BRAND_POINTS = [
  {
    title: "One product record",
    copy: "Layout, assets, electronics, validation, and exports remain attached to the same revisioned project state.",
  },
  {
    title: "Five alpha families",
    copy: "Keyboard, macropad, streamdeck, MIDI, and gamepad share one control-surface platform instead of separate tools.",
  },
  {
    title: "Visible trust layer",
    copy: "Jobs, artifacts, and acceptance state stay inspectable instead of disappearing behind the interface.",
  },
];

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
  const [inviteCode, setInviteCode] = useState("");
  const login = useAuthStore((state) => state.login);
  const signup = useAuthStore((state) => state.signup);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const sessionNotice = useAuthStore((state) => state.sessionNotice);
  const clearError = useAuthStore((state) => state.clearError);
  const clearSessionNotice = useAuthStore((state) => state.clearSessionNotice);
  const navigate = useNavigate();

  const isSignup = mode === "signup";

  useEffect(() => {
    document.title = `${isSignup ? "Sign Up" : "Log In"} — BreakGen`;
  }, [isSignup]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();
    const ok =
      mode === "signup"
        ? await signup(email, name, password, inviteCode)
        : await login(email, password);
    if (ok) navigate("/app");
  };

  return (
    <div className="app-shell min-h-screen px-5 py-5 md:px-8 md:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1340px] flex-col gap-6 lg:flex-row">
        <section className="surface-strong relative flex flex-1 overflow-hidden rounded-[34px] p-7 md:p-10">
          <div className="absolute right-6 top-6 z-20">
            <ThemeSwitcher />
          </div>
          <div className="landing-grid absolute inset-0 opacity-70" />
          <div className="landing-orb absolute -left-10 top-0 h-[24rem] w-[24rem]" />
          <div className="landing-orb-secondary absolute bottom-0 right-0 h-[20rem] w-[20rem]" />
          <div className="relative z-10 flex max-w-[560px] flex-col">
            <Link to="/" className="inline-flex items-center gap-3">
              <div className="surface-chip flex h-11 w-11 items-center justify-center rounded-2xl">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="3" width="6" height="4" rx="1" fill="var(--accent)" />
                  <rect x="9" y="3" width="6" height="4" rx="1" fill="var(--accent)" opacity="0.48" />
                  <rect x="1" y="9" width="14" height="4" rx="1" fill="var(--accent)" opacity="0.24" />
                </svg>
              </div>
              <div>
                <div className="text-[15px] font-semibold text-[var(--text-primary)]">BreakGen</div>
                <div className="eyebrow mt-1">Control-surface alpha</div>
              </div>
            </Link>

            <div className="mt-16 max-w-[480px]">
              <div className="eyebrow">Custom electronic products</div>
              <h1 className="mt-5 text-[44px] font-semibold leading-[0.94] tracking-[-0.06em] text-[var(--text-primary)] md:text-[58px]">
                Build the object and the proof around it in one system.
              </h1>
              <p className="mt-6 max-w-[430px] text-[15px] leading-[1.85] text-[var(--text-secondary)]">
                BreakGen is a revisioned creative environment for programmable hardware.
                The layout, visible parts, electronics, validation, and export history stay
                attached to one product record.
              </p>
            </div>

            <div className="mt-12 grid gap-3 md:grid-cols-3">
              {BRAND_POINTS.map((item) => (
                <article key={item.title} className="surface-subcard rounded-[22px] p-4">
                  <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-[12px] leading-[1.7] text-[var(--text-secondary)]">
                    {item.copy}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="surface-panel flex w-full max-w-[460px] shrink-0 rounded-[34px] p-7 md:p-9">
          <div className="my-auto w-full">
            <div className="mb-9">
              <div className="eyebrow">{isSignup ? "Create account" : "Welcome back"}</div>
              <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                {isSignup ? "Start a new product record." : "Sign in to continue building."}
              </h2>
              <p className="mt-3 text-[14px] leading-[1.7] text-[var(--text-secondary)]">
                {isSignup
                  ? "Create a workspace for layouts, assets, validation, and export-ready hardware state."
                  : "Return to the authenticated alpha and pick up the current revision where you left it."}
              </p>
            </div>

            {sessionNotice && (
              <div className="surface-panel mb-4 rounded-[18px] px-4 py-3 text-[13px] text-[var(--text-secondary)]">
                <div className="flex items-start justify-between gap-3">
                  <span>{sessionNotice}</span>
                  <button onClick={clearSessionNotice} className="text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="glass-danger mb-6 rounded-[18px] px-4 py-3 text-[13px]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignup && (
                <Field label="Name">
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    placeholder="Your name"
                    className="surface-input h-12 w-full rounded-[16px] px-4 text-[14px] focus:outline-none"
                  />
                </Field>
              )}

              {isSignup && (
                <Field label="Invite code">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    placeholder="From the alpha operator"
                    className="surface-input h-12 w-full rounded-[16px] px-4 text-[14px] focus:outline-none"
                  />
                </Field>
              )}

              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="you@example.com"
                  className="surface-input h-12 w-full rounded-[16px] px-4 text-[14px] focus:outline-none"
                />
              </Field>

              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  placeholder={isSignup ? "8+ characters" : "Enter password"}
                  className="surface-input h-12 w-full rounded-[16px] px-4 text-[14px] focus:outline-none"
                />
              </Field>

              <button
                type="submit"
                disabled={loading}
                className="surface-button-primary h-12 w-full rounded-[16px] text-[14px] font-semibold transition-all disabled:opacity-50"
              >
                {loading ? "Working…" : isSignup ? "Create Account" : "Sign In"}
              </button>
            </form>

            <div className="section-rule mt-8 pt-5 text-[13px] text-[var(--text-secondary)]">
              <div className="mb-3 text-[12px] leading-[1.6] text-[var(--text-tertiary)]">
                Invite-only alpha. Reviewer accounts are provisioned through the private alpha operator path, not an open public signup funnel.
              </div>
              {isSignup ? (
                <>
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    className="font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--accent)]"
                  >
                    Sign in
                  </Link>
                </>
              ) : (
                "Need access? Ask the alpha operator for a provisioned reviewer account."
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
        {label}
      </span>
      {children}
    </label>
  );
}
