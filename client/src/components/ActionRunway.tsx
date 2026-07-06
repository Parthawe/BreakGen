export type ActionRunwayTone = "working" | "success" | "warning" | "error" | "idle";

export function ActionRunway({
  eyebrow,
  title,
  detail,
  tone = "working",
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  tone?: ActionRunwayTone;
}) {
  return (
    <div className={`action-runway action-runway--${tone}`}>
      <div className="action-runway__rail" aria-hidden="true">
        <span />
      </div>
      <div className="min-w-0 flex-1">
        <div className="action-runway__eyebrow">{eyebrow}</div>
        <div className="action-runway__title">{title}</div>
        {detail && <div className="action-runway__detail">{detail}</div>}
      </div>
    </div>
  );
}

