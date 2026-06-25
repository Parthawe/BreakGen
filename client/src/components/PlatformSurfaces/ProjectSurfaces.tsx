import type {
  AcceptanceState,
  ArtifactRecord,
  GenerationProviderManifest,
  KeyboardProject,
  MechanicalCompileResult,
  ProductFamilyManifest,
  ProjectRecords,
} from "../../types/project";

function statusTone(status: string): string {
  switch (status) {
    case "validated":
    case "pass":
    case "completed":
    case "succeeded":
      return "text-emerald-500 dark:text-emerald-400";
    case "exported":
      return "text-indigo-600 dark:text-indigo-400";
    case "warn":
    case "generating":
    case "submitted":
      return "text-amber-600 dark:text-amber-400";
    case "failed":
    case "fail":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-[var(--text-tertiary)]";
  }
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "just now";
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

function lineageLabel(item: ArtifactRecord): string {
  return item.artifact_role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function acceptanceTone(state: AcceptanceState | null): string {
  switch (state) {
    case "accepted":
      return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
    case "review_ready":
      return "text-sky-300 bg-sky-500/10 border-sky-500/20";
    case "production_ready":
      return "text-indigo-300 bg-indigo-500/10 border-indigo-500/20";
    case "rejected":
      return "text-red-300 bg-red-500/10 border-red-500/20";
    case "candidate":
      return "text-amber-300 bg-amber-500/10 border-amber-500/20";
    case "preview_only":
      return "text-[var(--text-secondary)] bg-[var(--surface-chip)] border-[var(--border-default)]";
    default:
      return "text-[var(--text-tertiary)] bg-[var(--surface-chip)] border-[var(--border-subtle)]";
  }
}

function acceptanceLabel(state: AcceptanceState | null): string {
  if (!state) return "untracked";
  return state.replace(/_/g, " ");
}

function isMechanicalSummary(value: unknown): value is MechanicalCompileResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.project_id === "string" &&
    typeof candidate.revision === "number" &&
    (candidate.mechanical_kind === "panel" || candidate.mechanical_kind === "shell") &&
    Array.isArray(candidate.artifact_ids)
  );
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-panel rounded-xl">
      <div className="glass-divider border-b px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
        <div className="flex items-center justify-between gap-2">
          <span>{title}</span>
          {eyebrow && <span className="text-[9px] text-[var(--text-muted)]">{eyebrow}</span>}
        </div>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

export function ProjectSurfaces({
  project,
  familyManifest,
  providers,
  records,
  loading,
}: {
  project: KeyboardProject | null;
  familyManifest: ProductFamilyManifest | null;
  providers: GenerationProviderManifest[];
  records: ProjectRecords | null;
  loading: boolean;
}) {
  if (!project) {
    return (
      <div className="px-3 pb-3">
        <Section title="Platform">
          <div className="text-[12px] leading-[1.6] text-[var(--text-secondary)]">
            Projects share revisions, artifacts, jobs, validation, and export history.
          </div>
        </Section>
      </div>
    );
  }

  const liveProviders = providers.filter((provider) => provider.status !== "planned");
  const issues =
    records?.latest_validation_report?.checks?.filter((check) => check.status !== "pass") ?? [];
  const elementCount = project.layout.elements.length || project.layout.keys.length;
  const acceptedAssets = project.keycap_assets.filter(
    (asset) =>
      asset.acceptance_state === "accepted" ||
      asset.acceptance_state === "production_ready",
  );
  const reviewAssets = project.keycap_assets.filter(
    (asset) =>
      asset.acceptance_state === "candidate" ||
      asset.acceptance_state === "preview_only",
  );
  const rejectedAssets = project.keycap_assets.filter(
    (asset) => asset.acceptance_state === "rejected",
  );
  const mechanicalSummary = isMechanicalSummary(
    (project.derived?.mechanical as Record<string, unknown> | undefined)?.summary,
  )
    ? (project.derived.mechanical as { summary: MechanicalCompileResult }).summary
    : null;
  const staleValidation =
    records?.latest_validation_report &&
    records.latest_validation_report.revision !== project.revision
      ? records.latest_validation_report
      : null;
  const latestValidation = records?.latest_validation_report ?? null;
  const currentRevisionValidated = latestValidation?.revision === project.revision;
  const latestExport = records?.latest_export ?? null;
  const currentRevisionExported = latestExport?.source_revision === project.revision;
  const activeJobs = records?.jobs.filter((job) => !["completed", "succeeded", "failed"].includes(job.status)) ?? [];
  const alphaPath = [
    {
      key: "define",
      label: "Define baseline",
      complete:
        elementCount > 0 &&
        (project.product_family === "gamepad" || !!project.switch_profile.part_id),
      details: project.template ? `Template ${project.template}` : "Project created",
    },
    {
      key: "layout",
      label: "Edit layout",
      complete: elementCount > 0,
      details: `${elementCount} controls placed`,
    },
    {
      key: "appearance",
      label: "Accept assets",
      complete: acceptedAssets.length > 0,
      details:
        acceptedAssets.length > 0
          ? `${acceptedAssets.length} canonical appearance asset${acceptedAssets.length === 1 ? "" : "s"}`
          : "No accepted canonical assets",
    },
    {
      key: "electronics",
      label: "Compile electronics",
      complete: !!project.derived?.electronics,
      details:
        project.derived?.electronics
          ? "Electronics summary recorded"
          : "Compile matrix or direct-pin plan",
    },
    {
      key: "validate",
      label: "Validate revision",
      complete: currentRevisionValidated,
      details: currentRevisionValidated
        ? `Validated at r${project.revision}`
        : latestValidation
          ? `Latest validation is still at r${latestValidation.revision}`
          : "No validation report yet",
    },
    {
      key: "export",
      label: "Export bundle",
      complete: currentRevisionExported,
      details: currentRevisionExported
        ? `Bundle recorded for r${project.revision}`
        : latestExport
          ? `Latest bundle was cut from r${latestExport.source_revision}`
          : "No bundle recorded yet",
    },
  ];

  return (
    <div className="px-3 pb-3 space-y-3">
      <Section title="Overview" eyebrow="alpha scope">
        <div className="space-y-3">
          <div>
            <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">{project.name}</div>
            <div className="mt-1 text-[11px] leading-[1.5] text-[var(--text-secondary)]">
              {familyManifest?.description ?? "Programmable input hardware project"}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="glass-subcard rounded-lg px-3 py-2">
              <div className="text-[var(--text-tertiary)]">Domain</div>
              <div className="mt-1 capitalize text-[var(--text-primary)]">
                {project.product_domain.replace(/_/g, " ")}
              </div>
            </div>
            <div className="glass-subcard rounded-lg px-3 py-2">
              <div className="text-[var(--text-tertiary)]">Family</div>
              <div className="mt-1 capitalize text-[var(--text-primary)]">{project.product_family}</div>
            </div>
            <div className="glass-subcard rounded-lg px-3 py-2">
              <div className="text-[var(--text-tertiary)]">Revision</div>
              <div className="mt-1 font-mono text-[var(--text-primary)]">r{project.revision}</div>
            </div>
            <div className="glass-subcard rounded-lg px-3 py-2">
              <div className="text-[var(--text-tertiary)]">Controls</div>
              <div className="mt-1 text-[var(--text-primary)]">{elementCount}</div>
            </div>
            <div className="glass-subcard rounded-lg px-3 py-2">
              <div className="text-[var(--text-tertiary)]">Accepted Assets</div>
              <div className="mt-1 text-[var(--text-primary)]">{acceptedAssets.length}</div>
            </div>
            <div className="glass-subcard rounded-lg px-3 py-2">
              <div className="text-[var(--text-tertiary)]">Status</div>
              <div className={`mt-1 capitalize ${statusTone(project.status)}`}>{project.status}</div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Alpha Path" eyebrow="source of truth">
        <div className="space-y-2">
          {alphaPath.map((step) => (
            <div key={step.key} className="glass-subcard rounded-lg px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-[var(--text-primary)]">{step.label}</span>
                <span
                  className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.08em] ${
                    step.complete
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                      : "border-[var(--border-default)] bg-[var(--surface-chip)] text-[var(--text-tertiary)]"
                  }`}
                >
                  {step.complete ? "complete" : "pending"}
                </span>
              </div>
              <div className="mt-1 text-[11px] leading-[1.55] text-[var(--text-tertiary)]">
                {step.details}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Providers" eyebrow="enabled only">
        <div className="space-y-2">
          {liveProviders.slice(0, 3).map((provider) => (
            <div key={provider.id} className="glass-subcard rounded-lg px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-[var(--text-primary)]">{provider.display_name}</span>
                <span className={`text-[10px] uppercase tracking-[0.08em] ${statusTone(provider.status)}`}>
                  {provider.status}
                </span>
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] text-[var(--text-tertiary)]">{provider.description}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Assets" eyebrow="acceptance state">
        <div className="space-y-2">
          {project.keycap_assets.length === 0 ? (
            <div className="text-[12px] text-[var(--text-tertiary)]">No project assets yet.</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                <div className="glass-subcard rounded-lg px-3 py-2">
                  Review
                  <div className="mt-1 text-[12px] normal-case text-[var(--text-primary)]">{reviewAssets.length}</div>
                </div>
                <div className="glass-subcard rounded-lg px-3 py-2">
                  Accepted
                  <div className="mt-1 text-[12px] normal-case text-[var(--text-primary)]">{acceptedAssets.length}</div>
                </div>
                <div className="glass-subcard rounded-lg px-3 py-2">
                  Rejected
                  <div className="mt-1 text-[12px] normal-case text-[var(--text-primary)]">{rejectedAssets.length}</div>
                </div>
              </div>
              {project.keycap_assets.slice(0, 4).map((asset) => (
              <div key={asset.asset_id} className="glass-subcard rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] text-[var(--text-primary)]">
                    {asset.prompt ?? asset.asset_id}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full border text-[10px] uppercase tracking-[0.08em] ${acceptanceTone(asset.acceptance_state)}`}
                  >
                    {acceptanceLabel(asset.acceptance_state)}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                  {asset.provider ?? "local"} • {asset.normalized ? "normalized" : "raw"}
                </div>
              </div>
              ))}
            </>
          )}
        </div>
      </Section>

      <Section title="Mechanical" eyebrow="current revision">
        <div className="space-y-2">
          {mechanicalSummary ? (
            <>
              <div className="glass-subcard rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] capitalize text-[var(--text-primary)]">
                    {mechanicalSummary.mechanical_kind.replace(/_/g, " ")} compile
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                    r{mechanicalSummary.revision}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                  {mechanicalSummary.artifact_ids.length} durable artifact
                  {mechanicalSummary.artifact_ids.length === 1 ? "" : "s"} •{" "}
                  {formatTime(mechanicalSummary.compiled_at)}
                </div>
              </div>
              {records?.artifacts
                .filter((artifact) => artifact.kind.startsWith("mechanical_"))
                .slice(0, 3)
                .map((artifact) => (
                  <div key={artifact.artifact_id} className="glass-subcard rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] text-[var(--text-primary)]">{lineageLabel(artifact)}</span>
                      <span
                        className={`px-2 py-1 rounded-full border text-[10px] uppercase tracking-[0.08em] ${acceptanceTone(artifact.acceptance_state)}`}
                      >
                        {acceptanceLabel(artifact.acceptance_state)}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                      {formatTime(artifact.created_at)}
                    </div>
                  </div>
                ))}
            </>
          ) : (
            <div className="text-[12px] text-[var(--text-tertiary)]">
              Mechanical compile has not been recorded for the current revision.
            </div>
          )}
        </div>
      </Section>

      <Section title="Jobs" eyebrow={activeJobs.length ? `${activeJobs.length} active` : "idle"}>
        <div className="space-y-2">
          {loading ? (
            <div className="text-[12px] text-[var(--text-tertiary)]">Loading records…</div>
          ) : records?.jobs.length ? (
            records.jobs.slice(0, 4).map((job) => (
              <div key={job.job_id} className="glass-subcard rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-[var(--text-primary)]">
                    {job.job_type.replace(/_/g, " ")}
                  </span>
                  <span className={`text-[10px] uppercase tracking-[0.08em] ${statusTone(job.status)}`}>
                    {job.status}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                  {(job.provider ?? "system").replace(/_/g, " ")} • {formatTime(job.updated_at)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-[12px] text-[var(--text-tertiary)]">No jobs recorded yet.</div>
          )}
        </div>
      </Section>

      <Section title="Validation" eyebrow={currentRevisionValidated ? "fresh" : "stale or missing"}>
        <div className="space-y-2">
          {records?.latest_validation_report ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-[var(--text-primary)]">Latest report</span>
                <span className={`text-[10px] uppercase tracking-[0.08em] ${statusTone(records.latest_validation_report.status)}`}>
                  {records.latest_validation_report.status}
                </span>
              </div>
              <div className="text-[11px] text-[var(--text-tertiary)]">
                revision r{records.latest_validation_report.revision} •{" "}
                {formatTime(records.latest_validation_report.created_at)}
              </div>
              {staleValidation && (
                <div className="glass-subcard rounded-lg px-3 py-2 text-[11px] text-amber-300">
                  Current project is at revision r{project.revision}. Run validation again to refresh this report.
                </div>
              )}
              {issues.length === 0 ? (
                <div className="text-[12px] text-[var(--text-tertiary)]">No open validation issues.</div>
              ) : (
                issues.slice(0, 3).map((issue) => (
                  <div key={issue.id} className="glass-subcard rounded-lg px-3 py-2">
                    <div className="text-[12px] text-[var(--text-primary)]">{issue.id}</div>
                    <div className={`text-[11px] mt-1 ${statusTone(issue.status)}`}>{issue.details}</div>
                  </div>
                ))
              )}
            </>
          ) : (
            <div className="text-[12px] text-[var(--text-tertiary)]">Validation has not been run yet.</div>
          )}
        </div>
      </Section>

      <Section title="Export" eyebrow={currentRevisionExported ? "current revision" : "review carefully"}>
        <div className="space-y-2">
          {records?.latest_export ? (
            <div className="glass-subcard rounded-lg px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-[var(--text-primary)]">{lineageLabel(records.latest_export)}</span>
                <span className={`text-[10px] uppercase tracking-[0.08em] ${acceptanceTone(records.latest_export.acceptance_state)}`}>
                  {acceptanceLabel(records.latest_export.acceptance_state)}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                {(records.latest_export.producer_id ?? "export_bundler").replace(/_/g, " ")} •{" "}
                {formatTime(records.latest_export.created_at)}
              </div>
              {!currentRevisionExported && (
                <div className="mt-2 text-[11px] leading-[1.5] text-amber-600 dark:text-amber-300">
                  This bundle does not match the current project revision r{project.revision}. Re-run validation and export before treating it as current.
                </div>
              )}
            </div>
          ) : (
            <div className="text-[12px] text-[var(--text-tertiary)]">No export bundle has been recorded yet.</div>
          )}
        </div>
      </Section>

      <Section title="History" eyebrow="durable artifacts">
        <div className="space-y-2">
          {records?.artifacts.length ? (
            records.artifacts.slice(0, 5).map((artifact) => (
              <div key={artifact.artifact_id} className="glass-subcard rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-[var(--text-primary)]">{lineageLabel(artifact)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[var(--text-tertiary)]">r{artifact.source_revision}</span>
                    <span
                      className={`px-2 py-1 rounded-full border text-[10px] uppercase tracking-[0.08em] ${acceptanceTone(artifact.acceptance_state)}`}
                    >
                      {acceptanceLabel(artifact.acceptance_state)}
                    </span>
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                  {(artifact.producer_id ?? artifact.producer_kind ?? "system").replace(/_/g, " ")} • {formatTime(artifact.created_at)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-[12px] text-[var(--text-tertiary)]">Artifacts appear here as the project compiles and exports.</div>
          )}
        </div>
      </Section>
    </div>
  );
}
