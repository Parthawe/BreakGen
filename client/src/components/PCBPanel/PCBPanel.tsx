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
  const [downloadingArtifact, setDownloadingArtifact] = useState<string | null>(null);
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

  const handleMechanicalDownload = async (artifactName: string) => {
    if (!project) return;
    setDownloadingArtifact(artifactName);
    setError(null);
    try {
      await api.geometry.downloadMechanicalArtifact(project.project_id, artifactName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Artifact download failed");
    } finally {
      setDownloadingArtifact(null);
    }
  };

  const ready = !!persistedSummary || (project?.pcb.matrix_rows !== null && (project?.pcb.matrix_rows ?? 0) >= 0);
  const isHandheldProofFamily =
    project?.product_family === "handheld_companion" ||
    project?.product_family === "retro_handheld";
  const isKeyboardLike =
    project?.product_family === "keyboard" ||
    project?.product_family === "macropad";
  const title = isKeyboardLike ? "Electronics Compile" : "Control Electronics";
  const description = isKeyboardLike
    ? "Compile switch-matrix metadata, GPIO usage, firmware targets, and family-aware panel outputs from the saved revision."
    : "Compile control mapping metadata, GPIO usage, firmware targets, and family-aware mechanical outputs from the saved revision.";

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-8">
        <h3 className="mb-1.5 text-[16px] font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="text-[13px] leading-[1.6] text-[var(--text-secondary)]">{description}</p>
      </div>

      <button onClick={handleCompile} disabled={compiling}
        className="surface-button-primary mb-6 h-10 w-full rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50">
        {compiling ? "Compiling..." : ready ? "Recompile Electronics" : "Compile Electronics"}
      </button>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/15 bg-red-500/8 px-4 py-3 text-[13px] text-red-600 dark:text-red-400">{error}</div>
      )}

      {!error && !result && !ready && (
        <div className="surface-panel mb-6 rounded-xl px-4 py-3 text-[12px] leading-[1.6] text-[var(--text-secondary)]">
          No electronics compile is attached to this revision yet. Run the family-aware compile before treating firmware or GPIO state as current.
        </div>
      )}

      {(result || ready) && (
        <div className="space-y-5">
          {/* Matrix */}
          <div className="glass glass-soft rounded-2xl p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Electronics</div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { v: String(result?.matrix_rows ?? persistedSummary?.matrix_rows ?? project?.pcb.matrix_rows ?? "?"), l: "Rows" },
                { v: String(result?.matrix_cols ?? persistedSummary?.matrix_cols ?? project?.pcb.matrix_cols ?? "?"), l: "Cols" },
                { v: String(result?.pins_needed ?? persistedSummary?.pins_needed ?? ((project?.pcb.matrix_rows ?? 0) + (project?.pcb.matrix_cols ?? 0))), l: "GPIO" },
              ].map(s => (
                <div key={s.l} className="text-center">
                  <div className="text-[22px] font-bold font-mono text-[var(--text-primary)]">{s.v}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="glass-subcard rounded-xl px-4 py-3">
                <div className="text-[var(--text-tertiary)]">
                  {isKeyboardLike ? "Matrix strategy" : "Control routing"}
                </div>
                <div className="mt-1 capitalize text-[var(--text-primary)]">
                  {(result?.matrix_strategy ?? persistedSummary?.matrix_strategy ?? "physical_rows").replace(/_/g, " ")}
                </div>
              </div>
              <div className="glass-subcard rounded-xl px-4 py-3">
                <div className="text-[var(--text-tertiary)]">Firmware target</div>
                <div className="mt-1 text-[var(--text-primary)]">
                  {(result?.firmware_target ?? persistedSummary?.firmware_target ?? "qmk_via_keyboard").replace(/_/g, " ")}
                </div>
              </div>
              <div className="glass-subcard rounded-xl px-4 py-3">
                <div className="text-[var(--text-tertiary)]">Control protocol</div>
                <div className="mt-1 text-[var(--text-primary)]">
                  {(result?.control_protocol ?? persistedSummary?.control_protocol ?? "usb_hid_keyboard").replace(/_/g, " ")}
                </div>
              </div>
              <div className="glass-subcard rounded-xl px-4 py-3">
                <div className="text-[var(--text-tertiary)]">Controller budget</div>
                <div className="mt-1 text-[var(--text-primary)]">
                  {result?.pins_needed ?? persistedSummary?.pins_needed ?? ((project?.pcb.matrix_rows ?? 0) + (project?.pcb.matrix_cols ?? 0))}/
                  {result?.gpio_budget ?? persistedSummary?.gpio_budget ?? 26} GPIO
                </div>
              </div>
            </div>
            <div className="mt-4 text-[12px] text-[var(--text-tertiary)]">
              {project?.pcb.controller.toUpperCase()} / {project?.pcb.diode_direction}
            </div>
          </div>

          {(result ?? persistedSummary) && (
            <div className="glass glass-soft rounded-2xl p-5">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Pin Allocation</div>
              {(() => {
                const summary = result ?? persistedSummary!;
                return (
                  <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="glass-subcard rounded-xl px-4 py-3">
                  <div className="text-[12px] text-[var(--text-tertiary)]">Matrix controls</div>
                  <div className="mt-1 font-mono text-[18px] text-[var(--text-primary)]">{summary.matrix_controls}</div>
                  <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">{summary.matrix_pins} matrix GPIO</div>
                </div>
                <div className="glass-subcard rounded-xl px-4 py-3">
                  <div className="text-[12px] text-[var(--text-tertiary)]">Direct controls</div>
                  <div className="mt-1 font-mono text-[18px] text-[var(--text-primary)]">{summary.direct_controls}</div>
                  <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">{summary.direct_pins} direct GPIO</div>
                </div>
              </div>
              {summary.direct_pin_usage.length > 0 ? (
                <div className="space-y-2">
                  {summary.direct_pin_usage.map((usage) => (
                    <div key={usage.element_type} className="glass-subcard flex items-center justify-between px-4 py-2.5 rounded-xl">
                      <div>
                        <div className="text-[12px] capitalize text-[var(--text-primary)]">{usage.element_type.replace(/_/g, " ")}</div>
                        <div className="text-[11px] text-[var(--text-tertiary)]">{usage.control_count} control(s) × {usage.pins_per_control} pin(s)</div>
                      </div>
                      <div className="text-[12px] font-mono text-[var(--text-secondary)]">{usage.total_pins}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-[var(--text-tertiary)]">No direct-pin controls in this layout.</div>
              )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Firmware */}
          <div className="glass glass-soft rounded-2xl p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Firmware</div>
            <div className="space-y-2">
              {["info.json", "keymap.json", "via.json", "control-map.json"].map(f => (
                <div key={f} className="glass-subcard flex items-center justify-between px-4 py-2.5 rounded-xl">
                  <span className="text-[13px] font-mono text-[var(--text-secondary)]">{f}</span>
                  <span className="text-[10px] font-medium text-emerald-500 dark:text-emerald-400">Ready</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mechanical panel */}
          <div className="glass glass-soft rounded-2xl p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              Mechanical {isHandheldProofFamily ? "Shell" : "Panel"}
            </div>
            <div className="space-y-2">
              {(isHandheldProofFamily
                ? [
                    { label: "front-shell-panel.dxf" },
                    { label: "back-shell-reference.dxf" },
                    { label: "shell-spec.json" },
                  ]
                : [
                    { label: "panel.dxf" },
                  ]).map((artifact) => (
                <div key={artifact.label} className="glass-subcard flex items-center justify-between px-4 py-2.5 rounded-xl">
                  <span className="text-[13px] font-mono text-[var(--text-secondary)]">{artifact.label}</span>
                  {project && (
                    <button
                      type="button"
                      onClick={() => handleMechanicalDownload(artifact.label)}
                      disabled={downloadingArtifact === artifact.label}
                      className="text-[11px] font-medium px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:cursor-wait disabled:opacity-60"
                    >
                      {downloadingArtifact === artifact.label ? "Downloading..." : "Download"}
                    </button>
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
