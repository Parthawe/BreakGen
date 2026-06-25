import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CONTACT_EMAIL, DISCORD_INVITE_URL, WAITLIST_ENDPOINT } from "../lib/runtime";
import { trackEvent } from "../lib/analytics";

const STORAGE_KEY = "breakgen.launch_capture.v1";

type CaptureMode = "alpha" | "discord" | "research";
type SubmitState = "idle" | "submitting" | "sent" | "fallback" | "error";

const MODES: Record<CaptureMode, { label: string; title: string; body: string; intent: string }> = {
  alpha: {
    label: "Alpha access",
    title: "Get on the build list",
    body: "Tell us what you want to make. We are looking for makers who will export, inspect, and try a physical build.",
    intent: "private_alpha",
  },
  discord: {
    label: "Community",
    title: "Join the build room",
    body: "Help shape templates, review proof bundles, and compare real macro pad, MIDI, and stream deck workflows.",
    intent: "community",
  },
  research: {
    label: "Research call",
    title: "Show us your workflow",
    body: "If you have already fought CAD, firmware, or file-sharing for a custom device, we want the messy details.",
    intent: "research",
  },
};

const ROLES = [
  "Maker",
  "Hardware founder",
  "Designer",
  "Musician / creator",
  "Creative technologist",
  "Other",
];

function hasCaptured() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "submitted";
  } catch {
    return false;
  }
}

function markCaptured() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "submitted");
  } catch {
    // Non-critical persistence hint only.
  }
}

function mailtoUrl(email: string, role: string, mode: CaptureMode, note: string) {
  const subject = encodeURIComponent(`BreakGen ${MODES[mode].label}`);
  const body = encodeURIComponent(
    [
      `Email: ${email}`,
      `Role: ${role}`,
      `Intent: ${MODES[mode].intent}`,
      `Page: ${window.location.href}`,
      "",
      note || "I want to follow BreakGen and help shape the alpha.",
    ].join("\n"),
  );
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

export function LaunchCapture({ surface }: { surface: "landing" | "demo" }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CaptureMode>("alpha");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(ROLES[0]);
  const [note, setNote] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  useEffect(() => {
    if (hasCaptured()) return;
    const timer = window.setTimeout(() => {
      setOpen(true);
      trackEvent("launch_capture_auto_open", { surface });
    }, surface === "landing" ? 9000 : 14000);
    return () => window.clearTimeout(timer);
  }, [surface]);

  const content = MODES[mode];
  const hasDiscordInvite = Boolean(DISCORD_INVITE_URL);
  const discordLabel = hasDiscordInvite ? "Join Discord" : "Request Discord invite";
  const statusCopy = useMemo(() => {
    if (submitState === "sent") return "You are on the list. We will use this to shape the alpha group.";
    if (submitState === "fallback") return "Your email client is open with the request. Send it to finish the handoff.";
    if (submitState === "error") return "The form endpoint did not respond. Use the email fallback or try again.";
    return null;
  }, [submitState]);

  const openWithMode = (nextMode: CaptureMode) => {
    setMode(nextMode);
    setOpen(true);
    setSubmitState("idle");
    trackEvent("launch_capture_open", { surface, mode: nextMode });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitState("submitting");
    const payload = {
      email: email.trim(),
      role,
      intent: content.intent,
      note: note.trim(),
      surface,
      path: window.location.pathname,
      referrer: document.referrer || "",
      timestamp: new Date().toISOString(),
    };

    try {
      if (WAITLIST_ENDPOINT) {
        const response = await fetch(WAITLIST_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`Waitlist endpoint returned ${response.status}`);
        markCaptured();
        setSubmitState("sent");
        trackEvent("launch_capture_submit", { surface, mode, role, endpoint: "configured" });
        return;
      }

      markCaptured();
      setSubmitState("fallback");
      trackEvent("launch_capture_submit", { surface, mode, role, endpoint: "email_fallback" });
      window.location.href = mailtoUrl(email.trim(), role, mode, note.trim());
    } catch {
      setSubmitState("error");
      trackEvent("launch_capture_error", { surface, mode });
    }
  };

  const openDiscord = () => {
    trackEvent("community_cta_click", { surface, has_invite: hasDiscordInvite });
    if (hasDiscordInvite) {
      window.open(DISCORD_INVITE_URL, "_blank", "noopener,noreferrer");
      return;
    }
    openWithMode("discord");
  };

  return (
    <>
      <div className="launch-capture-dock" aria-label="BreakGen launch capture">
        <div>
          <div className="eyebrow">Private alpha</div>
          <div className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">
            Help turn BreakGen into the device compiler makers actually use.
          </div>
        </div>
        <div className="launch-capture-dock__actions">
          <button type="button" className="surface-button h-10 rounded-full px-4 text-[12px] font-semibold" onClick={openDiscord}>
            {discordLabel}
          </button>
          <button type="button" className="surface-button-primary h-10 rounded-full px-4 text-[12px] font-semibold" onClick={() => openWithMode("alpha")}>
            Request access
          </button>
        </div>
      </div>

      {open && (
        <div className="launch-capture" role="dialog" aria-modal="true" aria-labelledby="launch-capture-title">
          <button
            type="button"
            className="launch-capture__scrim"
            aria-label="Close launch capture"
            onClick={() => {
              setOpen(false);
              trackEvent("launch_capture_close", { surface, mode });
            }}
          />
          <div className="launch-capture__panel">
            <div className="launch-capture__rail">
              {Object.entries(MODES).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  className={key === mode ? "is-active" : ""}
                  onClick={() => {
                    setMode(key as CaptureMode);
                    trackEvent("launch_capture_mode", { surface, mode: key });
                  }}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="launch-capture__body">
              <button
                type="button"
                className="launch-capture__close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                x
              </button>
              <div className="eyebrow">{content.label}</div>
              <h2 id="launch-capture-title">{content.title}</h2>
              <p>{content.body}</p>

              <form onSubmit={submit} className="launch-capture__form">
                <label>
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@studio.com"
                    autoComplete="email"
                    required
                  />
                </label>
                <label>
                  You are
                  <select value={role} onChange={(event) => setRole(event.target.value)}>
                    {ROLES.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  What are you trying to build?
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="A 16-key stream deck with encoders, a MIDI pad, a pedal controller..."
                    rows={3}
                  />
                </label>
                <button type="submit" className="surface-button-primary h-11 rounded-full px-5 text-[13px] font-semibold" disabled={submitState === "submitting"}>
                  {submitState === "submitting" ? "Sending..." : "Send request"}
                </button>
                {statusCopy && (
                  <div className="launch-capture__status" data-state={submitState}>{statusCopy}</div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
