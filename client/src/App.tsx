import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { api, isApiError } from "./lib/api";
import { countLayoutElements } from "./lib/projectCompat";
import { useAuthStore } from "./stores/authStore";
import { useProjectStore } from "./stores/projectStore";
import type {
  GenerationProviderManifest,
  KeyboardProject,
  ProductDomainManifest,
  ProductFamilyManifest,
  QualityGateSummary,
  ProjectRecords,
  WorkspaceStageManifest,
} from "./types/project";
import { ProjectSurfaces } from "./components/PlatformSurfaces";

type StageId = "define" | "layout" | "appearance" | "electronics" | "validate" | "export";

const fallbackStages: WorkspaceStageManifest[] = [
  { id: "define", label: "Define", description: "Choose a template and hardware baseline.", requires_project: false, modules: ["template_selector", "switch_explorer"], preview_mode: "3d" },
  { id: "layout", label: "Layout", description: "Edit layout positions and spacing.", requires_project: true, modules: ["layout_editor"], preview_mode: "3d" },
  { id: "appearance", label: "Appearance", description: "Generate and assign visible assets.", requires_project: true, modules: ["keycap_styler"], preview_mode: "3d" },
  { id: "electronics", label: "Electronics", description: "Compile electronics and firmware.", requires_project: true, modules: ["pcb_panel"], preview_mode: "3d" },
  { id: "validate", label: "Validate", description: "Run project checks before export.", requires_project: true, modules: ["export_panel"], preview_mode: "3d" },
  { id: "export", label: "Export", description: "Package build artifacts.", requires_project: true, modules: ["export_panel"], preview_mode: "3d" },
];

const LazyTemplateSelector = lazy(async () => ({
  default: (await import("./components/TemplateSelector")).TemplateSelector,
}));
const LazyLayoutEditor = lazy(async () => ({
  default: (await import("./components/LayoutEditor")).LayoutEditor,
}));
const LazySwitchExplorer = lazy(async () => ({
  default: (await import("./components/SwitchExplorer")).SwitchExplorer,
}));
const LazyKeycapStyler = lazy(async () => ({
  default: (await import("./components/KeycapStyler")).KeycapStyler,
}));
const LazyPCBPanel = lazy(async () => ({
  default: (await import("./components/PCBPanel")).PCBPanel,
}));
const LazyExportPanel = lazy(async () => ({
  default: (await import("./components/ExportPanel")).ExportPanel,
}));
const LazyMechanicalReviewPanel = lazy(async () => ({
  default: (await import("./components/MechanicalReviewPanel/MechanicalReviewPanel")).MechanicalReviewPanel,
}));
const LazyScene = lazy(async () => ({
  default: (await import("./components/Preview3D")).Scene,
}));

function ErrorBanner() {
  const error = useProjectStore((state) => state.error);
  const clearError = useProjectStore((state) => state.clearError);
  const revisionConflict = useProjectStore((state) => state.revisionConflict);
  const reloadLatest = useProjectStore((state) => state.reloadLatest);
  const dismissRevisionConflict = useProjectStore((state) => state.dismissRevisionConflict);
  const sessionNotice = useAuthStore((state) => state.sessionNotice);
  const sessionState = useAuthStore((state) => state.sessionState);
  const clearSessionNotice = useAuthStore((state) => state.clearSessionNotice);
  const navigate = useNavigate();

  if (!error && !revisionConflict && !sessionNotice) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex max-w-[420px] flex-col gap-3">
      {revisionConflict && (
        <div className="surface-panel rounded-[18px] border-amber-500/20 bg-[rgba(95,66,20,0.14)] px-4 py-3 text-[13px] text-[var(--text-primary)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-amber-400">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5L12 11.5H2L7 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                <path d="M7 5V7.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="7" cy="10" r="0.75" fill="currentColor" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-amber-400">
                Revision Conflict
              </div>
              <div className="mt-1 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
                {revisionConflict.message}
              </div>
              <div className="mt-2 text-[12px] text-[var(--text-tertiary)]">
                Expected r{revisionConflict.expectedRevision ?? "?"} · current server revision r
                {revisionConflict.currentRevision ?? "?"}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => void reloadLatest()}
                  className="surface-button-primary h-8 rounded-lg px-3 text-[12px] font-semibold"
                >
                  Reload Latest Revision
                </button>
                <button
                  onClick={dismissRevisionConflict}
                  className="surface-button h-8 rounded-lg px-3 text-[12px] font-semibold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sessionNotice && (
        <div className="surface-panel rounded-[18px] border-[var(--border-default)] px-4 py-3 text-[13px]">
          <div className="flex items-start gap-3">
            <div className={sessionState === "expired" ? "text-amber-400" : "text-[var(--accent)]"}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M7 4.25V7.25L9 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)]">
                {sessionState === "expired" ? "Session Expired" : "Backend Notice"}
              </div>
              <div className="mt-1 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
                {sessionNotice}
              </div>
              <div className="mt-3 flex gap-2">
                {sessionState === "expired" && (
                  <button
                    onClick={() => navigate("/login")}
                    className="surface-button-primary h-8 rounded-lg px-3 text-[12px] font-semibold"
                  >
                    Sign In Again
                  </button>
                )}
                <button
                  onClick={clearSessionNotice}
                  className="surface-button h-8 rounded-lg px-3 text-[12px] font-semibold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="glass-danger flex items-start gap-3 rounded-[18px] px-4 py-3 text-[13px]">
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="transition-colors hover:opacity-70">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

