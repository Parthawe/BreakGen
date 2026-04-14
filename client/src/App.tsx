import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useProjectStore } from "./stores/projectStore";
import { useAuthStore } from "./stores/authStore";
import type { KeyboardProject } from "./types/project";
import { TemplateSelector } from "./components/TemplateSelector";
import { LayoutEditor } from "./components/LayoutEditor";
import { SwitchExplorer } from "./components/SwitchExplorer";
import { KeycapStyler } from "./components/KeycapStyler";
import { PCBPanel } from "./components/PCBPanel";
import { ExportPanel } from "./components/ExportPanel";
import { Scene } from "./components/Preview3D";

type Step = "template" | "switches" | "layout" | "keycaps" | "pcb" | "export";

const STEPS: { id: Step; label: string; desc: string; requiresProject: boolean }[] = [
  { id: "template", label: "Layout", desc: "Choose a starting template", requiresProject: false },
  { id: "switches", label: "Feel", desc: "Pick your switch type", requiresProject: true },
  { id: "layout", label: "Design", desc: "Edit key positions", requiresProject: true },
  { id: "keycaps", label: "Style", desc: "Generate keycap aesthetics", requiresProject: true },
  { id: "pcb", label: "Circuit", desc: "Compile PCB & firmware", requiresProject: true },
  { id: "export", label: "Build", desc: "Validate & export files", requiresProject: true },
];

