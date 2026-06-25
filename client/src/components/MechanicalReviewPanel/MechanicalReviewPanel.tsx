import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useProjectStore } from "../../stores/projectStore";
import type { MechanicalCompileResult, ProjectDocument } from "../../types/project";

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function formatTimestamp(value?: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function isMechanicalCompileResult(value: unknown): value is MechanicalCompileResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.project_id === "string" &&
    typeof candidate.revision === "number" &&
    (candidate.mechanical_kind === "panel" || candidate.mechanical_kind === "shell") &&
    !!candidate.artifact_urls &&
    typeof candidate.artifact_urls === "object" &&
    Array.isArray(candidate.artifact_ids)
  );
}

function getCachedMechanicalResult(
  project: ProjectDocument | null,
): MechanicalCompileResult | null {
  if (!project) return null;
  const derived = project.derived?.mechanical;
  if (!derived || typeof derived !== "object") return null;
  const summary = (derived as Record<string, unknown>).summary;
  if (!isMechanicalCompileResult(summary)) return null;
  return summary.revision === project.revision ? summary : null;
}

function ArtifactLinks({
  artifactUrls,
  downloadingKey,
  onDownload,
}: {
  artifactUrls: Record<string, string>;
  downloadingKey: string | null;
  onDownload: (key: string, url: string) => void;
}) {
  return (
    <div className="space-y-2">
      {Object.entries(artifactUrls).map(([key, url]) => (
        <div
          key={key}
          className="glass-subcard flex items-center justify-between px-4 py-2.5 rounded-xl"
        >
          <span className="text-[12px] font-mono text-[var(--text-secondary)]">{key}</span>
          <button
            type="button"
            onClick={() => onDownload(key, url)}
            disabled={downloadingKey === key}
            className="text-[11px] font-medium px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:cursor-wait disabled:opacity-60"
          >
            {downloadingKey === key ? "Downloading..." : "Download"}
          </button>
        </div>
      ))}
    </div>
  );
}

