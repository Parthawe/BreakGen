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
}: {
  artifactUrls: Record<string, string>;
}) {
  return (
    <div className="space-y-2">
      {Object.entries(artifactUrls).map(([key, url]) => (
        <div
          key={key}
          className="glass-subcard flex items-center justify-between px-4 py-2.5 rounded-xl"
        >
          <span className="text-[12px] font-mono text-zinc-400">{key}</span>
          <a
            href={url}
            download
            className="text-[11px] font-medium px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
          >
            Download
          </a>
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

  if (!project) return null;

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-[15px] font-semibold text-white mb-1">
            Mechanical Review
          </h3>
          <p className="text-[12px] text-zinc-500 leading-[1.6] max-w-[44ch]">
            Deterministic mechanical compile for the saved project revision. This
            stays family-aware: panel output for control surfaces, shell output for
            planned handheld proof families.
          </p>
        </div>
        <button
          onClick={handleRecompile}
          disabled={loading}
          className="glass-button shrink-0 h-9 px-4 text-[12px] font-medium rounded-xl text-zinc-300 hover:text-white disabled:opacity-50 transition-colors"
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
        <div className="glass glass-soft px-4 py-3 rounded-xl text-[12px] text-zinc-500">
          Mechanical output has not been compiled yet.
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="glass-subcard rounded-xl px-4 py-3">
              <div className="text-[11px] text-zinc-600 uppercase tracking-[0.08em]">
                Revision
              </div>
              <div className="text-[18px] font-mono text-white mt-1">
                {result.revision}
              </div>
            </div>
            <div className="glass-subcard rounded-xl px-4 py-3">
              <div className="text-[11px] text-zinc-600 uppercase tracking-[0.08em]">
                Kind
              </div>
              <div className="text-[13px] text-zinc-300 mt-1 capitalize">
                {humanize(result.mechanical_kind)}
              </div>
            </div>
            <div className="glass-subcard rounded-xl px-4 py-3">
              <div className="text-[11px] text-zinc-600 uppercase tracking-[0.08em]">
                Status
              </div>
              <div className="text-[13px] text-emerald-400 mt-1 capitalize">
                {result.status}
              </div>
            </div>
            <div className="glass-subcard rounded-xl px-4 py-3">
              <div className="text-[11px] text-zinc-600 uppercase tracking-[0.08em]">
                Artifacts
              </div>
              <div className="text-[13px] text-zinc-300 mt-1">
                {result.artifact_ids.length} durable outputs
              </div>
            </div>
          </div>

          <div className="glass-subcard rounded-xl px-4 py-3 text-[12px] text-zinc-400">
            Compiled at <span className="text-zinc-200">{formatTimestamp(result.compiled_at)}</span>
          </div>

          {result.mechanical_kind === "panel" ? (
            <>
              <div className="glass glass-soft rounded-2xl p-4">
                <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-3">
                  Panel Summary
                </div>
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-zinc-600">Geometry</div>
                    <div className="text-zinc-300 mt-1 capitalize">
                      {humanize(result.geometry_kind)}
                    </div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-zinc-600">Size</div>
                    <div className="text-zinc-300 mt-1">
                      {result.plate_width_mm} × {result.plate_height_mm} mm
                    </div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-zinc-600">Elements</div>
                    <div className="text-zinc-300 mt-1">
                      {result.element_count} placed controls
                    </div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-zinc-600">Mounting holes</div>
                    <div className="text-zinc-300 mt-1">
                      {result.mounting_hole_count}
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass glass-soft rounded-2xl p-4">
                <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-3">
                  Cutout Summary
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.cutout_summary).map(([key, count]) => (
                    <span
                      key={key}
                      className="glass-chip px-3 py-1.5 rounded-full text-[11px] text-zinc-400"
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
                <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-3">
                  Shell Summary
                </div>
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-zinc-600">Shell kind</div>
                    <div className="text-zinc-300 mt-1 capitalize">
                      {humanize(result.shell_kind)}
                    </div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-zinc-600">Outer shell</div>
                    <div className="text-zinc-300 mt-1">
                      {result.outer_shell.width_mm} × {result.outer_shell.height_mm} mm
                    </div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-zinc-600">Front features</div>
                    <div className="text-zinc-300 mt-1">{result.front_features.length}</div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-zinc-600">Rear features</div>
                    <div className="text-zinc-300 mt-1">{result.rear_features.length}</div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-zinc-600">Side ports</div>
                    <div className="text-zinc-300 mt-1">{result.side_ports.length}</div>
                  </div>
                  <div className="glass-subcard rounded-xl px-4 py-3">
                    <div className="text-zinc-600">Mounting holes</div>
                    <div className="text-zinc-300 mt-1">{result.mounting_holes.length}</div>
                  </div>
                </div>
              </div>

              <div className="glass glass-soft rounded-2xl p-4">
                <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-3">
                  Control Summary
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.control_summary).map(([key, count]) => (
                    <span
                      key={key}
                      className="glass-chip px-3 py-1.5 rounded-full text-[11px] text-zinc-400"
                    >
                      {humanize(key)}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="glass glass-soft rounded-2xl p-4">
            <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-3">
              Mechanical Artifacts
            </div>
            <ArtifactLinks artifactUrls={result.artifact_urls} />
          </div>
        </div>
      )}
    </div>
  );
}
