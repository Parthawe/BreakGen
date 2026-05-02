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
      return "text-emerald-400";
    case "exported":
      return "text-indigo-400";
    case "warn":
    case "generating":
    case "submitted":
      return "text-amber-400";
    case "failed":
    case "fail":
      return "text-red-400";
    default:
      return "text-zinc-500";
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
    case "production_ready":
      return "text-indigo-300 bg-indigo-500/10 border-indigo-500/20";
    case "rejected":
      return "text-red-300 bg-red-500/10 border-red-500/20";
    case "candidate":
      return "text-amber-300 bg-amber-500/10 border-amber-500/20";
    case "preview_only":
      return "text-zinc-400 bg-white/[0.04] border-white/[0.08]";
    default:
      return "text-zinc-500 bg-white/[0.03] border-white/[0.04]";
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass glass-soft rounded-xl">
      <div className="px-3.5 py-2.5 glass-divider border-b text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600">
        {title}
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
          <div className="text-[12px] text-zinc-500 leading-[1.6]">
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

  return (
    <div className="px-3 pb-3 space-y-3">
      <Section title="Overview">
        <div className="space-y-3">
          <div>
            <div className="text-[13px] font-medium text-white truncate">{project.name}</div>
            <div className="text-[11px] text-zinc-500 leading-[1.5] mt-1">
              {familyManifest?.description ?? "Programmable input hardware project"}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="glass-subcard rounded-lg px-3 py-2">
              <div className="text-zinc-600">Domain</div>
              <div className="text-zinc-300 mt-1 capitalize">
                {project.product_domain.replace(/_/g, " ")}
              </div>
            </div>
            <div className="glass-subcard rounded-lg px-3 py-2">
              <div className="text-zinc-600">Family</div>
              <div className="text-zinc-300 mt-1 capitalize">{project.product_family}</div>
            </div>
            <div className="glass-subcard rounded-lg px-3 py-2">
              <div className="text-zinc-600">Revision</div>
              <div className="text-zinc-300 mt-1 font-mono">r{project.revision}</div>
            </div>
            <div className="glass-subcard rounded-lg px-3 py-2">
              <div className="text-zinc-600">Controls</div>
              <div className="text-zinc-300 mt-1">{elementCount}</div>
            </div>
            <div className="glass-subcard rounded-lg px-3 py-2">
              <div className="text-zinc-600">Accepted Assets</div>
              <div className="text-zinc-300 mt-1">{acceptedAssets.length}</div>
            </div>
            <div className="glass-subcard rounded-lg px-3 py-2">
              <div className="text-zinc-600">Status</div>
              <div className={`mt-1 capitalize ${statusTone(project.status)}`}>{project.status}</div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Providers">
        <div className="space-y-2">
          {liveProviders.slice(0, 3).map((provider) => (
            <div key={provider.id} className="glass-subcard rounded-lg px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-zinc-300">{provider.display_name}</span>
                <span className={`text-[10px] uppercase tracking-[0.08em] ${statusTone(provider.status)}`}>
                  {provider.status}
                </span>
              </div>
              <div className="text-[11px] text-zinc-600 mt-1 line-clamp-2">{provider.description}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Assets">
        <div className="space-y-2">
          {project.keycap_assets.length === 0 ? (
            <div className="text-[12px] text-zinc-600">No project assets yet.</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.08em] text-zinc-600">
                <div className="glass-subcard rounded-lg px-3 py-2">
                  Review
                  <div className="text-zinc-300 text-[12px] mt-1 normal-case">{reviewAssets.length}</div>
                </div>
                <div className="glass-subcard rounded-lg px-3 py-2">
                  Accepted
                  <div className="text-zinc-300 text-[12px] mt-1 normal-case">{acceptedAssets.length}</div>
                </div>
                <div className="glass-subcard rounded-lg px-3 py-2">
                  Rejected
                  <div className="text-zinc-300 text-[12px] mt-1 normal-case">{rejectedAssets.length}</div>
                </div>
              </div>
              {project.keycap_assets.slice(0, 4).map((asset) => (
              <div key={asset.asset_id} className="glass-subcard rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-zinc-300 truncate">
                    {asset.prompt ?? asset.asset_id}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full border text-[10px] uppercase tracking-[0.08em] ${acceptanceTone(asset.acceptance_state)}`}
                  >
                    {acceptanceLabel(asset.acceptance_state)}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-600 mt-1">
                  {asset.provider ?? "local"} • {asset.normalized ? "normalized" : "raw"}
                </div>
              </div>
              ))}
            </>
          )}
        </div>
      </Section>

      <Section title="Mechanical">
        <div className="space-y-2">
          {mechanicalSummary ? (
            <>
              <div className="glass-subcard rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-zinc-300 capitalize">
                    {mechanicalSummary.mechanical_kind.replace(/_/g, " ")} compile
                  </span>
                  <span className="text-[10px] font-mono text-zinc-600">
                    r{mechanicalSummary.revision}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-600 mt-1">
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
                      <span className="text-[12px] text-zinc-300">{lineageLabel(artifact)}</span>
                      <span
                        className={`px-2 py-1 rounded-full border text-[10px] uppercase tracking-[0.08em] ${acceptanceTone(artifact.acceptance_state)}`}
                      >
                        {acceptanceLabel(artifact.acceptance_state)}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-600 mt-1">
                      {formatTime(artifact.created_at)}
                    </div>
                  </div>
                ))}
            </>
          ) : (
            <div className="text-[12px] text-zinc-600">
              Mechanical compile has not been recorded for the current revision.
            </div>
          )}
        </div>
      </Section>

      <Section title="Jobs">
        <div className="space-y-2">
          {loading ? (
            <div className="text-[12px] text-zinc-600">Loading records…</div>
          ) : records?.jobs.length ? (
            records.jobs.slice(0, 4).map((job) => (
              <div key={job.job_id} className="glass-subcard rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-zinc-300">
                    {job.job_type.replace(/_/g, " ")}
                  </span>
                  <span className={`text-[10px] uppercase tracking-[0.08em] ${statusTone(job.status)}`}>
                    {job.status}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-600 mt-1">
                  {(job.provider ?? "system").replace(/_/g, " ")} • {formatTime(job.updated_at)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-[12px] text-zinc-600">No jobs recorded yet.</div>
          )}
        </div>
      </Section>

      <Section title="Validation">
        <div className="space-y-2">
          {records?.latest_validation_report ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-zinc-300">Latest report</span>
                <span className={`text-[10px] uppercase tracking-[0.08em] ${statusTone(records.latest_validation_report.status)}`}>
                  {records.latest_validation_report.status}
                </span>
              </div>
              <div className="text-[11px] text-zinc-600">
                revision r{records.latest_validation_report.revision} •{" "}
                {formatTime(records.latest_validation_report.created_at)}
              </div>
              {staleValidation && (
                <div className="glass-subcard rounded-lg px-3 py-2 text-[11px] text-amber-300">
                  Current project is at revision r{project.revision}. Run validation again to refresh this report.
                </div>
              )}
              {issues.length === 0 ? (
                <div className="text-[12px] text-zinc-600">No open validation issues.</div>
              ) : (
                issues.slice(0, 3).map((issue) => (
                  <div key={issue.id} className="glass-subcard rounded-lg px-3 py-2">
                    <div className="text-[12px] text-zinc-300">{issue.id}</div>
                    <div className={`text-[11px] mt-1 ${statusTone(issue.status)}`}>{issue.details}</div>
                  </div>
                ))
              )}
            </>
          ) : (
            <div className="text-[12px] text-zinc-600">Validation has not been run yet.</div>
          )}
        </div>
      </Section>

      <Section title="Export">
        <div className="space-y-2">
          {records?.latest_export ? (
            <div className="glass-subcard rounded-lg px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-zinc-300">{lineageLabel(records.latest_export)}</span>
                <span className={`text-[10px] uppercase tracking-[0.08em] ${acceptanceTone(records.latest_export.acceptance_state)}`}>
                  {acceptanceLabel(records.latest_export.acceptance_state)}
                </span>
              </div>
              <div className="text-[11px] text-zinc-600 mt-1">
                {(records.latest_export.producer_id ?? "export_bundler").replace(/_/g, " ")} •{" "}
                {formatTime(records.latest_export.created_at)}
              </div>
            </div>
          ) : (
            <div className="text-[12px] text-zinc-600">No export bundle has been recorded yet.</div>
          )}
        </div>
      </Section>

      <Section title="History">
        <div className="space-y-2">
          {records?.artifacts.length ? (
            records.artifacts.slice(0, 5).map((artifact) => (
              <div key={artifact.artifact_id} className="glass-subcard rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-zinc-300">{lineageLabel(artifact)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-600">r{artifact.source_revision}</span>
                    <span
                      className={`px-2 py-1 rounded-full border text-[10px] uppercase tracking-[0.08em] ${acceptanceTone(artifact.acceptance_state)}`}
                    >
                      {acceptanceLabel(artifact.acceptance_state)}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-zinc-600 mt-1">
                  {(artifact.producer_id ?? artifact.producer_kind ?? "system").replace(/_/g, " ")} • {formatTime(artifact.created_at)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-[12px] text-zinc-600">Artifacts appear here as the project compiles and exports.</div>
          )}
        </div>
      </Section>
    </div>
  );
}
