import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { LayoutTemplate, ProductFamily } from "../../types/project";
import { useProjectStore } from "../../stores/projectStore";

interface TemplateSelectorProps { onSelect: () => void; }

const FAMILIES: { id: ProductFamily; name: string; desc: string; color: string; icon: number[][] }[] = [
  { id: "keyboard", name: "Keyboard", desc: "Staggered layouts with full PCB compilation", color: "#818cf8",
    icon: [[1,1,1,1,1,1,1,1,1,1,1,1,1,2],[1.5,1,1,1,1,1,1,1,1,1,1,1,1,1.5],[2.25,1,1,1,1,1,1,1,1,1,1,2.75],[1.25,1.25,1.25,6.25,1.25,1.25,1.25,1.25]] },
  { id: "macropad", name: "Macro Pad", desc: "Grid-based shortcut pads", color: "#4ade80",
    icon: [[1,1,1],[1,1,1],[1,1,1]] },
  { id: "streamdeck", name: "Stream Deck", desc: "Wide-spaced content control surfaces", color: "#fbbf24",
    icon: [[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1]] },
  { id: "midi", name: "MIDI Controller", desc: "Keys and encoders for music production", color: "#f472b6",
    icon: [[0,1,0,1,0,1,0],[1,1,1,1,1,1,1,1,1,1]] },
];

function Sil({ rows, color, s = 5 }: { rows: number[][]; color: string; s?: number }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: `${s * 0.3}px` }}>
      {rows.map((r, i) => (
        <div key={i} className="flex" style={{ gap: `${s * 0.3}px` }}>
          {r.map((w, j) => w > 0 ? (
            <div key={j} className="rounded-[1.5px]" style={{ width: `${w * s - s * 0.3}px`, height: `${s - s * 0.3}px`, background: color, opacity: 0.6 }} />
          ) : <div key={j} style={{ width: `${s * 0.7}px` }} />)}
        </div>
      ))}
    </div>
  );
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const [family, setFamily] = useState<ProductFamily | null>(null);
  const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const createProject = useProjectStore((s) => s.createProject);

  useEffect(() => {
    if (!family) return;
    setLoading(true);
    api.templates.list(family).then((t) => { setTemplates(t); setLoading(false); });
  }, [family]);

  const handleSelect = async (tid: string) => {
    const names: Record<string, string> = { keyboard: "My Keyboard", macropad: "My Macro Pad", streamdeck: "My Stream Deck", midi: "My MIDI Controller" };
    await createProject(names[family!] ?? "My Project", tid, family!);
    onSelect();
  };

  const fc = FAMILIES.find((f) => f.id === family)?.color ?? "#818cf8";

  // Step 1: Family picker
  if (!family) {
    return (
      <div className="flex items-center justify-center min-h-full p-10">
        <div className="max-w-[640px] w-full">
          <div className="text-center mb-14">
            <h2 className="text-[28px] font-bold text-white tracking-[-0.02em] mb-2">What are you building?</h2>
            <p className="text-[14px] text-zinc-500">Each product family has its own templates, compiler, and export pipeline.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {FAMILIES.map((f) => (
              <button key={f.id} onClick={() => setFamily(f.id)}
                className="text-left p-6 rounded-[20px] transition-all duration-300 group hover:-translate-y-0.5 border"
                style={{ background: `linear-gradient(180deg, ${f.color}06 0%, transparent 100%)`, borderColor: `${f.color}10` }}
                onMouseEnter={e => e.currentTarget.style.borderColor = `${f.color}30`}
                onMouseLeave={e => e.currentTarget.style.borderColor = `${f.color}10`}>
                <div className="w-16 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}08` }}>
                  <Sil rows={f.icon} color={f.color} s={f.id === "keyboard" ? 4 : 6} />
                </div>
                <h3 className="text-[16px] font-semibold text-white mb-1">{f.name}</h3>
                <p className="text-[13px] text-zinc-500 leading-[1.5]">{f.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Template picker
  return (
    <div className="flex items-center justify-center min-h-full p-10">
      <div className="max-w-[520px] w-full">
        <button onClick={() => setFamily(null)} className="text-[12px] text-zinc-600 hover:text-zinc-400 mb-6 flex items-center gap-1 transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          Back
        </button>
        <h2 className="text-[24px] font-bold text-white tracking-[-0.02em] mb-2">Choose a template</h2>
        <p className="text-[14px] text-zinc-500 mb-10">Every key position is fully editable after.</p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 rounded-full animate-spin border-zinc-700" style={{ borderTopColor: fc }} />
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <button key={t.template_id} onClick={() => handleSelect(t.template_id)}
                className="w-full text-left p-5 rounded-[18px] transition-all duration-200 flex items-center justify-between border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.04] hover:border-white/[0.08] group">
                <div>
                  <h3 className="text-[15px] font-semibold text-white group-hover:text-indigo-200 transition-colors">{t.name}</h3>
                  <p className="text-[13px] text-zinc-500 mt-0.5">{t.description}</p>
                </div>
                <span className="text-[12px] font-mono text-zinc-600 shrink-0 ml-6">{t.key_count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
