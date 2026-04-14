import { useState } from "react";
import { api } from "../../lib/api";
import { useProjectStore } from "../../stores/projectStore";

export function PCBPanel() {
  const project = useProjectStore((s) => s.project);
  const [compiling, setCompiling] = useState(false);
  const [result, setResult] = useState<{ matrix_rows: number; matrix_cols: number; pins_needed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const ready = project?.pcb.matrix_rows !== null && (project?.pcb.matrix_rows ?? 0) > 0;

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-8">
        <h3 className="text-[16px] font-semibold text-white mb-1.5">PCB Compilation</h3>
        <p className="text-[13px] text-zinc-500 leading-[1.6]">Compile the scanning matrix and generate firmware metadata from your layout.</p>
      </div>

      <button onClick={handleCompile} disabled={compiling}
        className="w-full h-10 text-[13px] font-medium rounded-xl transition-all mb-6 bg-white text-[#050507] hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600">
        {compiling ? "Compiling..." : ready ? "Recompile" : "Compile Matrix"}
      </button>

      {error && (
        <div className="text-[13px] mb-6 px-4 py-3 rounded-xl bg-red-500/8 text-red-400 border border-red-500/15">{error}</div>
      )}

      {(result || ready) && (
        <div className="space-y-5">
          {/* Matrix */}
          <div className="rounded-2xl p-5 bg-white/[0.02] border border-white/[0.04]">
            <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-4">Matrix</div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { v: String(result?.matrix_rows ?? project?.pcb.matrix_rows ?? "?"), l: "Rows" },
                { v: String(result?.matrix_cols ?? project?.pcb.matrix_cols ?? "?"), l: "Cols" },
                { v: String(result?.pins_needed ?? ((project?.pcb.matrix_rows ?? 0) + (project?.pcb.matrix_cols ?? 0))), l: "Pins" },
              ].map(s => (
                <div key={s.l} className="text-center">
                  <div className="text-[22px] font-bold font-mono text-white">{s.v}</div>
                  <div className="text-[11px] text-zinc-600 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="text-[12px] text-zinc-600">
              {project?.pcb.controller.toUpperCase()} / {project?.pcb.diode_direction}
            </div>
          </div>

          {/* Firmware */}
          <div className="rounded-2xl p-5 bg-white/[0.02] border border-white/[0.04]">
            <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-4">Firmware</div>
            <div className="space-y-2">
              {["info.json", "keymap.json", "via.json"].map(f => (
                <div key={f} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/[0.02]">
                  <span className="text-[13px] font-mono text-zinc-400">{f}</span>
                  <span className="text-[10px] font-medium text-emerald-400">Ready</span>
                </div>
              ))}
            </div>
          </div>

          {/* Plate */}
          <div className="rounded-2xl p-5 bg-white/[0.02] border border-white/[0.04]">
            <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-4">Plate</div>
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/[0.02]">
              <span className="text-[13px] font-mono text-zinc-400">plate.dxf</span>
              {project && (
                <a href={api.geometry.plateUrl(project.project_id)} download
                  className="text-[11px] font-medium px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors">
                  Download
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
