import { useState } from "react";
import { api } from "../../lib/api";
import { useProjectStore } from "../../stores/projectStore";

interface CompileResult {
  matrix_rows: number;
  matrix_cols: number;
  matrix_strategy: string;
  matrix_controls: number;
  direct_controls: number;
  matrix_pins: number;
  direct_pins: number;
  pins_needed: number;
  gpio_budget: number;
  gpio_remaining: number;
  firmware_target: string;
  control_protocol: string;
  direct_pin_usage: Array<{
    element_type: string;
    control_count: number;
    pins_per_control: number;
    total_pins: number;
  }>;
}

export function PCBPanel() {
  const project = useProjectStore((s) => s.project);
  const [compiling, setCompiling] = useState(false);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const persistedSummary = (project?.derived?.electronics as CompileResult | undefined) ?? null;

  const handleCompile = async () => {
    if (!project) return;
    setCompiling(true); setError(null);
    try {
      const r = await api.pcb.compile(project.project_id);
      setResult(r);
      await useProjectStore.getState().loadProject(project.project_id);
    } catch (e) { setError(e instanceof Error ? e.message : "Compilation failed"); }
    setCompiling(false);
  };

  const ready = !!persistedSummary || (project?.pcb.matrix_rows !== null && (project?.pcb.matrix_rows ?? 0) >= 0);
  const isHandheldProofFamily =
    project?.product_family === "handheld_companion" ||
    project?.product_family === "retro_handheld";

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-8">
        <h3 className="text-[16px] font-semibold text-white mb-1.5">PCB Compilation</h3>
        <p className="text-[13px] text-zinc-500 leading-[1.6]">Compile family-aware electronics metadata from your layout, including matrix strategy, direct GPIO usage, and firmware target.</p>
      </div>

      <button onClick={handleCompile} disabled={compiling}
        className="w-full h-10 text-[13px] font-medium rounded-xl transition-all mb-6 bg-white text-[#050507] hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600">
        {compiling ? "Compiling..." : ready ? "Recompile Electronics" : "Compile Electronics"}
      </button>

      {error && (
        <div className="text-[13px] mb-6 px-4 py-3 rounded-xl bg-red-500/8 text-red-400 border border-red-500/15">{error}</div>
      )}

      {(result || ready) && (
        <div className="space-y-5">
          {/* Matrix */}
          <div className="glass glass-soft rounded-2xl p-5">
            <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-4">Electronics</div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { v: String(result?.matrix_rows ?? persistedSummary?.matrix_rows ?? project?.pcb.matrix_rows ?? "?"), l: "Rows" },
                { v: String(result?.matrix_cols ?? persistedSummary?.matrix_cols ?? project?.pcb.matrix_cols ?? "?"), l: "Cols" },
                { v: String(result?.pins_needed ?? persistedSummary?.pins_needed ?? ((project?.pcb.matrix_rows ?? 0) + (project?.pcb.matrix_cols ?? 0))), l: "GPIO" },
              ].map(s => (
                <div key={s.l} className="text-center">
                  <div className="text-[22px] font-bold font-mono text-white">{s.v}</div>
                  <div className="text-[11px] text-zinc-600 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="glass-subcard rounded-xl px-4 py-3">
                <div className="text-zinc-600">Matrix strategy</div>
                <div className="text-zinc-300 mt-1 capitalize">
                  {(result?.matrix_strategy ?? persistedSummary?.matrix_strategy ?? "physical_rows").replace(/_/g, " ")}
                </div>
              </div>
              <div className="glass-subcard rounded-xl px-4 py-3">
                <div className="text-zinc-600">Firmware target</div>
                <div className="text-zinc-300 mt-1">
                  {(result?.firmware_target ?? persistedSummary?.firmware_target ?? "qmk_via_keyboard").replace(/_/g, " ")}
                </div>
              </div>
              <div className="glass-subcard rounded-xl px-4 py-3">
                <div className="text-zinc-600">Control protocol</div>
                <div className="text-zinc-300 mt-1">
                  {(result?.control_protocol ?? persistedSummary?.control_protocol ?? "usb_hid_keyboard").replace(/_/g, " ")}
                </div>
              </div>
              <div className="glass-subcard rounded-xl px-4 py-3">
                <div className="text-zinc-600">Controller budget</div>
                <div className="text-zinc-300 mt-1">
                  {result?.pins_needed ?? persistedSummary?.pins_needed ?? ((project?.pcb.matrix_rows ?? 0) + (project?.pcb.matrix_cols ?? 0))}/
                  {result?.gpio_budget ?? persistedSummary?.gpio_budget ?? 26} GPIO
                </div>
              </div>
            </div>
            <div className="text-[12px] text-zinc-600 mt-4">
              {project?.pcb.controller.toUpperCase()} / {project?.pcb.diode_direction}
            </div>
          </div>

          {(result ?? persistedSummary) && (
            <div className="glass glass-soft rounded-2xl p-5">
              <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-4">Pin Allocation</div>
              {(() => {
                const summary = result ?? persistedSummary!;
                return (
                  <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="glass-subcard rounded-xl px-4 py-3">
                  <div className="text-zinc-600 text-[12px]">Matrix controls</div>
                  <div className="text-white font-mono text-[18px] mt-1">{summary.matrix_controls}</div>
                  <div className="text-zinc-600 text-[11px] mt-1">{summary.matrix_pins} matrix GPIO</div>
                </div>
                <div className="glass-subcard rounded-xl px-4 py-3">
                  <div className="text-zinc-600 text-[12px]">Direct controls</div>
                  <div className="text-white font-mono text-[18px] mt-1">{summary.direct_controls}</div>
                  <div className="text-zinc-600 text-[11px] mt-1">{summary.direct_pins} direct GPIO</div>
                </div>
              </div>
              {summary.direct_pin_usage.length > 0 ? (
                <div className="space-y-2">
                  {summary.direct_pin_usage.map((usage) => (
                    <div key={usage.element_type} className="glass-subcard flex items-center justify-between px-4 py-2.5 rounded-xl">
                      <div>
                        <div className="text-[12px] text-zinc-300 capitalize">{usage.element_type.replace(/_/g, " ")}</div>
                        <div className="text-[11px] text-zinc-600">{usage.control_count} control(s) × {usage.pins_per_control} pin(s)</div>
                      </div>
                      <div className="text-[12px] font-mono text-zinc-400">{usage.total_pins}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-zinc-600">No direct-pin controls in this layout.</div>
              )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Firmware */}
          <div className="glass glass-soft rounded-2xl p-5">
            <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-4">Firmware</div>
            <div className="space-y-2">
              {["info.json", "keymap.json", "via.json", "control-map.json"].map(f => (
                <div key={f} className="glass-subcard flex items-center justify-between px-4 py-2.5 rounded-xl">
                  <span className="text-[13px] font-mono text-zinc-400">{f}</span>
                  <span className="text-[10px] font-medium text-emerald-400">Ready</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mechanical panel */}
          <div className="glass glass-soft rounded-2xl p-5">
            <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-4">
              Mechanical {isHandheldProofFamily ? "Shell" : "Panel"}
            </div>
            <div className="space-y-2">
              {(isHandheldProofFamily
                ? [
                    { label: "front-shell-panel.dxf", url: project ? api.geometry.mechanicalArtifactUrl(project.project_id, "front-shell-panel.dxf") : "#" },
                    { label: "back-shell-reference.dxf", url: project ? api.geometry.mechanicalArtifactUrl(project.project_id, "back-shell-reference.dxf") : "#" },
                    { label: "shell-spec.json", url: project ? api.geometry.mechanicalArtifactUrl(project.project_id, "shell-spec.json") : "#" },
                  ]
                : [
                    { label: "panel.dxf", url: project ? api.geometry.mechanicalArtifactUrl(project.project_id, "panel.dxf") : "#" },
                  ]).map((artifact) => (
                <div key={artifact.label} className="glass-subcard flex items-center justify-between px-4 py-2.5 rounded-xl">
                  <span className="text-[13px] font-mono text-zinc-400">{artifact.label}</span>
                  {project && (
                    <a href={artifact.url} download
                      className="text-[11px] font-medium px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors">
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
