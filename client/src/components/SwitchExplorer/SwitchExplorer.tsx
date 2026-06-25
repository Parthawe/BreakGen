import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { SupportedSwitch } from "../../types/project";
import { useProjectStore } from "../../stores/projectStore";

const TYPE_COLORS: Record<string, string> = {
  linear: "#f87171",
  tactile: "#fbbf24",
  clicky: "#60a5fa",
};

export function SwitchExplorer() {
  const [switches, setSwitches] = useState<SupportedSwitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentPartId = useProjectStore((s) => s.project?.switch_profile.part_id);
  const family = useProjectStore((s) => s.project?.product_family ?? "keyboard");
  const setSwitch = useProjectStore((s) => s.setSwitch);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.switches
      .list()
      .then(setSwitches)
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load switches.");
      })
      .finally(() => setLoading(false));
  }, []);

  const description =
    family === "keyboard" || family === "macropad"
      ? "Choose the switch baseline. This affects feel, sound, and the PCB footprint."
      : "Choose the switch baseline for the key-bearing controls in this family. Non-key modules stay family-specific.";

  return (
    <div className="p-6 flex-1">
      <div className="mb-8">
        <h3 className="mb-1.5 text-[16px] font-semibold text-[var(--text-primary)]">How should it feel?</h3>
        <p className="text-[13px] leading-[1.6] text-[var(--text-secondary)]">{description}</p>
      </div>

      {loading ? (
        <div className="surface-panel rounded-xl px-4 py-3 text-[12px] text-[var(--text-secondary)]">
          Loading switch catalog…
        </div>
      ) : error ? (
        <div className="surface-panel rounded-xl px-4 py-3 text-[12px] text-[var(--text-secondary)]">
          {error}
        </div>
      ) : switches.length === 0 ? (
        <div className="surface-panel rounded-xl px-4 py-3 text-[12px] text-[var(--text-secondary)]">
          No switch catalog entries are available for this workspace.
        </div>
      ) : (
      <div className="space-y-2.5">
        {switches.map((sw) => {
          const selected = currentPartId === sw.part_id;
          const tc = TYPE_COLORS[sw.switch_type] ?? "#71717a";
          return (
            <button key={sw.part_id} onClick={() => setSwitch(sw.part_id)}
              className={`w-full text-left p-4 rounded-2xl transition-all duration-200 ${
                selected ? "glass border-indigo-500/25" : "glass glass-soft hover:border-white/[0.12]"} border`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-[14px] font-medium text-[var(--text-primary)]">{sw.name}</span>
                  <span className="ml-2 text-[12px] text-[var(--text-tertiary)]">{sw.manufacturer}</span>
                </div>
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize"
                  style={{ color: tc, background: tc + "12" }}>
                  {sw.switch_type}
                </span>
              </div>

              {/* Force bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-[var(--text-tertiary)]">Actuation force</span>
                  <span className="text-[12px] font-mono text-[var(--text-secondary)]">{sw.actuation_force_g}g</span>
                </div>
                <div className="glass-subcard h-1.5 rounded-full">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((sw.actuation_force_g / 80) * 100, 100)}%`, background: selected ? "#818cf8" : tc, opacity: 0.5 }} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[12px] text-[var(--text-tertiary)]">{sw.total_travel_mm}mm travel</span>
                {sw.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="glass-chip rounded-full px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">{tag}</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
      )}
    </div>
  );
}
