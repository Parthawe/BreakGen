import { PLAUSIBLE_DOMAIN, POSTHOG_HOST, POSTHOG_KEY } from "./runtime";

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;
export type AnalyticsConsent = "accepted" | "declined" | null;
type PlausibleFunction = ((eventName: string, options?: { props?: AnalyticsProps }) => void) & {
  q?: [string, { props?: AnalyticsProps }?][];
};
type PostHogClient = {
  capture: (eventName: string, properties?: AnalyticsProps) => void;
};

declare global {
  interface Window {
    plausible?: PlausibleFunction;
    posthog?: {
      capture: (eventName: string, properties?: AnalyticsProps) => void;
      init?: (key: string, options?: Record<string, unknown>) => void;
    };
  }
}

let initialized = false;
let posthogClient: PostHogClient | null = null;
const pendingPosthogEvents: { eventName: string; props: AnalyticsProps }[] = [];
const CONSENT_STORAGE_KEY = "breakgen.analytics_consent.v1";

function injectScript(src: string, attributes: Record<string, string> = {}) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement("script");
  script.src = src;
  script.defer = true;
  Object.entries(attributes).forEach(([key, value]) => {
    script.setAttribute(key, value);
  });
  document.head.appendChild(script);
}

export function analyticsConfigured() {
  return Boolean(PLAUSIBLE_DOMAIN || POSTHOG_KEY);
}

export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

function analyticsConsentAccepted() {
  return getAnalyticsConsent() === "accepted";
}

export function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, null>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, consent);
  } catch {
    // Consent storage failure should not break the app surface.
  }
  if (consent === "accepted") {
    initAnalytics();
  }
}

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  if (!analyticsConfigured() || !analyticsConsentAccepted()) return;
  initialized = true;

  if (PLAUSIBLE_DOMAIN) {
    window.plausible =
      window.plausible ||
      function plausibleQueue(...args: [string, { props?: AnalyticsProps }?]) {
        window.plausible!.q = window.plausible!.q || [];
        window.plausible!.q!.push(args as [string, { props?: AnalyticsProps }?]);
      };
    injectScript("https://plausible.io/js/script.tagged-events.js", {
      "data-domain": PLAUSIBLE_DOMAIN,
    });
  }

  if (POSTHOG_KEY) {
    import("posthog-js")
      .then(({ default: posthog }) => {
        posthog.init(POSTHOG_KEY, {
          api_host: POSTHOG_HOST,
          person_profiles: "identified_only",
          capture_pageview: false,
          autocapture: false,
        });
        posthogClient = posthog;
        pendingPosthogEvents.splice(0).forEach((event) => {
          posthogClient?.capture(event.eventName, event.props);
        });
      })
      .catch(() => {
        // Analytics should never block the product surface.
      });
  }
}

export function trackEvent(eventName: string, props: AnalyticsProps = {}) {
  if (typeof window === "undefined") return;
  if (!analyticsConsentAccepted()) return;
  const payload = {
    path: window.location.pathname,
    ...props,
  };
  window.plausible?.(eventName, { props: payload });
  if (posthogClient) {
    posthogClient.capture(eventName, payload);
    return;
  }
  if (window.posthog) {
    window.posthog.capture(eventName, payload);
    return;
  }
  if (POSTHOG_KEY) {
    pendingPosthogEvents.push({ eventName, props: payload });
  }
}

export function trackPageView(path: string) {
  trackEvent("route_view", { path });
}
