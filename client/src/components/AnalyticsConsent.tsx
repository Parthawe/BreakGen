import { useState } from "react";
import {
  analyticsConfigured,
  getAnalyticsConsent,
  setAnalyticsConsent,
  trackEvent,
} from "../lib/analytics";

export function AnalyticsConsent() {
  const [consent, setConsent] = useState(() => getAnalyticsConsent());

  if (!analyticsConfigured() || consent !== null) return null;

  const chooseConsent = (nextConsent: "accepted" | "declined") => {
    setAnalyticsConsent(nextConsent);
    setConsent(nextConsent);
    if (nextConsent === "accepted") {
      trackEvent("analytics_consent_accept", { source: "consent_banner" });
    }
  };

  return (
    <section className="analytics-consent" aria-label="Analytics consent">
      <div className="analytics-consent__copy">
        <div className="eyebrow">Privacy control</div>
        <p>
          Help us understand which proof flows people use. Analytics stays off
          unless you allow it.
        </p>
      </div>
      <div className="analytics-consent__actions">
        <button
          type="button"
          className="surface-button analytics-consent__button"
          onClick={() => chooseConsent("declined")}
        >
          No thanks
        </button>
        <button
          type="button"
          className="surface-button-primary analytics-consent__button"
          onClick={() => chooseConsent("accepted")}
        >
          Allow analytics
        </button>
      </div>
    </section>
  );
}
