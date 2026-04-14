import { useState } from "react";
import { api } from "../../lib/api";
import { useProjectStore } from "../../stores/projectStore";

interface Check { id: string; category: string; status: string; details: string; }
interface ValidationResult { status: string; checks: Check[]; }

const STATUS_DOT: Record<string, string> = { pass: "#4ade80", warn: "#fbbf24", fail: "#f87171", skipped: "#52525b" };

export function ExportPanel() {
  const project = useProjectStore((s) => s.project);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async () => {
    if (!project) return;
    setValidating(true); setError(null);
    try {
      const r = await api.validation.run(project.project_id);
      setValidation(r);
      await useProjectStore.getState().loadProject(project.project_id);
    } catch (e) { setError(e instanceof Error ? e.message : "Validation failed"); }
    setValidating(false);
  };

  const handleExport = async () => {
    if (!project) return;
    setDownloading(true); setError(null);
    try {
      const res = await fetch(api.export.bundleUrl(project.project_id), { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${project.name.replace(/\s+/g, "_")}_export.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      await useProjectStore.getState().loadProject(project.project_id);
    } catch (e) { setError(e instanceof Error ? e.message : "Export failed"); }
    setDownloading(false);
  };

  const canExport = validation && validation.status !== "fail";

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-8">
        <h3 className="text-[16px] font-semibold text-white mb-1.5">Validate & Export</h3>
        <p className="text-[13px] text-zinc-500 leading-[1.6]">Run validation checks, then download your fabrication bundle.</p>
      </div>

      {/* Validate */}
      <button onClick={handleValidate} disabled={validating}
        className="w-full h-10 text-[13px] font-medium rounded-xl transition-all mb-5 bg-white/[0.04] border border-white/[0.06] text-zinc-300 hover:bg-white/[0.07] hover:text-white disabled:opacity-50">
        {validating ? "Validating..." : "Run Validation"}
      </button>

      {error && (
        <div className="text-[13px] mb-5 px-4 py-3 rounded-xl bg-red-500/8 text-red-400 border border-red-500/15">{error}</div>
      )}

      {/* Results */}
      {validation && (
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_DOT[validation.status] ?? "#52525b" }} />
            <span className="text-[13px] font-medium text-white capitalize">{validation.status}</span>
            <span className="text-[12px] text-zinc-600">{validation.checks.length} checks</span>
          </div>

          <div className="space-y-2">
            {validation.checks.map((c) => (
              <div key={c.id} className="px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_DOT[c.status] ?? "#52525b" }} />
                  <span className="text-[12px] font-mono text-zinc-400">{c.id}</span>
                  <span className="text-[10px] text-zinc-700 ml-auto">{c.category}</span>
                </div>
                <div className="text-[12px] text-zinc-500 leading-[1.5] pl-3.5">{c.details}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export */}
      <button onClick={handleExport} disabled={downloading || !canExport}
        className="w-full h-11 text-[14px] font-semibold rounded-xl transition-all bg-white text-[#050507] hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600">
        {downloading ? "Packaging..." : !validation ? "Run validation first" : canExport ? "Download Export Bundle" : "Fix errors first"}
      </button>

      {/* Contents note */}
      <div className="mt-5 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
        <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-2">Bundle contains</div>
        <div className="text-[12px] text-zinc-500 leading-[1.7]">
          Plate DXF, QMK info.json, keymap.json, VIA definition, validation report, manifest, build guide.
        </div>
      </div>

      {project?.status === "exported" && project.exports.bundle_id && (
        <div className="mt-3 text-[11px] text-emerald-400/70">Last export: {project.exports.bundle_id}</div>
      )}
    </div>
  );
}
