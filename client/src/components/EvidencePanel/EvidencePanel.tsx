import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { EvidenceArtifact, EvidenceEvent, ProjectEvidence } from "../../types/project";

function formatTime(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function humanize(value: string): string {
  return value.replace(/_/g, " ");
}

function readinessTone(value: string): string {
  switch (value) {
    case "current":
    case "pass":
    case "validated":
    case "completed":
    case "production_ready":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400";
    case "review_ready":
    case "warn":
    case "candidate":
    case "submitted":
      return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "fail":
    case "failed":
    case "blocked":
    case "rejected":
      return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "border-[var(--border-default)] bg-[var(--surface-chip)] text-[var(--text-tertiary)]";
  }
}

function ArtifactRow({
  artifact,
  projectId,
}: {
  artifact: EvidenceArtifact;
  projectId: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      await api.records.downloadArtifact(
        projectId,
        artifact.artifact_id,
        artifact.file_name ?? `${artifact.artifact_id}.bin`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Artifact download failed.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="glass-subcard rounded-lg px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[12px] text-[var(--text-primary)]">
            {humanize(artifact.artifact_role)}
          </div>
          <div className="mt-1 truncate font-mono text-[10px] text-[var(--text-tertiary)]">
            {artifact.artifact_id}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-[10px] text-[var(--text-secondary)]">
            {artifact.short_sha256 ?? "no hash"}
          </div>
          <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">r{artifact.source_revision}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void download()}
        disabled={downloading}
        className="mt-2 inline-flex min-h-8 items-center rounded-md border border-[var(--border-subtle)] px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-default)] hover:text-[var(--text-primary)] disabled:cursor-wait disabled:opacity-60"
      >
        {downloading ? "Downloading" : "Download artifact"}
      </button>
      {error && <div className="mt-2 text-[11px] leading-[1.5] text-red-500 dark:text-red-400">{error}</div>}
    </div>
  );
}

function EvidenceEventCard({
  event,
  projectId,
  missingOutputs,
}: {
  event: EvidenceEvent;
  projectId: string;
  missingOutputs: string[];
}) {
  const isExport = event.event_type === "export_bundle";
  return (
    <div className="glass-subcard rounded-xl px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-[var(--text-primary)]">{event.title}</div>
          <div className="mt-1 text-[11px] leading-[1.5] text-[var(--text-tertiary)]">
            r{event.revision} - {formatTime(event.created_at)}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.08em] ${readinessTone(event.readiness)}`}
        >
          {humanize(event.readiness)}
        </span>
      </div>
      <div className="mt-2 text-[12px] leading-[1.55] text-[var(--text-secondary)]">
        {event.summary}
      </div>
      {event.validation_report && (
        <div className="mt-2 text-[11px] leading-[1.5] text-[var(--text-tertiary)]">
          {event.validation_report.checks.length} validation checks recorded.
        </div>
      )}
      {event.artifacts.length > 0 && (
        <div className="mt-3 space-y-2">
          {event.artifacts.map((artifact) => (
            <ArtifactRow key={artifact.artifact_id} artifact={artifact} projectId={projectId} />
          ))}
        </div>
      )}
      {isExport && missingOutputs.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/15 bg-amber-500/8 px-3 py-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-600 dark:text-amber-300">
            Not fabrication complete
          </div>
          <div className="space-y-1">
            {missingOutputs.slice(0, 3).map((item) => (
              <div key={item} className="text-[11px] leading-[1.45] text-[var(--text-secondary)]">
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function EvidencePanel({ projectId }: { projectId: string }) {
  const [evidence, setEvidence] = useState<ProjectEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.records
      .evidence(projectId)
      .then((payload) => {
        if (!active) return;
        setEvidence(payload);
      })
      .catch((err) => {
        if (!active) return;
        setEvidence(null);
        setError(err instanceof Error ? err.message : "Evidence unavailable.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  return (
    <div className="space-y-2">
      {loading && (
        <div className="text-[12px] text-[var(--text-tertiary)]">Loading evidence ledger...</div>
      )}
      {error && (
        <div className="glass-danger rounded-lg px-3 py-2 text-[11px] leading-[1.5]">
          {error}
        </div>
      )}
      {!loading && !error && evidence?.events.length === 0 && (
        <div className="text-[12px] leading-[1.6] text-[var(--text-tertiary)]">
          Evidence appears after revisions, compiles, validations, and exports.
        </div>
      )}
      {evidence?.events.slice(0, 6).map((event) => (
        <EvidenceEventCard
          key={event.event_id}
          event={event}
          projectId={projectId}
          missingOutputs={evidence.missing_outputs}
        />
      ))}
    </div>
  );
}
