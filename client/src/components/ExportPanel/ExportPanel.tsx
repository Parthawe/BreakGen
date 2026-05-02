import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useProjectStore } from "../../stores/projectStore";
import type { ProjectRecords, ValidationReport } from "../../types/project";

const STATUS_DOT: Record<string, string> = { pass: "#4ade80", warn: "#fbbf24", fail: "#f87171", skipped: "#52525b" };

function formatTime(value?: string | null) {
  if (!value) return "just now";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function ExportPanel({
  mode = "export",
  records = null,
  onRecordsRefresh,
}: {
  mode?: "validate" | "export";
  records?: ProjectRecords | null;
  onRecordsRefresh?: () => Promise<void>;
}) {
  const project = useProjectStore((s) => s.project);
  const loadProject = useProjectStore((s) => s.loadProject);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const latestValidationForRevision = useMemo(() => {
    if (!project || !records?.latest_validation_report) return null;
    return records.latest_validation_report.revision === project.revision
      ? records.latest_validation_report
      : null;
  }, [project, records?.latest_validation_report]);
  const staleValidation = useMemo(() => {
    if (!project || !records?.latest_validation_report) return null;
    return records.latest_validation_report.revision === project.revision
      ? null
      : records.latest_validation_report;
  }, [project, records?.latest_validation_report]);

  useEffect(() => {
    setValidation(latestValidationForRevision);
  }, [latestValidationForRevision]);

  const handleValidate = async () => {
    if (!project) return;
    setValidating(true); setError(null); setExportMessage(null);
    try {
      const r = await api.validation.run(project.project_id);
      setValidation(r);
      await loadProject(project.project_id);
      await onRecordsRefresh?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Validation failed"); }
    setValidating(false);
  };

  const handleExport = async () => {
    if (!project) return;
    setDownloading(true); setError(null); setExportMessage(null);
    try {
      const res = await api.export.download(project.project_id);
      if (!res.ok) throw new Error(await res.text());
      const readiness = res.headers.get("X-Export-Readiness") ?? "candidate";
      const validationStatus = res.headers.get("X-Validation-Status") ?? "warn";
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${project.name.replace(/\s+/g, "_")}_export.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      setExportMessage(
        readiness === "production_ready"
          ? `Bundle exported with ${validationStatus} validation status and production-ready readiness.`
          : `Bundle exported for review with ${validationStatus} validation status. Resolve warnings before treating it as production-ready.`
      );
      await loadProject(project.project_id);
      await onRecordsRefresh?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Export failed"); }
    setDownloading(false);
  };

  const canExport = validation && validation.status !== "fail";
  const showExport = mode === "export";

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-8">
        <h3 className="text-[16px] font-semibold text-white mb-1.5">
          {showExport ? "Export Bundle" : "Validation Review"}
        </h3>
        <p className="text-[13px] text-zinc-500 leading-[1.6]">
          {showExport
            ? "Run validation checks, then package your fabrication bundle."
            : "Run the platform checks and review open issues before exporting."}
        </p>
      </div>

      {/* Validate */}
      <button onClick={handleValidate} disabled={validating}
        className="glass-button w-full h-10 text-[13px] font-medium rounded-xl transition-all mb-5 text-zinc-300 hover:text-white disabled:opacity-50">
        {validating ? "Validating..." : "Run Validation"}
      </button>

      {error && (
        <div className="glass-danger text-[13px] mb-5 px-4 py-3 rounded-xl text-red-300">{error}</div>
      )}

      {exportMessage && (
        <div className="glass glass-soft text-[13px] mb-5 px-4 py-3 rounded-xl text-zinc-400">
          {exportMessage}
        </div>
      )}

      {/* Results */}
      {validation && (
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_DOT[validation.status] ?? "#52525b" }} />
            <span className="text-[13px] font-medium text-white capitalize">{validation.status}</span>
            <span className="text-[12px] text-zinc-600">{validation.checks.length} checks</span>
            <span className="text-[11px] text-zinc-700 ml-auto">
              revision r{validation.revision} • {formatTime(validation.created_at)}
            </span>
          </div>

          <div className="space-y-2">
            {validation.checks.map((c) => (
              <div key={c.id} className="glass-subcard px-4 py-3 rounded-xl">
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

      {!validation && staleValidation && (
        <div className="glass glass-soft text-[12px] mb-5 px-4 py-3 rounded-xl text-amber-300 border border-amber-500/15">
          Latest validation is from revision r{staleValidation.revision}. Run validation again for the current project revision r{project?.revision}.
        </div>
      )}

      {/* Export */}
      {showExport && (
        <button onClick={handleExport} disabled={downloading || !canExport}
          className="glass-button-primary w-full h-11 text-[14px] font-semibold rounded-xl transition-all disabled:opacity-40">
          {downloading ? "Packaging..." : !validation ? "Run validation first" : canExport ? "Download Export Bundle" : "Fix errors first"}
        </button>
      )}

      {/* Contents note */}
      <div className="glass glass-soft mt-5 px-4 py-3 rounded-xl">
        <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-2">
          {showExport ? "Bundle contains" : "Validation scope"}
        </div>
        <div className="text-[12px] text-zinc-500 leading-[1.7]">
          {showExport
            ? "Mechanical DXF/spec artifacts, firmware metadata, validation report, manifest, and build guide. Bundle readiness tracks validation status instead of assuming fabrication readiness."
            : "Geometry overlap, family-specific module requirements, module clearance, GPIO feasibility, labeling, switch selection, and assigned asset acceptance."}
        </div>
      </div>

      {project?.exports.bundle_id && (
        <div className="mt-3 text-[11px] text-zinc-500">
          Last export: {project.exports.bundle_id}
          {project.status === "exported" ? " · production-ready" : " · review bundle"}
        </div>
      )}

      {records?.latest_export && (
        <div className="glass glass-soft mt-3 px-4 py-3 rounded-xl">
          <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-2">
            Export history
          </div>
          <div className="text-[12px] text-zinc-400 leading-[1.7]">
            Latest bundle from revision r{records.latest_export.source_revision} via{" "}
            {(records.latest_export.producer_id ?? "export_bundler").replace(/_/g, " ")}.
          </div>
          <div className="text-[11px] text-zinc-600 mt-1">
            {formatTime(records.latest_export.created_at)} •{" "}
            {(records.latest_export.acceptance_state ?? "candidate").replace(/_/g, " ")}
          </div>
        </div>
      )}
    </div>
  );
}
