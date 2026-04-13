import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { LayoutTemplate, ProductFamily } from "../../types/project";
import { useProjectStore } from "../../stores/projectStore";

interface TemplateSelectorProps {
  onSelect: () => void;
}

const FAMILIES: { id: ProductFamily; name: string; desc: string; color: string; icon: number[][] }[] = [
  {
    id: "keyboard", name: "Keyboard", desc: "Full custom layouts with staggered rows",
    color: "#6366f1",
    icon: [[1,1,1,1,1,1,1,1,1,1,1,1,1,2],[1.5,1,1,1,1,1,1,1,1,1,1,1,1,1.5],[2.25,1,1,1,1,1,1,1,1,1,1,2.75],[1.25,1.25,1.25,6.25,1.25,1.25,1.25,1.25]],
  },
  {
    id: "macropad", name: "Macro Pad", desc: "Grid-based shortcut pads",
    color: "#22c55e",
    icon: [[1,1,1],[1,1,1],[1,1,1]],
  },
  {
    id: "streamdeck", name: "Stream Deck", desc: "Content control surfaces",
    color: "#f59e0b",
    icon: [[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1]],
  },
  {
    id: "midi", name: "MIDI Controller", desc: "Keys + encoders for music",
    color: "#ec4899",
    icon: [[0,1,0,1,0,1,0],[1,1,1,1,1,1,1,1,1,1]],
  },
];

function FamilyIcon({ rows, color, scale = 4 }: { rows: number[][]; color: string; scale?: number }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: "1.5px" }}>
      {rows.map((row, ri) => (
        <div key={ri} className="flex" style={{ gap: "1.5px" }}>
          {row.map((w, ci) => (
            <div key={ci} style={{
              width: `${w * scale - 1.5}px`, height: `${scale - 1.5}px`,
              background: w > 0 ? color : "transparent", borderRadius: "1px", opacity: 0.7,
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const [selectedFamily, setSelectedFamily] = useState<ProductFamily | null>(null);
  const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const createProject = useProjectStore((s) => s.createProject);

  useEffect(() => {
    if (!selectedFamily) return;
    setLoading(true);
    api.templates.list(selectedFamily).then((t) => {
      setTemplates(t);
      setLoading(false);
    });
  }, [selectedFamily]);

  const handleSelect = async (templateId: string) => {
    const familyNames: Record<string, string> = { keyboard: "My Keyboard", macropad: "My Macro Pad", streamdeck: "My Stream Deck", midi: "My MIDI Controller" };
    await createProject(familyNames[selectedFamily!] ?? "My Project", templateId, selectedFamily!);
    onSelect();
  };

  const familyColor = FAMILIES.find((f) => f.id === selectedFamily)?.color ?? "var(--accent)";

  // Family picker
  if (!selectedFamily) {
    return (
      <div className="flex items-center justify-center min-h-full p-8">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-10">
            <h2 className="text-[22px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>What are you building?</h2>
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Choose a product family. Each has its own templates and compiler.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {FAMILIES.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFamily(f.id)}
                className="text-left p-5 rounded-xl transition-all duration-200 group"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-sm)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = f.color + "50"; e.currentTarget.style.boxShadow = `0 0 20px ${f.color}10`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
              >
                <div className="w-14 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: f.color + "0a", border: `1px solid ${f.color}15` }}>
                  <FamilyIcon rows={f.icon} color={f.color} />
                </div>
                <h3 className="text-[14px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>{f.name}</h3>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Template picker
  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="max-w-xl w-full">
        <div className="mb-8">
          <button onClick={() => setSelectedFamily(null)} className="text-[12px] mb-4 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            Back to families
          </button>
          <h2 className="text-[20px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            Choose a template
          </h2>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Pick a starting layout. Every position is fully editable.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border-subtle)", borderTopColor: familyColor }} />
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <button
                key={t.template_id}
                onClick={() => handleSelect(t.template_id)}
                className="w-full text-left p-4 rounded-xl transition-all duration-200 flex items-center justify-between"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = familyColor + "50"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
              >
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>{t.name}</h3>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{t.description}</p>
                </div>
                <span className="text-[11px] font-mono shrink-0 ml-4" style={{ color: "var(--text-muted)" }}>{t.key_count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
