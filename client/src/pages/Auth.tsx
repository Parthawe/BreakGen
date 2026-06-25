import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { api, type AuthProvider } from "../lib/api";
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
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [providerStatus, setProviderStatus] = useState<"loading" | "ready" | "unavailable">("loading");
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

  useEffect(() => {
    let active = true;
    setProviderStatus("loading");
    api.auth
      .providers()
      .then((data) => {
        if (!active) return;
        setProviders(data.providers);
        setProviderStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setProviders([]);
        setProviderStatus("unavailable");
      });

    return () => {
      active = false;
    };
  }, []);

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
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1340px] min-w-0 flex-col gap-6 lg:flex-row">
        <section className="surface-strong relative flex min-w-0 flex-1 overflow-hidden rounded-[34px] p-6 md:p-10">
          <div className="landing-grid absolute inset-0 opacity-70" />
          <div className="landing-orb absolute -left-10 top-0 h-[24rem] w-[24rem]" />
          <div className="landing-orb-secondary absolute bottom-0 right-0 h-[20rem] w-[20rem]" />
          <div className="relative z-10 flex min-w-0 max-w-[560px] flex-col">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <Link to="/" className="inline-flex min-w-0 items-center gap-3">
                <div className="surface-chip flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="3" width="6" height="4" rx="1" fill="var(--accent)" />
                    <rect x="9" y="3" width="6" height="4" rx="1" fill="var(--accent)" opacity="0.48" />
                    <rect x="1" y="9" width="14" height="4" rx="1" fill="var(--accent)" opacity="0.24" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold text-[var(--text-primary)]">BreakGen</div>
                  <div className="eyebrow mt-1 truncate">Control-surface alpha</div>
                </div>
              </Link>
              <div className="shrink-0">
                <ThemeSwitcher />
              </div>
            </div>

            <div className="mt-12 max-w-[480px] min-w-0 md:mt-16">
              <div className="eyebrow">Custom electronic products</div>
              <h1 className="mt-5 max-w-full text-[36px] font-semibold leading-[0.96] tracking-[-0.04em] text-[var(--text-primary)] sm:text-[44px] md:text-[58px] md:leading-[0.94] md:tracking-[-0.06em]">
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

            <div className="mb-6 grid gap-3">
              {(providers.length
                ? providers
                : [
                    {
                      id: "google",
                      label: "Google",
                      enabled: false,
                      configured: false,
                      status: providerStatus,
                      reason:
                        providerStatus === "loading"
                          ? "Checking provider status with the BreakGen API."
                          : "Provider status is unavailable from the BreakGen API.",
                      setup: [],
                    },
                    {
                      id: "apple",
                      label: "Apple",
                      enabled: false,
                      configured: false,
                      status: providerStatus,
                      reason:
                        providerStatus === "loading"
                          ? "Checking provider status with the BreakGen API."
                          : "Provider status is unavailable from the BreakGen API.",
                      setup: [],
                    },
                  ]).map((provider) => (
                <ProviderButton key={provider.id} provider={provider} />
              ))}
              {providerStatus === "unavailable" && (
                <p className="text-[12px] leading-[1.6] text-[var(--text-tertiary)]">
                  Provider status could not be loaded. Email/password sign-in still uses the authenticated alpha path.
                </p>
              )}
            </div>

            <div className="section-rule mb-6 pt-5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              Alpha password access
            </div>

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

function ProviderButton({ provider }: { provider: AuthProvider }) {
  const stateLabel =
    provider.status === "server_callback_required"
      ? "Callback pending"
      : provider.status === "credentials_required"
        ? "Setup needed"
        : provider.status === "loading"
          ? "Checking"
          : provider.enabled
            ? "Available"
            : "Unavailable";
  const providerMark = provider.id === "google" ? "G" : provider.id === "apple" ? "A" : provider.label.slice(0, 1);

  return (
    <button
      type="button"
      disabled={!provider.enabled}
      title={provider.reason}
      className="surface-button grid min-h-12 w-full grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 rounded-[16px] px-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-70 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--surface-strong)] text-[14px] font-semibold text-[var(--text-primary)]">
        {providerMark}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-[var(--text-primary)]">
          Continue with {provider.label}
        </span>
        <span className="block truncate text-[11px] text-[var(--text-tertiary)]">
          {provider.enabled ? "Ready for this deployment" : stateLabel}
        </span>
      </span>
      <span className="hidden whitespace-nowrap rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)] sm:inline-flex">
        {stateLabel}
      </span>
    </button>
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
