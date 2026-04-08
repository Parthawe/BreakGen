import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { LayoutTemplate } from "../../types/project";
import { useProjectStore } from "../../stores/projectStore";

interface TemplateSelectorProps {
  onSelect: () => void;
}

// Simplified keyboard silhouettes for each template
const SILHOUETTES: Record<string, { rows: number[][]; label: string }> = {
  "60_percent": {
    label: "60%",
    rows: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
      [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
      [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
      [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
      [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
    ],
  },
  "65_percent": {
    label: "65%",
    rows: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0.25, 1],
      [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 0.25, 1],
      [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25, 0.25, 1],
      [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.75, 0.25, 1, 1],
      [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 0.25, 1, 1, 1],
    ],
  },
  "75_percent": {
    label: "75%",
    rows: [
      [1, 0.25, 1, 1, 1, 1, 0.25, 1, 1, 1, 1, 0.25, 1, 1, 1, 1, 0.25, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0.25, 1],
      [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 0.25, 1],
      [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25, 0.25, 1],
      [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.75, 0.25, 1],
      [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 0.25, 1, 1, 1],
    ],
  },
};

function KeyboardSilhouette({ templateId }: { templateId: string }) {
  const sil = SILHOUETTES[templateId];
  if (!sil) return null;

  const scale = 5;
  const gap = 0.8;

  return (
    <div className="flex flex-col items-center" style={{ gap: `${gap}px` }}>
      {sil.rows.map((row, ri) => (
        <div key={ri} className="flex" style={{ gap: `${gap}px` }}>
          {row.map((w, ci) => {
            if (w < 0.5) return <div key={ci} style={{ width: `${w * scale}px` }} />;
            return (
              <div
                key={ci}
                className="rounded-[1.5px]"
                style={{
                  width: `${w * scale - gap}px`,
                  height: `${scale - gap}px`,
                  background: "var(--text-muted)",
                  opacity: 0.4,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const createProject = useProjectStore((s) => s.createProject);

  useEffect(() => {
    api.templates.list().then((t) => {
      setTemplates(t);
      setLoading(false);
    });
  }, []);

  const handleSelect = async (templateId: string) => {
    await createProject("My Keyboard", templateId);
    onSelect();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--border-subtle)", borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-10">
          <h2 className="text-[22px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Start with a layout
          </h2>
          <p className="text-[14px] max-w-md mx-auto" style={{ color: "var(--text-tertiary)" }}>
            Choose a base layout. Every key position, size, and rotation is fully editable after.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {templates.map((t) => {
            const isHovered = hoveredId === t.template_id;
            return (
              <button
                key={t.template_id}
                onClick={() => handleSelect(t.template_id)}
                onMouseEnter={() => setHoveredId(t.template_id)}
                onMouseLeave={() => setHoveredId(null)}
                className="text-left p-5 rounded-xl transition-all duration-200 group"
                style={{
                  background: isHovered ? "var(--bg-hover)" : "var(--bg-surface)",
                  border: `1px solid ${isHovered ? "var(--accent)" : "var(--border-subtle)"}`,
                  boxShadow: isHovered ? "0 0 0 1px var(--accent), 0 4px 24px rgba(99, 102, 241, 0.08)" : "none",
                }}
              >
                <div className="flex items-center gap-6">
                  {/* Keyboard silhouette */}
                  <div
                    className="shrink-0 w-32 h-14 flex items-center justify-center rounded-lg"
                    style={{ background: "var(--bg-root)" }}
                  >
                    <KeyboardSilhouette templateId={t.template_id} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        className="text-[15px] font-medium transition-colors duration-150"
                        style={{ color: isHovered ? "var(--text-primary)" : "var(--text-secondary)" }}
                      >
                        {t.name}
                      </h3>
                      <span
                        className="text-[11px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
                      >
                        {t.key_count}
                      </span>
                    </div>
                    <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {t.description}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div
                    className="shrink-0 transition-all duration-200"
                    style={{
                      color: isHovered ? "var(--accent)" : "var(--text-muted)",
                      transform: isHovered ? "translateX(3px)" : "translateX(0)",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
