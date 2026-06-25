import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useProjectStore } from "../../stores/projectStore";
import type { ExportPreview, ProjectRecords, ValidationReport } from "../../types/project";

const STATUS_DOT: Record<string, string> = { pass: "#4ade80", warn: "#fbbf24", fail: "#f87171", skipped: "#52525b" };

function formatTime(value?: string | null) {
  if (!value) return "just now";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function familyCopy(family: string | undefined) {
  if (!family) {
    return {
      validate: "Run the platform checks and review open issues before exporting.",
      export: "Run validation checks, then package your review-ready evidence bundle.",
      scope:
        "Geometry overlap, family-specific module requirements, module clearance, GPIO feasibility, labeling, switch selection, and assigned asset acceptance.",
    };
  }

  if (family === "keyboard" || family === "macropad") {
    return {
      validate: "Run switch, spacing, matrix, and fabrication checks before exporting the control surface.",
      export: "Package the switch plate, firmware metadata, and revision-linked validation records for review.",
      scope:
        "Switch selection, stabilizer fit, spacing, matrix feasibility, GPIO usage, labeling, assigned assets, and export readiness.",
    };
  }

  return {
    validate: "Run control, module, GPIO, and mechanical checks before exporting the controller bundle.",
    export: "Package the control-panel outputs, mapping metadata, and revision-linked validation records for review.",
    scope:
      "Control spacing, module compatibility, GPIO feasibility, labels, mechanical readiness, asset acceptance, and export readiness.",
  };
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
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
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

  useEffect(() => {
    if (!project || mode !== "export") {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }
    let active = true;
    setPreviewLoading(true);
    setPreviewError(null);
    api.export
      .preview(project.project_id)
      .then((payload) => {
        if (!active) return;
        setPreview(payload);
      })
      .catch((error) => {
        if (!active) return;
        setPreview(null);
        setPreviewError(error instanceof Error ? error.message : "Export preview unavailable.");
      })
      .finally(() => {
        if (!active) return;
        setPreviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, project?.project_id, project?.revision]);

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
        readiness === "review_ready"
          ? `Bundle exported with ${validationStatus} validation status and review-ready evidence.`
          : `Bundle exported as a candidate with ${validationStatus} validation status. Resolve warnings before relying on it for prototype planning.`
      );
      await loadProject(project.project_id);
      await onRecordsRefresh?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Export failed"); }
    setDownloading(false);
  };

  const canExport = validation && validation.status !== "fail";
  const showExport = mode === "export";
  const copy = familyCopy(project?.product_family);
  const guidePreviewLines =
    preview?.build_guide_markdown
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("|") && !line.startsWith("---"))
      .slice(0, 5) ?? [];
  const exportLabel = !validation
    ? "Run validation first"
    : validation.status === "pass"
      ? "Download Review Bundle"
      : validation.status === "warn"
        ? "Download Review Bundle"
        : "Fix errors first";

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-8">
        <h3 className="mb-1.5 text-[16px] font-semibold text-[var(--text-primary)]">
          {showExport ? "Export Bundle" : "Validation Review"}
        </h3>
        <p className="text-[13px] leading-[1.6] text-[var(--text-secondary)]">
          {showExport
            ? copy.export
            : copy.validate}
        </p>
      </div>

      {/* Validate */}
      <button onClick={handleValidate} disabled={validating}
        className="surface-button mb-5 h-10 w-full rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50">
        {validating ? "Validating..." : "Run Validation"}
      </button>

      {error && (
        <div className="glass-danger mb-5 rounded-xl px-4 py-3 text-[13px]">{error}</div>
      )}

      {exportMessage && (
        <div className="glass glass-soft mb-5 rounded-xl px-4 py-3 text-[13px] text-[var(--text-secondary)]">
          {exportMessage}
        </div>
      )}

      {/* Results */}
      {validation && (
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_DOT[validation.status] ?? "#52525b" }} />
            <span className="text-[13px] font-medium capitalize text-[var(--text-primary)]">{validation.status}</span>
            <span className="text-[12px] text-[var(--text-secondary)]">{validation.checks.length} checks</span>
            <span className="ml-auto text-[11px] text-[var(--text-tertiary)]">
              revision r{validation.revision} • {formatTime(validation.created_at)}
            </span>
          </div>

          <div className="space-y-2">
            {validation.checks.map((c) => (
              <div key={c.id} className="glass-subcard px-4 py-3 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_DOT[c.status] ?? "#52525b" }} />
                  <span className="text-[12px] font-mono text-[var(--text-secondary)]">{c.id}</span>
                  <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">{c.category}</span>
                </div>
                <div className="pl-3.5 text-[12px] leading-[1.5] text-[var(--text-secondary)]">{c.details}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!validation && staleValidation && (
        <div className="glass glass-soft mb-5 rounded-xl border border-amber-500/15 px-4 py-3 text-[12px] text-amber-600 dark:text-amber-300">
          Latest validation is from revision r{staleValidation.revision}. Run validation again for the current project revision r{project?.revision}.
        </div>
      )}

      {!validation && !staleValidation && (
        <div className="surface-panel mb-5 rounded-xl px-4 py-3 text-[12px] leading-[1.6] text-[var(--text-secondary)]">
          No validation report is attached to this revision yet. Run validation before using export state as a build signal.
        </div>
      )}

      {/* Export */}
      {showExport && (
        <button onClick={handleExport} disabled={downloading || !canExport}
          className="surface-button-primary h-11 w-full rounded-xl text-[14px] font-semibold transition-all disabled:opacity-40">
          {downloading ? "Packaging..." : exportLabel}
        </button>
      )}

      {showExport && (
        <div className="glass glass-soft mt-5 rounded-xl px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              Build guide preview
            </div>
            {preview && (
              <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                {preview.export_readiness.replace(/_/g, " ")}
              </div>
            )}
          </div>
          {previewLoading ? (
            <div className="text-[12px] text-[var(--text-tertiary)]">Preparing export preview…</div>
          ) : previewError ? (
            <div className="text-[12px] leading-[1.6] text-amber-600 dark:text-amber-300">
              {previewError}
            </div>
          ) : preview ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="surface-chip rounded-lg px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Files</div>
                  <div className="mt-1 text-[13px] text-[var(--text-primary)]">{preview.included_files.length}</div>
                </div>
                <div className="surface-chip rounded-lg px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">BOM lines</div>
                  <div className="mt-1 text-[13px] text-[var(--text-primary)]">{preview.bom.counts.line_items}</div>
                </div>
                <div className="surface-chip rounded-lg px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Pins left</div>
                  <div className="mt-1 text-[13px] text-[var(--text-primary)]">{preview.bom.counts.gpio_remaining}</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {guidePreviewLines.map((line) => (
                  <div key={line} className="text-[12px] leading-[1.55] text-[var(--text-secondary)]">
                    {line.replace(/^#+\s*/, "")}
                  </div>
                ))}
              </div>
              <div className="section-rule pt-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  Sourcing gaps
                </div>
                <div className="space-y-1.5">
                  {preview.missing_outputs.slice(0, 3).map((item) => (
                    <div key={item} className="text-[12px] leading-[1.55] text-[var(--text-secondary)]">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="section-rule pt-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  Review BOM
                </div>
                <div className="space-y-2">
                  {preview.bom.items.slice(0, 4).map((item) => (
                    <div key={`${item.category}-${item.item}`} className="flex items-start justify-between gap-3 text-[12px]">
                      <div className="min-w-0">
                        <div className="text-[var(--text-primary)]">{item.item}</div>
                        <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">{item.category}</div>
                      </div>
                      <div className="shrink-0 text-[var(--text-secondary)]">×{item.quantity}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[12px] text-[var(--text-tertiary)]">Export preview unavailable.</div>
          )}
        </div>
      )}

      {/* Contents note */}
      <div className="glass glass-soft mt-5 px-4 py-3 rounded-xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          {showExport ? "Bundle contains" : "Validation scope"}
        </div>
        <div className="text-[12px] leading-[1.7] text-[var(--text-secondary)]">
          {showExport
            ? "Mechanical DXF/spec artifacts, firmware metadata, validation report, manifest, build guide, and review BOM. Current bundles are review-ready evidence, not complete fabrication packages."
            : copy.scope}
        </div>
      </div>

      {project?.exports.bundle_id && (
        <div className="mt-3 text-[11px] text-[var(--text-tertiary)]">
          Last export: {project.exports.bundle_id}
          {project.status === "exported" ? " · review-ready" : " · candidate bundle"}
        </div>
      )}

      {records?.latest_export && (
        <div className="glass glass-soft mt-3 px-4 py-3 rounded-xl">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
            Export history
          </div>
          <div className="text-[12px] leading-[1.7] text-[var(--text-secondary)]">
            Latest bundle from revision r{records.latest_export.source_revision} via{" "}
            {(records.latest_export.producer_id ?? "export_bundler").replace(/_/g, " ")}.
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            {formatTime(records.latest_export.created_at)} •{" "}
            {(records.latest_export.acceptance_state ?? "candidate").replace(/_/g, " ")}
          </div>
        </div>
      )}
    </div>
  );
}
