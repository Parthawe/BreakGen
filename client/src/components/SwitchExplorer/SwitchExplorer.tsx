import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { SupportedSwitch } from "../../types/project";
import { useProjectStore } from "../../stores/projectStore";

const TYPE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  linear: { color: "#f87171", bg: "rgba(248, 113, 113, 0.1)", border: "rgba(248, 113, 113, 0.2)" },
  tactile: { color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)", border: "rgba(251, 191, 36, 0.2)" },
  clicky: { color: "#60a5fa", bg: "rgba(96, 165, 250, 0.1)", border: "rgba(96, 165, 250, 0.2)" },
};

function ForceBar({ force, max = 80 }: { force: number; max?: number }) {
  const pct = Math.min((force / max) * 100, 100);
  return (
    <div className="h-1 rounded-full w-full" style={{ background: "var(--bg-root)" }}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, background: "var(--accent)", opacity: 0.6 }}
      />
    </div>
  );
}

export function SwitchExplorer() {
  const [switches, setSwitches] = useState<SupportedSwitch[]>([]);
  const currentPartId = useProjectStore((s) => s.project?.switch_profile.part_id);
  const setSwitch = useProjectStore((s) => s.setSwitch);

  useEffect(() => {
    api.switches.list().then(setSwitches);
  }, []);

  return (
    <div className="p-5 flex-1">
      <div className="mb-5">
        <h3 className="text-[14px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>
          How should it feel?
        </h3>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Pick a switch. This affects key feel, sound, and PCB footprint.
        </p>
      </div>

      <div className="space-y-2">
        {switches.map((sw) => {
          const isSelected = currentPartId === sw.part_id;
          const typeStyle = TYPE_STYLES[sw.switch_type] ?? { color: "var(--text-muted)", bg: "transparent", border: "var(--border-subtle)" };

          return (
            <button
              key={sw.part_id}
              onClick={() => setSwitch(sw.part_id)}
              className="w-full text-left p-3.5 rounded-xl transition-all duration-200"
              style={{
                background: isSelected ? "var(--accent-muted)" : "var(--bg-surface)",
                border: `1px solid ${isSelected ? "var(--accent)" : "var(--border-subtle)"}`,
                boxShadow: isSelected ? "0 0 0 1px var(--accent)" : "none",
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    {sw.name}
                  </span>
                  <span className="text-[11px] ml-2" style={{ color: "var(--text-muted)" }}>
                    {sw.manufacturer}
                  </span>
                </div>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: typeStyle.bg,
                    color: typeStyle.color,
                    border: `1px solid ${typeStyle.border}`,
                  }}
                >
                  {sw.switch_type}
                </span>
              </div>

              <div className="flex items-center gap-4 mb-2.5">
                <div className="flex-1">
                  <div className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>
                    Actuation force
                  </div>
                  <ForceBar force={sw.actuation_force_g} />
                </div>
                <span className="text-[12px] font-mono shrink-0" style={{ color: "var(--text-tertiary)" }}>
                  {sw.actuation_force_g}g
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {sw.total_travel_mm}mm travel
                </span>
                {sw.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
