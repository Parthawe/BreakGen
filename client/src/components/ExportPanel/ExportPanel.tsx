import { useState } from "react";
import { api } from "../../lib/api";
import { useProjectStore } from "../../stores/projectStore";

interface Check {
  id: string;
  category: string;
  status: string;
  details: string;
}

interface ValidationResult {
  status: string;
  checks: Check[];
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  pass: { color: "var(--success)", bg: "rgba(34, 197, 94, 0.1)" },
  warn: { color: "var(--warn)", bg: "rgba(245, 158, 11, 0.1)" },
  fail: { color: "var(--error)", bg: "rgba(239, 68, 68, 0.1)" },
  skipped: { color: "var(--text-muted)", bg: "var(--bg-elevated)" },
};

export function ExportPanel() {
  const project = useProjectStore((s) => s.project);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async () => {
    if (!project) return;
    setValidating(true);
    setError(null);
    try {
      const result = await api.validation.run(project.project_id);
      setValidation(result);
      await useProjectStore.getState().loadProject(project.project_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
    }
    setValidating(false);
  };

  const handleExport = async () => {
    if (!project) return;
    setDownloading(true);
    setError(null);
    try {
      // Trigger download via direct navigation (FileResponse)
      const url = api.export.bundleUrl(project.project_id);
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${project.name.replace(/\s+/g, "_")}_export.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      await useProjectStore.getState().loadProject(project.project_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
    setDownloading(false);
  };

  const canExport = validation && validation.status !== "fail";
  const isExported = project?.status === "exported";

  return (
    <div className="p-5 h-full overflow-y-auto">
      <div className="mb-6">
        <h3 className="text-[14px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>
          Validate & Export
        </h3>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Run validation checks, then download your fabrication bundle.
        </p>
      </div>

      {/* Validate */}
      <button
        onClick={handleValidate}
        disabled={validating}
        className="w-full py-2.5 text-[13px] font-medium rounded-lg transition-all mb-4"
        style={{
          background: validating ? "var(--bg-elevated)" : "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          color: validating ? "var(--text-muted)" : "var(--text-primary)",
        }}
      >
        {validating ? "Validating..." : "Run Validation"}
      </button>

      {error && (
        <div className="text-[12px] mb-4 px-3 py-2.5 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "var(--error)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      {/* Validation results */}
      {validation && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: STATUS_COLORS[validation.status]?.color ?? "var(--text-muted)" }}
            />
            <span className="text-[12px] font-medium capitalize" style={{ color: STATUS_COLORS[validation.status]?.color }}>
              {validation.status}
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {validation.checks.length} checks
            </span>
          </div>

          <div className="space-y-1.5">
            {validation.checks.map((check) => {
              const st = STATUS_COLORS[check.status] ?? STATUS_COLORS.skipped;
              return (
                <div
                  key={check.id}
                  className="px-3 py-2.5 rounded-lg"
                  style={{ background: st.bg, border: `1px solid ${st.color}22` }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-medium uppercase" style={{ color: st.color }}>
                      {check.status}
                    </span>
                    <span className="text-[11px] font-mono" style={{ color: "var(--text-secondary)" }}>
                      {check.id}
                    </span>
                    <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>
                      {check.category}
                    </span>
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    {check.details}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Export */}
      <button
        onClick={handleExport}
        disabled={downloading || !canExport}
        className="w-full py-3 text-[13px] font-medium rounded-lg transition-all"
        style={{
          background: !canExport ? "var(--bg-elevated)" : "var(--accent)",
          color: !canExport ? "var(--text-muted)" : "#fff",
          cursor: !canExport ? "not-allowed" : "pointer",
        }}
      >
        {downloading ? "Packaging..." : !validation ? "Run validation first" : canExport ? "Download Export Bundle" : "Fix validation errors first"}
      </button>

      {/* Bundle contents note */}
      <div className="mt-4 px-3 py-2.5 rounded-lg text-[11px]" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
        Bundle includes: plate DXF, QMK info.json, keymap.json, VIA definition, validation report, manifest, and build guide.
      </div>

      {isExported && project.exports.bundle_id && (
        <div className="mt-3 text-[11px]" style={{ color: "var(--success)" }}>
          Last export: {project.exports.bundle_id}
        </div>
      )}
    </div>
  );
}