function PanelSkeleton({ label }: { label: string }) {
  return (
    <div className="surface-strong flex h-full w-full items-center justify-center text-[12px] text-[var(--text-tertiary)]">
      {label}
    </div>
  );
}

function stageComplete(
  stageId: string,
  project: KeyboardProject | null,
  records: ProjectRecords | null,
): boolean {
  if (!project) return false;
  const elementCount = countLayoutElements(project.layout);
  const acceptedAssetCount = project.keycap_assets.filter(
    (asset) =>
      asset.acceptance_state === "accepted" ||
      asset.acceptance_state === "production_ready",
  ).length;
  const electronicsSummary =
    (project.derived?.electronics as { pins_needed?: number; source_revision?: number } | undefined) ?? null;
  const requiresSwitchProfile = ["keyboard", "macropad", "streamdeck", "midi"].includes(project.product_family);
  const latestValidation =
    records?.latest_validation_report?.revision === project.revision
      ? records.latest_validation_report
      : null;
  const latestExport =
    records?.latest_export?.source_revision === project.revision
      ? records.latest_export
      : null;
  switch (stageId) {
    case "define":
      return elementCount > 0 && (!requiresSwitchProfile || !!project.switch_profile.part_id);
    case "layout":
      return elementCount > 0;
    case "appearance":
      return acceptedAssetCount > 0;
    case "electronics":
      return (electronicsSummary?.source_revision ?? null) === project.revision;
    case "validate":
      return latestValidation !== null;
    case "export":
      return latestExport !== null;
    default:
      return false;
  }
}

function statusTone(status: string): string {
  switch (status) {
    case "validated":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "exported":
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    case "generating":
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    default:
      return "text-[var(--text-secondary)] bg-[var(--surface-chip)] border-[var(--border-default)]";
  }
}

function projectStatusLabel(status: string): string {
  return status === "exported" ? "review bundle" : status;
}

