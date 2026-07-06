import { useEffect } from "react";

import {
  useNotificationStore,
  type NotificationItem,
  type NotificationTone,
} from "../stores/notificationStore";

const TONE_LABEL: Record<NotificationTone, string> = {
  info: "Info",
  success: "Done",
  warning: "Check",
  error: "Error",
};

function Toast({ item }: { item: NotificationItem }) {
  const dismiss = useNotificationStore((state) => state.dismiss);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => dismiss(item.id),
      item.tone === "error" ? 9000 : 5200,
    );
    return () => window.clearTimeout(timeout);
  }, [dismiss, item.id, item.tone]);

  return (
    <div className={`toast-card toast-card--${item.tone}`} role="status">
      <div className="toast-card__meta">{TONE_LABEL[item.tone]}</div>
      <div className="toast-card__body">
        <div className="toast-card__title">{item.title}</div>
        {item.message && <div className="toast-card__message">{item.message}</div>}
      </div>
      <button
        type="button"
        className="toast-card__close"
        aria-label="Dismiss notification"
        onClick={() => dismiss(item.id)}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export function ToastDeck() {
  const items = useNotificationStore((state) => state.items);

  if (items.length === 0) return null;

  return (
    <div className="toast-deck" aria-live="polite" aria-relevant="additions removals">
      {items.map((item) => (
        <Toast key={item.id} item={item} />
      ))}
    </div>
  );
}

