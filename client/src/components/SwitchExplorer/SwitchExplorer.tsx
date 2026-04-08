import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { SupportedSwitch } from "../../types/project";
import { useProjectStore } from "../../stores/projectStore";

export function SwitchExplorer() {
  const [switches, setSwitches] = useState<SupportedSwitch[]>([]);
  const currentPartId = useProjectStore(
    (s) => s.project?.switch_profile.part_id
  );
  const setSwitch = useProjectStore((s) => s.setSwitch);

  useEffect(() => {
    api.switches.list().then(setSwitches);
  }, []);

  const typeColors: Record<string, string> = {
    linear: "text-red-400 border-red-900/50 bg-red-950/20",
    tactile: "text-amber-400 border-amber-900/50 bg-amber-950/20",
    clicky: "text-blue-400 border-blue-900/50 bg-blue-950/20",
  };

  return (
    <div className="p-6 space-y-3">
      <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-4">
        Switch Selection
      </h3>
      {switches.map((sw) => {
        const isSelected = currentPartId === sw.part_id;
        return (
          <button
            key={sw.part_id}
            onClick={() => setSwitch(sw.part_id)}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              isSelected
                ? "border-indigo-500 bg-indigo-950/20"
                : "border-neutral-800 bg-neutral-900/30 hover:border-neutral-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">{sw.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border ${typeColors[sw.switch_type] ?? "text-neutral-400"}`}
              >
                {sw.switch_type}
              </span>
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              {sw.actuation_force_g}g · {sw.total_travel_mm}mm ·{" "}
              {sw.manufacturer}
            </div>
          </button>
        );
      })}
    </div>
  );
}