function App() {
  const [currentStageId, setCurrentStageId] = useState<StageId>("define");
  const [domainManifests, setDomainManifests] = useState<ProductDomainManifest[]>([]);
  const [familyManifests, setFamilyManifests] = useState<ProductFamilyManifest[]>([]);
  const [providerManifests, setProviderManifests] = useState<GenerationProviderManifest[]>([]);
  const [records, setRecords] = useState<ProjectRecords | null>(null);
  const [qualityGate, setQualityGate] = useState<QualityGateSummary | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const { projectId } = useParams();
  const project = useProjectStore((state) => state.project);
  const dirty = useProjectStore((state) => state.dirty);
  const save = useProjectStore((state) => state.save);
  const loadProject = useProjectStore((state) => state.loadProject);
  const loading = useProjectStore((state) => state.loading);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const sessionState = useAuthStore((state) => state.sessionState);
  const handleUnauthorized = useAuthStore((state) => state.handleUnauthorized);
  const navigate = useNavigate();

  const hasProject = !!project;
  const activeFamilyManifest = useMemo(() => {
    const family = project?.product_family ?? "keyboard";
    return familyManifests.find((manifest) => manifest.family === family) ?? null;
  }, [familyManifests, project?.product_family]);
  const isHandheldProofFamily = useMemo(
    () =>
      project?.product_family === "handheld_companion" ||
      project?.product_family === "retro_handheld",
    [project?.product_family],
  );
  const stages = activeFamilyManifest?.stages ?? fallbackStages;
  const activeStage = stages.find((stage) => stage.id === currentStageId) ?? stages[0];
  const activeStageIndex = Math.max(0, stages.findIndex((stage) => stage.id === activeStage?.id));
  const nextStage = stages[activeStageIndex + 1] ?? null;
  const refreshRecords = useCallback(async (targetProjectId?: string) => {
    const id = targetProjectId ?? project?.project_id;
    if (!id) {
      setRecords(null);
      setQualityGate(null);
      setRecordsLoading(false);
      return;
    }
    setRecordsLoading(true);
    try {
      const [payload, gate] = await Promise.all([
        api.records.get(id),
        api.records.qualityGate(id),
      ]);
      setRecords(payload);
      setQualityGate(gate);
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        handleUnauthorized("Your session expired while refreshing project records. Sign in again to continue.");
      }
      setRecords(null);
      setQualityGate(null);
    } finally {
      setRecordsLoading(false);
    }
  }, [handleUnauthorized, project?.project_id]);

  useEffect(() => {
    api.platform.productDomains().then(setDomainManifests).catch(() => {});
    api.platform.productFamilies().then(setFamilyManifests).catch(() => {});
    api.platform.providers().then(setProviderManifests).catch(() => {});
  }, []);

  useEffect(() => {
    if (projectId && (!project || project.project_id !== projectId)) {
      loadProject(projectId).then(() => setCurrentStageId("layout"));
    }
  }, [loadProject, project?.project_id, projectId]);

  useEffect(() => {
    if (!stages.some((stage) => stage.id === currentStageId)) {
      setCurrentStageId(stages[0]?.id as StageId);
    }
  }, [currentStageId, stages]);

  useEffect(() => {
    const titlePrefix = project?.name ?? "New Project";
    document.title = `${titlePrefix} — ${activeStage?.label ?? "Define"} — BreakGen`;
  }, [activeStage?.label, project?.name]);

  useEffect(() => {
    if (!project) {
      setRecords(null);
      setQualityGate(null);
      setRecordsLoading(false);
      return;
    }

    let cancelled = false;
    let intervalId: number | undefined;
    const loadRecords = async () => {
      try {
        await refreshRecords(project.project_id);
      } finally {
        if (cancelled) return;
      }
    };

    loadRecords();
    intervalId = window.setInterval(loadRecords, project.status === "generating" ? 3000 : 12000);
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [project?.project_id, project?.status, refreshRecords]);

  const renderScene = () => (
    <Suspense fallback={<PanelSkeleton label="Loading 3D preview…" />}>
      <LazyScene />
    </Suspense>
  );

  const renderStage = () => {
    if (!hasProject && activeStage.id !== "define") {
      return (
        <div className="flex flex-1 items-center justify-center text-[13px] text-[var(--text-tertiary)]">
          Start a project in the Define stage first.
        </div>
      );
    }

    if (activeStage.id === "define" && !hasProject) {
      return (
        <Suspense fallback={<PanelSkeleton label="Loading family templates…" />}>
          <LazyTemplateSelector
            domains={domainManifests}
            families={familyManifests}
            onSelect={() => {
              const nextProject = useProjectStore.getState().project;
              if (nextProject) navigate(`/app/project/${nextProject.project_id}`, { replace: true });
              setCurrentStageId("define");
            }}
          />
        </Suspense>
      );
    }

    switch (activeStage.id) {
      case "define":
        return (
          <div className="workspace-stage-split workspace-stage-split--define flex h-full">
            <div className="workspace-tools-panel w-[360px] shrink-0 overflow-y-auto glass-divider border-r flex flex-col">
              {activeStage.modules.includes("switch_explorer") ? (
                <Suspense fallback={<PanelSkeleton label="Loading hardware catalog…" />}>
                  <LazySwitchExplorer />
                </Suspense>
              ) : (
                <div className="p-6 flex-1">
                  <div className="mb-8">
                    <h3 className="mb-1.5 text-[16px] font-semibold text-[var(--text-primary)]">Define the hardware baseline</h3>
                    <p className="text-[13px] leading-[1.6] text-[var(--text-secondary)]">
                      This family uses module-driven controls instead of a keyboard switch catalog. Continue to the layout stage to place and tune the control set.
                    </p>
                  </div>
                  <div className="glass glass-soft rounded-2xl p-4">
                    <div className="mb-3 text-[11px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Modules</div>
                    <div className="flex flex-wrap gap-2">
                      {(activeFamilyManifest?.supported_module_types ?? []).map((moduleType) => (
                        <span key={moduleType} className="glass-chip rounded-full px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
                          {moduleType.replaceAll("_", " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="p-5 mt-auto">
                <button
                  onClick={() => setCurrentStageId("layout")}
                  className="surface-button-primary h-10 w-full rounded-xl text-[13px] font-semibold transition-colors"
                >
                  Continue to Layout
                </button>
              </div>
            </div>
            <div className="workspace-preview-panel flex-1">{renderScene()}</div>
          </div>
        );
      case "layout":
        return (
          <div className="workspace-stage-split workspace-stage-split--layout flex h-full">
            <div className="workspace-editor-panel flex-1 p-4 overflow-hidden">
              <Suspense fallback={<PanelSkeleton label="Loading layout editor…" />}>
                <LazyLayoutEditor />
              </Suspense>
            </div>
            <div className="workspace-preview-panel w-[44%] shrink-0 glass-divider border-l flex flex-col">
              <div className={isHandheldProofFamily ? "flex-1 min-h-0" : "flex-1"}>
                {renderScene()}
              </div>
              {isHandheldProofFamily && (
                <div className="h-[42%] min-h-[300px] glass-divider border-t">
                  <Suspense fallback={<PanelSkeleton label="Loading mechanical review…" />}>
                    <LazyMechanicalReviewPanel onRecordsRefresh={refreshRecords} />
                  </Suspense>
                </div>
              )}
            </div>
          </div>
        );
      case "appearance":
        return (
          <div className="workspace-stage-split workspace-stage-split--appearance flex h-full">
            <div className="workspace-tools-panel w-[360px] shrink-0 overflow-y-auto glass-divider border-r">
              <Suspense fallback={<PanelSkeleton label="Loading appearance tools…" />}>
                <LazyKeycapStyler onRecordsRefresh={refreshRecords} />
              </Suspense>
            </div>
            <div className="workspace-preview-panel flex-1">{renderScene()}</div>
          </div>
        );
      case "electronics":
        return (
          <div className="workspace-stage-split workspace-stage-split--electronics flex h-full">
            <div className="workspace-tools-panel w-[360px] shrink-0 overflow-y-auto glass-divider border-r">
              <Suspense fallback={<PanelSkeleton label="Loading electronics compiler…" />}>
                <LazyPCBPanel />
              </Suspense>
            </div>
            <div className="workspace-preview-panel flex-1">{renderScene()}</div>
          </div>
        );
      case "validate":
      case "export":
        return (
          <div className="workspace-stage-split workspace-stage-split--export flex h-full">
            <div className="workspace-tools-panel w-[400px] shrink-0 overflow-y-auto glass-divider border-r">
              <Suspense fallback={<PanelSkeleton label="Loading export pipeline…" />}>
                <LazyExportPanel
                  mode={activeStage.id === "validate" ? "validate" : "export"}
                  records={records}
                  onRecordsRefresh={refreshRecords}
                />
              </Suspense>
            </div>
            <div className="workspace-preview-panel flex-1">{renderScene()}</div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderStageButton = (stage: WorkspaceStageManifest, index: number, compact = false) => {
    const active = currentStageId === stage.id;
    const disabled = stage.requires_project && !hasProject;
    const complete = stageComplete(stage.id, project, records);
    return (
      <button
        key={stage.id}
        onClick={() => !disabled && setCurrentStageId(stage.id as StageId)}
        disabled={disabled}
        className={`workspace-stage-button ${compact ? "workspace-stage-button--compact" : ""} ${
          active ? "workspace-stage-button--active" : ""
        } ${complete ? "workspace-stage-button--complete" : ""}`}
      >
        <div className="workspace-stage-button__index">
          {complete ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : index + 1}
        </div>
        <div className="min-w-0">
          <div className="workspace-stage-button__label">{stage.label}</div>
          {!compact && <div className="workspace-stage-button__description">{stage.description}</div>}
        </div>
      </button>
    );
  };

  return (
    <div className="app-shell workspace-shell flex">
      <ErrorBanner />

      <aside className="workspace-sidebar surface-strong flex w-[304px] shrink-0 flex-col rounded-r-[28px]">
        <div className="surface-toolbar glass-divider flex h-14 items-center gap-2.5 border-b px-5">
          <button onClick={() => navigate("/app")} aria-label="Open project index" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="surface-chip flex h-7 w-7 items-center justify-center rounded-md">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1" fill="var(--accent)" />
                <rect x="9" y="3" width="6" height="4" rx="1" fill="var(--accent)" opacity="0.5" />
                <rect x="1" y="9" width="14" height="4" rx="1" fill="var(--accent)" opacity="0.25" />
              </svg>
            </div>
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">BreakGen</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <nav className="px-3 pt-4 space-y-0.5">
            <div className="px-2 pb-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Workspace</span>
            </div>
            {stages.map((stage, index) => renderStageButton(stage, index))}
          </nav>

          <ProjectSurfaces
            project={project}
            familyManifest={activeFamilyManifest}
            providers={providerManifests}
            records={records}
            qualityGate={qualityGate}
            loading={recordsLoading}
          />
        </div>

        {user && (
          <div className="surface-toolbar glass-divider flex items-center gap-2.5 border-t px-4 py-3">
            <div className="w-7 h-7 rounded-full bg-indigo-500/15 flex items-center justify-center text-[11px] font-semibold text-indigo-400 shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-[12px] font-medium text-[var(--text-primary)]">{user.name}</div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                {sessionState === "offline" ? "backend offline" : "private alpha"}
              </div>
            </div>
            <button onClick={() => { logout(); navigate("/"); }}
              className="text-[10px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 1h3v12H9M6 7h6M10 5l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        )}
      </aside>

      <main className="workspace-main flex-1 flex flex-col overflow-hidden relative z-10">
        <div className="workspace-mainbar surface-toolbar glass-divider flex h-12 shrink-0 items-center gap-3 border-b px-5">
          <button onClick={() => navigate("/app")} className="workspace-mobile-brand">
            <div className="surface-chip flex h-8 w-8 items-center justify-center rounded-lg">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1" fill="var(--accent)" />
                <rect x="9" y="3" width="6" height="4" rx="1" fill="var(--accent)" opacity="0.5" />
                <rect x="1" y="9" width="14" height="4" rx="1" fill="var(--accent)" opacity="0.25" />
              </svg>
            </div>
            <span>BreakGen</span>
          </button>
          <span className="workspace-stage-label text-[13px] font-medium text-[var(--text-secondary)]">{activeStage.label}</span>
          <span className="workspace-stage-divider text-[var(--text-muted)]">/</span>
          <span className="workspace-stage-description truncate text-[13px] text-[var(--text-tertiary)]">{activeStage.description}</span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher />
            {project && (
              <div className="workspace-project-meta flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{project.product_family}</span>
                <span className="text-[11px] font-mono text-[var(--text-tertiary)]">r{project.revision}</span>
                <span className={`glass-badge px-2.5 py-1 rounded-full border text-[10px] uppercase tracking-[0.08em] ${statusTone(project.status)}`}>
                  {projectStatusLabel(project.status)}
                </span>
              </div>
            )}
            {dirty && (
              <button
                onClick={() => void save()}
                disabled={loading}
                className="surface-button-primary h-8 rounded-lg px-3 text-[12px] font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </div>
        <div className="workspace-mobile-stage-nav">
          {activeStage && renderStageButton(activeStage, activeStageIndex, true)}
          {nextStage && (
            <button
              onClick={() => {
                if (!nextStage.requires_project || hasProject) {
                  setCurrentStageId(nextStage.id as StageId);
                }
              }}
              disabled={nextStage.requires_project && !hasProject}
              className="workspace-mobile-next-step"
            >
              <span>{nextStage.requires_project && !hasProject ? "After setup" : "Next"}</span>
              <strong>{nextStage.label}</strong>
            </button>
          )}
        </div>
        <div className="workspace-stage-body">
          {renderStage()}
        </div>
      </main>
    </div>
  );
}

export default App;
