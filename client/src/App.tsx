import { useState } from "react";
import { useProjectStore } from "./stores/projectStore";
import { TemplateSelector } from "./components/TemplateSelector";
import { LayoutEditor } from "./components/LayoutEditor";
import { SwitchExplorer } from "./components/SwitchExplorer";
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

function App() {
  const [currentStep, setCurrentStep] = useState<Step>("template");
  const project = useProjectStore((s) => s.project);
  const dirty = useProjectStore((s) => s.dirty);
  const save = useProjectStore((s) => s.save);
  const hasProject = !!project;
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex h-screen w-screen" style={{ background: "var(--bg-root)" }}>
      {/* Sidebar */}
      <aside
        className="w-[260px] flex flex-col shrink-0"
        style={{ background: "var(--bg-surface)", borderRight: "1px solid var(--border-subtle)" }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--accent-muted)" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1" fill="var(--accent)" />
                <rect x="9" y="3" width="6" height="4" rx="1" fill="var(--accent)" opacity="0.6" />
                <rect x="1" y="9" width="14" height="4" rx="1" fill="var(--accent)" opacity="0.3" />
              </svg>
            </div>
            <div>
              <h1 className="text-[15px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                BreakGen
              </h1>
              <p className="text-[11px] leading-tight mt-0.5" style={{ color: "var(--text-muted)" }}>
                Intent Compiler
              </p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <nav className="flex-1 px-3 space-y-0.5">
          <div className="px-2 pb-2 pt-1">
            <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Workflow
            </span>
          </div>
          {STEPS.map((step, i) => {
            const isActive = currentStep === step.id;
            const isDisabled = step.requiresProject && !hasProject;
            const isComplete = hasProject && currentStepIndex > i;

            return (
              <button
                key={step.id}
                onClick={() => !isDisabled && setCurrentStep(step.id)}
                disabled={isDisabled}
                className="w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 flex items-center gap-3 group"
                style={{
                  background: isActive ? "var(--bg-hover)" : "transparent",
                  opacity: isDisabled ? 0.35 : 1,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                }}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-medium shrink-0 transition-all duration-150"
                  style={{
                    background: isComplete
                      ? "rgba(34, 197, 94, 0.15)"
                      : isActive
                        ? "var(--accent-muted)"
                        : "var(--bg-elevated)",
                    color: isComplete
                      ? "var(--success)"
                      : isActive
                        ? "var(--accent-hover)"
                        : "var(--text-muted)",
                    border: `1px solid ${isComplete ? "rgba(34, 197, 94, 0.25)" : isActive ? "rgba(99, 102, 241, 0.3)" : "var(--border-subtle)"}`,
                  }}
                >
                  {isComplete ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="min-w-0">
                  <div
                    className="text-[13px] font-medium leading-tight"
                    style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}
                  >
                    {step.label}
                  </div>
                  <div
                    className="text-[11px] leading-tight mt-0.5 truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {step.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Project info */}
        {hasProject && (
          <div className="px-4 py-4 mx-3 mb-3 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {project.name}
              </span>
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
              >
                r{project.revision}
              </span>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {project.layout.keys.length} keys
              </span>
              <span className="w-1 h-1 rounded-full" style={{ background: "var(--border-default)" }} />
              <span
                className="text-[11px] capitalize"
                style={{
                  color: project.status === "validated"
                    ? "var(--success)"
                    : project.status === "exported"
                      ? "var(--accent)"
                      : "var(--text-tertiary)",
                }}
              >
                {project.status}
              </span>
            </div>
            {dirty && (
              <button
                onClick={() => save()}
                className="w-full py-2 text-[12px] font-medium rounded-md transition-all duration-150"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
              >
                Save Changes
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--bg-root)" }}>
        {/* Top bar */}
        <div
          className="h-11 flex items-center px-5 shrink-0"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
            {STEPS[currentStepIndex]?.label}
          </span>
          <span className="mx-2 text-[11px]" style={{ color: "var(--text-muted)" }}>/</span>
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            {STEPS[currentStepIndex]?.desc}
          </span>

          {currentStep === "layout" && hasProject && (
            <span className="ml-auto text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
              {project.layout.keys.length} keys
            </span>
          )}
        </div>

        {/* Step: Template */}
        {currentStep === "template" && (
          <div className="flex-1 overflow-auto">
            <TemplateSelector onSelect={() => setCurrentStep("switches")} />
          </div>
        )}

        {/* Step: Switches */}
        {currentStep === "switches" && hasProject && (
          <div className="flex h-full">
            <div
              className="w-[340px] shrink-0 overflow-y-auto flex flex-col"
              style={{ borderRight: "1px solid var(--border-subtle)" }}
            >
              <SwitchExplorer />
              <div className="p-5 mt-auto">
                <button
                  onClick={() => setCurrentStep("layout")}
                  className="w-full py-2.5 text-[13px] font-medium rounded-lg transition-all duration-150"
                  style={{ background: "var(--accent)", color: "#fff" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  Continue to Design
                </button>
              </div>
            </div>
            <div className="flex-1">
              <Scene />
            </div>
          </div>
        )}

        {/* Step: Layout */}
        {currentStep === "layout" && hasProject && (
          <div className="flex h-full">
            <div className="flex-1 p-4 overflow-hidden">
              <LayoutEditor />
            </div>
            <div className="w-[44%] shrink-0" style={{ borderLeft: "1px solid var(--border-subtle)" }}>
              <Scene />
            </div>
          </div>
        )}

        {/* Future steps */}
        {["keycaps", "pcb", "export"].includes(currentStep) && hasProject && (
          <div className="flex h-full">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-xs">
                <div
                  className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
                >
                  <span className="text-lg" style={{ color: "var(--text-muted)" }}>
                    {currentStep === "keycaps" ? "~" : currentStep === "pcb" ? "#" : "^"}
                  </span>
                </div>
                <h3 className="text-[14px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  {STEPS[currentStepIndex]?.label}
                </h3>
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {currentStep === "keycaps"
                    ? "AI keycap generation will appear here. Describe your aesthetic in natural language."
                    : currentStep === "pcb"
                      ? "Matrix compilation and PCB generation. One click to go from layout to circuit."
                      : "Validate your design and download fabrication-ready files."}
                </p>
              </div>
            </div>
            <div className="w-[44%] shrink-0" style={{ borderLeft: "1px solid var(--border-subtle)" }}>
              <Scene />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
