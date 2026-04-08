import { useState } from "react";
import { useProjectStore } from "./stores/projectStore";
import { TemplateSelector } from "./components/TemplateSelector";
import { LayoutEditor } from "./components/LayoutEditor";
import { SwitchExplorer } from "./components/SwitchExplorer";
import { Scene } from "./components/Preview3D";

type Step = "template" | "switches" | "layout" | "keycaps" | "pcb" | "export";

const STEPS: { id: Step; label: string; requiresProject: boolean }[] = [
  { id: "template", label: "Template", requiresProject: false },
  { id: "switches", label: "Switches", requiresProject: true },
  { id: "layout", label: "Layout", requiresProject: true },
  { id: "keycaps", label: "Keycaps", requiresProject: true },
  { id: "pcb", label: "PCB", requiresProject: true },
  { id: "export", label: "Export", requiresProject: true },
];

function App() {
  const [currentStep, setCurrentStep] = useState<Step>("template");
  const project = useProjectStore((s) => s.project);
  const dirty = useProjectStore((s) => s.dirty);
  const save = useProjectStore((s) => s.save);

  const hasProject = !!project;

  return (
    <div className="flex h-screen w-screen bg-neutral-950">
      {/* Sidebar */}
      <aside className="w-64 border-r border-neutral-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-neutral-800">
          <h1 className="text-lg font-semibold text-white tracking-tight">
            BreakGen
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Keyboard Intent Compiler
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {STEPS.map((step, i) => {
            const isActive = currentStep === step.id;
            const isDisabled = step.requiresProject && !hasProject;
            const isComplete =
              hasProject &&
              STEPS.findIndex((s) => s.id === currentStep) > i;

            return (
              <button
                key={step.id}
                onClick={() => !isDisabled && setCurrentStep(step.id)}
                disabled={isDisabled}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-3 ${
                  isActive
                    ? "text-white bg-neutral-800"
                    : isDisabled
                      ? "text-neutral-700 cursor-not-allowed"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                    isComplete
                      ? "border-emerald-600 bg-emerald-600/20 text-emerald-400"
                      : isActive
                        ? "border-indigo-500 text-indigo-400"
                        : "border-neutral-700 text-neutral-600"
                  }`}
                >
                  {isComplete ? "\u2713" : i + 1}
                </span>
                {step.label}
              </button>
            );
          })}
        </nav>

        {/* Project info */}
        {hasProject && (
          <div className="p-4 border-t border-neutral-800 space-y-2">
            <div className="text-xs text-neutral-500">
              {project.name} &middot; rev {project.revision}
            </div>
            <div className="text-xs text-neutral-600">
              {project.layout.keys.length} keys &middot; {project.status}
            </div>
            {dirty && (
              <button
                onClick={() => save()}
                className="w-full px-3 py-1.5 text-xs text-indigo-300 border border-indigo-800/50 rounded hover:bg-indigo-950/30 transition-colors"
              >
                Save Changes
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Step: Template selector */}
        {currentStep === "template" && (
          <div className="flex-1 overflow-auto">
            <TemplateSelector
              onSelect={() => setCurrentStep("switches")}
            />
          </div>
        )}

        {/* Step: Switch selector */}
        {currentStep === "switches" && hasProject && (
          <div className="flex h-full">
            <div className="w-72 border-r border-neutral-800 overflow-y-auto">
              <SwitchExplorer />
              <div className="p-4">
                <button
                  onClick={() => setCurrentStep("layout")}
                  className="w-full px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                >
                  Continue to Layout
                </button>
              </div>
            </div>
            <div className="flex-1">
              <Scene />
            </div>
          </div>
        )}

        {/* Step: Layout editor with 3D preview */}
        {currentStep === "layout" && hasProject && (
          <div className="flex h-full">
            {/* 2D Editor */}
            <div className="flex-1 p-4 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-neutral-300">
                  Layout Editor
                </h2>
                <span className="text-xs text-neutral-600 font-mono">
                  {project.layout.keys.length} keys
                </span>
              </div>
              <div className="h-[calc(100%-2rem)]">
                <LayoutEditor />
              </div>
            </div>
            {/* 3D Preview */}
            <div className="w-[45%] border-l border-neutral-800">
              <Scene />
            </div>
          </div>
        )}

        {/* Placeholder steps */}
        {(currentStep === "keycaps" ||
          currentStep === "pcb" ||
          currentStep === "export") &&
          hasProject && (
            <div className="flex h-full">
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-neutral-600 text-sm mb-2">
                    {currentStep.toUpperCase()}
                  </div>
                  <div className="text-neutral-700 text-xs">
                    Coming in Phase{" "}
                    {currentStep === "keycaps"
                      ? "3"
                      : currentStep === "pcb"
                        ? "4"
                        : "5"}
                  </div>
                </div>
              </div>
              <div className="w-[45%] border-l border-neutral-800">
                <Scene />
              </div>
            </div>
          )}
      </main>
    </div>
  );
}

export default App;