export function MechanicalReviewPanel({
  onRecordsRefresh,
}: {
  onRecordsRefresh?: () => Promise<void>;
}) {
  const project = useProjectStore((s) => s.project);
  const dirty = useProjectStore((s) => s.dirty);
  const loadProject = useProjectStore((s) => s.loadProject);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MechanicalCompileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!project) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }

    const cached = getCachedMechanicalResult(project);
    if (cached) {
      setResult(cached);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const compile = async () => {
      setLoading(true);
      setError(null);
      try {
        const compiled = await api.geometry.compileMechanical(project.project_id);
        await loadProject(project.project_id);
        await onRecordsRefresh?.();
        if (!cancelled) setResult(compiled);
      } catch (e) {
        if (!cancelled) {
          setResult(null);
          setError(e instanceof Error ? e.message : "Mechanical compile failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void compile();
    return () => {
      cancelled = true;
    };
  }, [loadProject, onRecordsRefresh, project]);

  const handleRecompile = async () => {
    if (!project) return;
      setLoading(true);
      setError(null);
      try {
        const compiled = await api.geometry.compileMechanical(project.project_id);
        await loadProject(project.project_id);
        await onRecordsRefresh?.();
        setResult(compiled);
      } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Mechanical compile failed");
    } finally {
      setLoading(false);
    }
  };

  const handleArtifactDownload = async (key: string, url: string) => {
    const artifactName = url.split("/").pop() || `${key}.bin`;
    setDownloadingKey(key);
    setError(null);
    try {
      await api.geometry.downloadMechanicalArtifactUrl(url, artifactName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Artifact download failed");
    } finally {
      setDownloadingKey(null);
    }
  };

  if (!project) return null;

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="mb-1 text-[15px] font-semibold text-[var(--text-primary)]">
            Mechanical Review
          </h3>
          <p className="max-w-[44ch] text-[12px] leading-[1.6] text-[var(--text-secondary)]">
            Deterministic mechanical compile for the saved project revision. This
            stays family-aware: panel output for control surfaces, shell output for
            planned handheld proof families.
          </p>
        </div>
        <button
          onClick={handleRecompile}
          disabled={loading}
          className="surface-button h-9 shrink-0 rounded-xl px-4 text-[12px] font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? "Compiling..." : "Recompile"}
        </button>
      </div>

      {dirty && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/15 text-[12px] text-amber-300">
          Local layout changes are unsaved. Mechanical results reflect saved revision{" "}
          {project.revision}.
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/15 text-[12px] text-red-400">
          {error}
        </div>
      )}

      {!result && !loading && !error && (
        <div className="glass glass-soft rounded-xl px-4 py-3 text-[12px] text-[var(--text-secondary)]">
          Mechanical output has not been compiled yet.
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="glass-subcard rounded-xl px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                Revision
              </div>
              <div className="mt-1 text-[18px] font-mono text-[var(--text-primary)]">
                {result.revision}
              </div>
            </div>
            <div className="glass-subcard rounded-xl px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                Kind
              </div>
              <div className="mt-1 text-[13px] capitalize text-[var(--text-primary)]">
                {humanize(result.mechanical_kind)}
              </div>
            </div>
            <div className="glass-subcard rounded-xl px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                Status
              </div>
              <div className="text-[13px] text-emerald-400 mt-1 capitalize">
                {result.status}
              </div>
            </div>
            <div className="glass-subcard rounded-xl px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                Artifacts
              </div>
              <div className="mt-1 text-[13px] text-[var(--text-primary)]">
                {result.artifact_ids.length} durable outputs
              </div>
            </div>
          </div>

          <div className="glass-subcard rounded-xl px-4 py-3 text-[12px] text-[var(--text-secondary)]">
            Compiled at <span className="text-[var(--text-primary)]">{formatTimestamp(result.compiled_at)}</span>
          </div>

          {result.mechanical_kind === "panel" ? (
            <>
              <div className="glass glass-soft rounded-2xl p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  Panel Summary
                </div>
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-[var(--text-tertiary)]">Geometry</div>
                    <div className="mt-1 capitalize text-[var(--text-primary)]">
                      {humanize(result.geometry_kind)}
                    </div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-[var(--text-tertiary)]">Size</div>
                    <div className="mt-1 text-[var(--text-primary)]">
                      {result.plate_width_mm} × {result.plate_height_mm} mm
                    </div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-[var(--text-tertiary)]">Elements</div>
                    <div className="mt-1 text-[var(--text-primary)]">
                      {result.element_count} placed controls
                    </div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-[var(--text-tertiary)]">Mounting holes</div>
                    <div className="mt-1 text-[var(--text-primary)]">
                      {result.mounting_hole_count}
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass glass-soft rounded-2xl p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  Cutout Summary
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.cutout_summary).map(([key, count]) => (
                    <span
                      key={key}
                      className="glass-chip rounded-full px-3 py-1.5 text-[11px] text-[var(--text-secondary)]"
                    >
                      {humanize(key)}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="glass glass-soft rounded-2xl p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  Shell Summary
                </div>
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-[var(--text-tertiary)]">Shell kind</div>
                    <div className="mt-1 capitalize text-[var(--text-primary)]">
                      {humanize(result.shell_kind)}
                    </div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-[var(--text-tertiary)]">Outer shell</div>
                    <div className="mt-1 text-[var(--text-primary)]">
                      {result.outer_shell.width_mm} × {result.outer_shell.height_mm} mm
                    </div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-[var(--text-tertiary)]">Front features</div>
                    <div className="mt-1 text-[var(--text-primary)]">{result.front_features.length}</div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-[var(--text-tertiary)]">Rear features</div>
                    <div className="mt-1 text-[var(--text-primary)]">{result.rear_features.length}</div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-[var(--text-tertiary)]">Side ports</div>
                    <div className="mt-1 text-[var(--text-primary)]">{result.side_ports.length}</div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-[var(--text-tertiary)]">Mounting holes</div>
                    <div className="mt-1 text-[var(--text-primary)]">{result.mounting_holes.length}</div>
                  </div>
                </div>
              </div>

              <div className="glass glass-soft rounded-2xl p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  Control Summary
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.control_summary).map(([key, count]) => (
                    <span
                      key={key}
                      className="glass-chip rounded-full px-3 py-1.5 text-[11px] text-[var(--text-secondary)]"
                    >
                      {humanize(key)}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="glass glass-soft rounded-2xl p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              Mechanical Artifacts
            </div>
            <ArtifactLinks
              artifactUrls={result.artifact_urls}
              downloadingKey={downloadingKey}
              onDownload={handleArtifactDownload}
            />
          </div>
        </div>
      )}
    </div>
  );
}