function ErrorBanner() {
  const error = useProjectStore((s) => s.error);
  const clearError = useProjectStore((s) => s.clearError);
  if (!error) return null;
  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-xl text-[13px] flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400">
      <span className="flex-1">{error}</span>
      <button onClick={clearError} className="text-red-400/50 hover:text-red-400 transition-colors">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

function isStepComplete(step: Step, project: KeyboardProject | null): boolean {
  if (!project) return false;
  switch (step) {
    case "template": return project.layout.keys.length > 0;
    case "switches": return !!project.switch_profile.part_id;
    case "layout": return project.layout.keys.length > 0;
    case "keycaps": return project.keycap_assets.length > 0;
    case "pcb": return project.pcb.matrix_rows !== null && project.pcb.matrix_rows > 0;
    case "export": return project.status === "exported";
    default: return false;
  }
}

function App() {
  const [currentStep, setCurrentStep] = useState<Step>("template");
  const { projectId } = useParams();
  const project = useProjectStore((s) => s.project);
  const dirty = useProjectStore((s) => s.dirty);
  const save = useProjectStore((s) => s.save);
  const loadProject = useProjectStore((s) => s.loadProject);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const hasProject = !!project;
  const stepIdx = STEPS.findIndex((s) => s.id === currentStep);

  useEffect(() => {
    if (projectId && (!project || project.project_id !== projectId)) {
      loadProject(projectId).then(() => setCurrentStep("layout"));
    }
  }, [projectId]);

  useEffect(() => {
    const stepLabel = STEPS[stepIdx]?.label ?? "Design";
    document.title = project ? `${project.name} — ${stepLabel} — BreakGen` : "New Project — BreakGen";
  }, [currentStep, project?.name]);

  return (
    <div className="flex h-screen w-screen bg-[#08080a]">
      <ErrorBanner />

      {/* ---- SIDEBAR ---- */}
      <aside className="w-[256px] flex flex-col shrink-0 bg-[#0b0b0f] border-r border-white/[0.04]">
        {/* Logo + back */}
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-white/[0.04]">
          <button onClick={() => navigate("/app")} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-md bg-indigo-500/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1" fill="#818cf8" />
                <rect x="9" y="3" width="6" height="4" rx="1" fill="#818cf8" opacity="0.5" />
                <rect x="1" y="9" width="14" height="4" rx="1" fill="#818cf8" opacity="0.25" />
              </svg>
            </div>
            <span className="text-[14px] font-semibold text-white">BreakGen</span>
          </button>
        </div>

        {/* Steps */}
        <nav className="flex-1 px-3 pt-4 space-y-0.5 overflow-y-auto">
          <div className="px-2 pb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600">Workflow</span>
          </div>
          {STEPS.map((step, i) => {
            const active = currentStep === step.id;
            const disabled = step.requiresProject && !hasProject;
            const complete = isStepComplete(step.id, project);

            return (
              <button key={step.id} onClick={() => !disabled && setCurrentStep(step.id)} disabled={disabled}
                className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-150 ${
                  active ? "bg-white/[0.05]" : "hover:bg-white/[0.02]"} ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold shrink-0 border ${
                  complete ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                  : active ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/25"
                  : "bg-white/[0.03] text-zinc-600 border-white/[0.06]"}`}>
                  {complete ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : i + 1}
                </div>
                <div className="min-w-0">
                  <div className={`text-[13px] font-medium leading-tight ${active ? "text-white" : "text-zinc-400"}`}>{step.label}</div>
                  <div className="text-[11px] text-zinc-600 leading-tight mt-0.5 truncate">{step.desc}</div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* User */}
        {user && (
          <div className="px-4 py-3 border-t border-white/[0.04] flex items-center gap-2.5">
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

        {/* Project info */}
        {hasProject && (
          <div className="px-3 pb-3">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-medium text-zinc-300 truncate">{project.name}</span>
                <span className="text-[10px] font-mono text-zinc-600">r{project.revision}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-600 mb-3">
                <span>{project.layout.keys.length} keys</span>
                <span>&middot;</span>
                <span className={`capitalize ${project.status === "validated" ? "text-emerald-400" : project.status === "exported" ? "text-indigo-400" : ""}`}>
                  {project.status}
                </span>
              </div>
              {dirty && (
                <button onClick={() => save()}
                  className="w-full h-8 text-[12px] font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 transition-colors">
                  Save Changes
                </button>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* ---- MAIN ---- */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="h-11 flex items-center px-5 shrink-0 border-b border-white/[0.04]">
          <span className="text-[13px] font-medium text-zinc-400">{STEPS[stepIdx]?.label}</span>
          <span className="mx-2.5 text-zinc-700">/</span>
          <span className="text-[13px] text-zinc-600">{STEPS[stepIdx]?.desc}</span>
          {currentStep === "layout" && hasProject && (
            <span className="ml-auto text-[11px] font-mono text-zinc-600">{project.layout.keys.length} keys</span>
          )}
        </div>

        {/* Template */}
        {currentStep === "template" && (
          <div className="flex-1 overflow-auto">
            <TemplateSelector onSelect={() => {
              const p = useProjectStore.getState().project;
              if (p) navigate(`/app/project/${p.project_id}`, { replace: true });
              setCurrentStep("switches");
            }} />
          </div>
        )}

        {/* Switches */}
        {currentStep === "switches" && hasProject && (
          <div className="flex h-full">
            <div className="w-[340px] shrink-0 overflow-y-auto border-r border-white/[0.04] flex flex-col">
              <SwitchExplorer />
              <div className="p-5 mt-auto">
                <button onClick={() => setCurrentStep("layout")}
                  className="w-full h-10 text-[13px] font-medium rounded-xl bg-white text-black hover:bg-zinc-200 transition-colors">
                  Continue to Design
                </button>
              </div>
            </div>
            <div className="flex-1"><Scene /></div>
          </div>
        )}

        {/* Layout */}
        {currentStep === "layout" && hasProject && (
          <div className="flex h-full">
            <div className="flex-1 p-4 overflow-hidden"><LayoutEditor /></div>
            <div className="w-[44%] shrink-0 border-l border-white/[0.04]"><Scene /></div>
          </div>
        )}

        {/* Keycaps */}
        {currentStep === "keycaps" && hasProject && (
          <div className="flex h-full">
            <div className="w-[340px] shrink-0 overflow-y-auto border-r border-white/[0.04]"><KeycapStyler /></div>
            <div className="flex-1"><Scene /></div>
          </div>
        )}

        {/* PCB */}
        {currentStep === "pcb" && hasProject && (
          <div className="flex h-full">
            <div className="w-[340px] shrink-0 overflow-y-auto border-r border-white/[0.04]"><PCBPanel /></div>
            <div className="flex-1"><Scene /></div>
          </div>
        )}

        {/* Export */}
        {currentStep === "export" && hasProject && (
          <div className="flex h-full">
            <div className="w-[380px] shrink-0 overflow-y-auto border-r border-white/[0.04]"><ExportPanel /></div>
            <div className="flex-1"><Scene /></div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
