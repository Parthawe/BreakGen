import { Link, NavLink } from "react-router-dom";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { PUBLIC_DEMO_PATH, PUBLIC_SITE, REPO_URL } from "../lib/runtime";
import { trackEvent } from "../lib/analytics";
import { useAuthStore } from "../stores/authStore";

const SITE_LINKS = [
  { to: "/marketplace/", label: "Marketplace" },
  { to: "/how-it-works/", label: "How it works" },
  { to: "/creators/", label: "Creators" },
  { to: "/manufacturing/", label: "Manufacturing" },
];

function openAlphaCapture(placement: string) {
  trackEvent("site_nav_cta_click", { target: "alpha", placement });
  window.dispatchEvent(new CustomEvent("breakgen:open-launch-capture", { detail: { mode: "alpha" } }));
}

export function SiteNav({ eyebrow = "Private alpha for custom programmable hardware" }: { eyebrow?: string }) {
  const user = useAuthStore((state) => state.user);

  const appCta = PUBLIC_SITE ? (
    <Link
      to="/demo/"
      onClick={() => trackEvent("site_nav_cta_click", { target: "demo", placement: "nav" })}
      className="surface-button-primary inline-flex h-11 items-center rounded-full px-5 text-[13px] font-semibold"
    >
      Open demo
    </Link>
  ) : user ? (
    <Link
      to="/app"
      onClick={() => trackEvent("site_nav_cta_click", { target: "workspace", placement: "nav" })}
      className="surface-button-primary inline-flex h-11 items-center rounded-full px-5 text-[13px] font-semibold"
    >
      <span className="hidden sm:inline">Open workspace</span>
      <span className="sm:hidden">Workspace</span>
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => openAlphaCapture("nav")}
      className="surface-button-primary inline-flex h-11 items-center rounded-full px-5 text-[13px] font-semibold"
    >
      Enter alpha
    </button>
  );

  return (
    <nav className="site-nav surface-toolbar mb-7 rounded-[24px] px-4 py-4 md:px-5" aria-label="BreakGen site">
      <div className="site-nav__brand">
        <Link to="/" className="surface-chip flex h-11 w-11 items-center justify-center rounded-2xl" aria-label="BreakGen home">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="1" y="3" width="6" height="4" rx="1" fill="var(--accent)" />
            <rect x="9" y="3" width="6" height="4" rx="1" fill="var(--accent)" opacity="0.48" />
            <rect x="1" y="9" width="14" height="4" rx="1" fill="var(--accent)" opacity="0.24" />
          </svg>
        </Link>
        <div>
          <Link to="/" className="text-[15px] font-semibold text-[var(--text-primary)]">
            BreakGen
          </Link>
          <div className="hidden text-[12px] text-[var(--text-tertiary)] sm:block">{eyebrow}</div>
        </div>
      </div>

      <div className="site-nav__links" aria-label="Public pages">
        {SITE_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={() => trackEvent("site_nav_link_click", { target: link.to })}
            className={({ isActive }) => `site-nav__link${isActive ? " is-active" : ""}`}
          >
            {link.label}
          </NavLink>
        ))}
        <NavLink
          to="/demo/"
          onClick={() => trackEvent("site_nav_link_click", { target: PUBLIC_DEMO_PATH })}
          className={({ isActive }) => `site-nav__link${isActive ? " is-active" : ""}`}
        >
          Demo
        </NavLink>
      </div>

      <div className="site-nav__actions">
        <ThemeSwitcher />
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener"
          onClick={() => trackEvent("site_nav_cta_click", { target: "github", placement: "nav" })}
          className="surface-button hidden h-11 items-center rounded-full px-4 text-[13px] font-semibold xl:inline-flex"
        >
          GitHub
        </a>
        {appCta}
      </div>
    </nav>
  );
}
