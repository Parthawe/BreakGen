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
  const currentPartId = useProjectStore((s) => s.project?.switch_profile.part_id);
  const setSwitch = useProjectStore((s) => s.setSwitch);

  useEffect(() => { api.switches.list().then(setSwitches); }, []);

  return (
    <div className="p-6 flex-1">
      <div className="mb-8">
        <h3 className="text-[16px] font-semibold text-white mb-1.5">How should it feel?</h3>
        <p className="text-[13px] text-zinc-500 leading-[1.6]">Choose a switch. This determines key feel, sound, and PCB footprint.</p>
      </div>

      <div className="space-y-2.5">
        {switches.map((sw) => {
          const selected = currentPartId === sw.part_id;
          const tc = TYPE_COLORS[sw.switch_type] ?? "#71717a";
          return (
            <button key={sw.part_id} onClick={() => setSwitch(sw.part_id)}
              className={`w-full text-left p-4 rounded-2xl transition-all duration-200 ${
                selected ? "bg-indigo-500/8 border-indigo-500/25" : "bg-white/[0.02] border-white/[0.04] hover:border-white/[0.08]"} border`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-[14px] font-medium text-white">{sw.name}</span>
                  <span className="text-[12px] text-zinc-600 ml-2">{sw.manufacturer}</span>
                </div>
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize"
                  style={{ color: tc, background: tc + "12" }}>
                  {sw.switch_type}
                </span>
              </div>

              {/* Force bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-zinc-600">Actuation force</span>
                  <span className="text-[12px] font-mono text-zinc-400">{sw.actuation_force_g}g</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.04]">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((sw.actuation_force_g / 80) * 100, 100)}%`, background: selected ? "#818cf8" : tc, opacity: 0.5 }} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[12px] text-zinc-600">{sw.total_travel_mm}mm travel</span>
                {sw.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-[10px] text-zinc-600 px-2 py-0.5 rounded-full bg-white/[0.03]">{tag}</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
