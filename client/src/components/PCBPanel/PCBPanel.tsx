import { useState } from "react";
import { api } from "../../lib/api";
import { useProjectStore } from "../../stores/projectStore";

interface CompileResult {
  matrix_rows: number;
  matrix_cols: number;
  pins_needed: number;
  revision: number;
}

export function PCBPanel() {
  const project = useProjectStore((s) => s.project);
  const [compiling, setCompiling] = useState(false);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompile = async () => {
    if (!project) return;
    setCompiling(true);
    setError(null);
    try {
      const r = await api.pcb.compile(project.project_id);
      setResult(r);
      await useProjectStore.getState().loadProject(project.project_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compilation failed");
    }
    setCompiling(false);
  };

  const matrixReady = project?.pcb.matrix_rows !== null && (project?.pcb.matrix_rows ?? 0) > 0;

  return (
    <div className="p-5 h-full overflow-y-auto">
      <div className="mb-6">
        <h3 className="text-[14px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>
          PCB Compilation
        </h3>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Compile the scanning matrix from your layout, generate firmware metadata.
        </p>
      </div>

      {/* Compile button */}
      <button
        onClick={handleCompile}
        disabled={compiling}
        className="w-full py-2.5 text-[13px] font-medium rounded-lg transition-all mb-5"
        style={{
          background: compiling ? "var(--bg-elevated)" : "var(--accent)",
          color: compiling ? "var(--text-muted)" : "#fff",
        }}
      >
        {compiling ? "Compiling..." : matrixReady ? "Recompile Matrix" : "Compile Matrix"}
      </button>

      {error && (
        <div className="text-[12px] mb-4 px-3 py-2.5 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "var(--error)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      {/* Results */}
      {(result || matrixReady) && (
        <div className="space-y-4">
          <div className="rounded-xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="text-[10px] font-medium uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
              Matrix
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Rows" value={String(result?.matrix_rows ?? project?.pcb.matrix_rows ?? "?")} />
              <Stat label="Cols" value={String(result?.matrix_cols ?? project?.pcb.matrix_cols ?? "?")} />
              <Stat label="Pins" value={String(result?.pins_needed ?? ((project?.pcb.matrix_rows ?? 0) + (project?.pcb.matrix_cols ?? 0)))} />
            </div>
            <div className="mt-3 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              Controller: {project?.pcb.controller.toUpperCase()} / Diode: {project?.pcb.diode_direction}
            </div>
          </div>

          {/* Firmware downloads */}
          <div className="rounded-xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="text-[10px] font-medium uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
              Firmware Metadata
            </div>
            <div className="space-y-1.5">
              {["info.json", "keymap.json", "via.json"].map((file) => (
                <div key={file} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                  <span className="text-[12px] font-mono" style={{ color: "var(--text-secondary)" }}>{file}</span>
                  <span className="text-[10px]" style={{ color: "var(--success)" }}>Ready</span>
                </div>
              ))}
            </div>
          </div>

          {/* Plate */}
          <div className="rounded-xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="text-[10px] font-medium uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
              Plate Geometry
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
              <span className="text-[12px] font-mono" style={{ color: "var(--text-secondary)" }}>plate.dxf</span>
              {project && (
                <a
                  href={api.geometry.plateUrl(project.project_id)}
                  download
                  className="text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
                  style={{ color: "var(--accent)", background: "var(--accent-muted)" }}
                >
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[18px] font-mono font-medium" style={{ color: "var(--text-primary)" }}>{value}</div>
      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}
