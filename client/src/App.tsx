import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "./lib/api";
import { countLayoutElements } from "./lib/projectCompat";
import { useAuthStore } from "./stores/authStore";
import { useProjectStore } from "./stores/projectStore";
import type {
  GenerationProviderManifest,
  KeyboardProject,
  ProductDomainManifest,
  ProductFamilyManifest,
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
  if (!error) return null;
  return (
    <div className="glass-danger fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-xl text-[13px] flex items-start gap-3 text-red-300">
      <span className="flex-1">{error}</span>
      <button onClick={clearError} className="text-red-400/50 hover:text-red-400 transition-colors">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

function PanelSkeleton({ label }: { label: string }) {
  return (
    <div className="glass glass-strong w-full h-full flex items-center justify-center text-[12px] text-zinc-500">
      {label}
    </div>
  );
}

function stageComplete(stageId: string, project: KeyboardProject | null): boolean {
  if (!project) return false;
  const elementCount = countLayoutElements(project.layout);
  const acceptedAssetCount = project.keycap_assets.filter(
    (asset) =>
      asset.acceptance_state === "accepted" ||
      asset.acceptance_state === "production_ready",
  ).length;
  const electronicsSummary =
    (project.derived?.electronics as { pins_needed?: number } | undefined) ?? null;
  const requiresSwitchProfile = ["keyboard", "macropad", "streamdeck", "midi"].includes(project.product_family);
  switch (stageId) {
    case "define":
      return elementCount > 0 && (!requiresSwitchProfile || !!project.switch_profile.part_id);
    case "layout":
      return elementCount > 0;
    case "appearance":
      return acceptedAssetCount > 0;
    case "electronics":
      return !!electronicsSummary || project.pcb.matrix_rows !== null;
    case "validate":
      return project.status === "validated" || project.status === "exported";
    case "export":
      return project.status === "exported";
    default:
      return false;
  }
}

function statusTone(status: string): string {
  switch (status) {
    case "validated":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "exported":
      return "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
    case "generating":
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    default:
      return "text-zinc-400 bg-white/[0.03] border-white/[0.06]";
  }
}

function App() {
  const [currentStageId, setCurrentStageId] = useState<StageId>("define");
  const [domainManifests, setDomainManifests] = useState<ProductDomainManifest[]>([]);
  const [familyManifests, setFamilyManifests] = useState<ProductFamilyManifest[]>([]);
  const [providerManifests, setProviderManifests] = useState<GenerationProviderManifest[]>([]);
  const [records, setRecords] = useState<ProjectRecords | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const { projectId } = useParams();
  const project = useProjectStore((state) => state.project);
  const dirty = useProjectStore((state) => state.dirty);
  const save = useProjectStore((state) => state.save);
  const loadProject = useProjectStore((state) => state.loadProject);
  const loading = useProjectStore((state) => state.loading);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
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
  const refreshRecords = useCallback(async (targetProjectId?: string) => {
    const id = targetProjectId ?? project?.project_id;
    if (!id) {
      setRecords(null);
      setRecordsLoading(false);
      return;
    }
    setRecordsLoading(true);
    try {
      const payload = await api.records.get(id);
      setRecords(payload);
    } catch {
      setRecords(null);
    } finally {
      setRecordsLoading(false);
    }
  }, [project?.project_id]);

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
        <div className="flex-1 flex items-center justify-center text-[13px] text-zinc-600">
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
          <div className="flex h-full">
            <div className="w-[360px] shrink-0 overflow-y-auto glass-divider border-r flex flex-col">
              {activeStage.modules.includes("switch_explorer") ? (
                <Suspense fallback={<PanelSkeleton label="Loading hardware catalog…" />}>
                  <LazySwitchExplorer />
                </Suspense>
              ) : (
                <div className="p-6 flex-1">
                  <div className="mb-8">
                    <h3 className="text-[16px] font-semibold text-white mb-1.5">Define the hardware baseline</h3>
                    <p className="text-[13px] text-zinc-500 leading-[1.6]">
                      This family uses module-driven controls instead of a keyboard switch catalog. Continue to the layout stage to place and tune the control set.
                    </p>
                  </div>
                  <div className="glass glass-soft rounded-2xl p-4">
                    <div className="text-[11px] uppercase tracking-[0.1em] text-zinc-600 mb-3">Modules</div>
                    <div className="flex flex-wrap gap-2">
                      {(activeFamilyManifest?.supported_module_types ?? []).map((moduleType) => (
                        <span key={moduleType} className="glass-chip px-2.5 py-1 rounded-full text-[11px] text-zinc-400">
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
                  className="w-full h-10 text-[13px] font-medium rounded-xl bg-white text-black hover:bg-zinc-200 transition-colors"
                >
                  Continue to Layout
                </button>
              </div>
            </div>
            <div className="flex-1">{renderScene()}</div>
          </div>
        );
      case "layout":
        return (
          <div className="flex h-full">
            <div className="flex-1 p-4 overflow-hidden">
              <Suspense fallback={<PanelSkeleton label="Loading layout editor…" />}>
                <LazyLayoutEditor />
              </Suspense>
            </div>
            <div className="w-[44%] shrink-0 glass-divider border-l flex flex-col">
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
          <div className="flex h-full">
            <div className="w-[360px] shrink-0 overflow-y-auto glass-divider border-r">
              <Suspense fallback={<PanelSkeleton label="Loading appearance tools…" />}>
                <LazyKeycapStyler onRecordsRefresh={refreshRecords} />
              </Suspense>
            </div>
            <div className="flex-1">{renderScene()}</div>
          </div>
        );
      case "electronics":
        return (
          <div className="flex h-full">
            <div className="w-[360px] shrink-0 overflow-y-auto glass-divider border-r">
              <Suspense fallback={<PanelSkeleton label="Loading electronics compiler…" />}>
                <LazyPCBPanel />
              </Suspense>
            </div>
            <div className="flex-1">{renderScene()}</div>
          </div>
        );
      case "validate":
      case "export":
        return (
          <div className="flex h-full">
            <div className="w-[400px] shrink-0 overflow-y-auto glass-divider border-r">
              <Suspense fallback={<PanelSkeleton label="Loading export pipeline…" />}>
                <LazyExportPanel
                  mode={activeStage.id === "validate" ? "validate" : "export"}
                  records={records}
                  onRecordsRefresh={refreshRecords}
                />
              </Suspense>
            </div>
            <div className="flex-1">{renderScene()}</div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-shell flex h-screen w-screen">
      <ErrorBanner />

      <aside className="glass glass-strong w-[304px] flex flex-col shrink-0 rounded-r-[28px]">
        <div className="glass-toolbar glass-divider h-14 flex items-center gap-2.5 px-5 border-b">
          <button onClick={() => navigate("/app")} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="glass-chip w-7 h-7 rounded-md flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1" fill="#818cf8" />
                <rect x="9" y="3" width="6" height="4" rx="1" fill="#818cf8" opacity="0.5" />
                <rect x="1" y="9" width="14" height="4" rx="1" fill="#818cf8" opacity="0.25" />
              </svg>
            </div>
            <span className="text-[14px] font-semibold text-white">BreakGen</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <nav className="px-3 pt-4 space-y-0.5">
            <div className="px-2 pb-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600">Workspace</span>
            </div>
            {stages.map((stage, index) => {
              const active = currentStageId === stage.id;
              const disabled = stage.requires_project && !hasProject;
              const complete = stageComplete(stage.id, project);
              return (
                <button
                  key={stage.id}
                  onClick={() => !disabled && setCurrentStageId(stage.id as StageId)}
                  disabled={disabled}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-150 ${
                    active ? "glass glass-soft" : "glass-button hover:bg-white/[0.03]"
                  } ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold shrink-0 border ${
                    complete
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                      : active
                        ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/25"
                        : "glass-chip text-zinc-500 border-white/[0.08]"
                  }`}>
                    {complete ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-[13px] font-medium leading-tight ${active ? "text-white" : "text-zinc-400"}`}>{stage.label}</div>
                    <div className="text-[11px] text-zinc-600 leading-tight mt-0.5 truncate">{stage.description}</div>
                  </div>
                </button>
              );
            })}
          </nav>

          <ProjectSurfaces
            project={project}
            familyManifest={activeFamilyManifest}
            providers={providerManifests}
            records={records}
            loading={recordsLoading}
          />
        </div>

        {user && (
          <div className="glass-toolbar glass-divider px-4 py-3 border-t flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-indigo-500/15 flex items-center justify-center text-[11px] font-semibold text-indigo-400 shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-zinc-300 truncate">{user.name}</div>
            </div>
            <button onClick={() => { logout(); navigate("/"); }}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 1h3v12H9M6 7h6M10 5l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        <div className="glass-toolbar glass-divider h-12 flex items-center gap-3 px-5 shrink-0 border-b">
          <span className="text-[13px] font-medium text-zinc-400">{activeStage.label}</span>
          <span className="text-zinc-700">/</span>
          <span className="text-[13px] text-zinc-600 truncate">{activeStage.description}</span>
          <div className="ml-auto flex items-center gap-2">
            {project && (
              <>
                <span className="text-[11px] uppercase tracking-[0.08em] text-zinc-600">{project.product_family}</span>
                <span className="text-[11px] font-mono text-zinc-600">r{project.revision}</span>
                <span className={`glass-badge px-2.5 py-1 rounded-full border text-[10px] uppercase tracking-[0.08em] ${statusTone(project.status)}`}>
                  {project.status}
                </span>
              </>
            )}
            {dirty && (
              <button
                onClick={() => save()}
                disabled={loading}
                className="glass-button-primary h-8 px-3 text-[12px] font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {loading ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </div>
        {renderStage()}
      </main>
    </div>
  );
}

export default App;
