import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ProjectSurfaces } from "../components/PlatformSurfaces";
import {
  createPublicDemoProject,
  createPublicDemoRecords,
  publicDemoFamilyManifest,
  publicDemoProviders,
} from "../demo/publicDemo";
import { REPO_URL } from "../lib/runtime";
import { useProjectStore } from "../stores/projectStore";

const LazyLayoutEditor = lazy(async () => ({
  default: (await import("../components/LayoutEditor")).LayoutEditor,
}));

const LazyScene = lazy(async () => ({
  default: (await import("../components/Preview3D")).Scene,
}));

export function PublicDemo() {
  const project = useProjectStore((state) => state.project);
  const dirty = useProjectStore((state) => state.dirty);
  const [records] = useState(createPublicDemoRecords);

  useEffect(() => {
    document.title = "BreakGen Demo — Public Launch";
    if (project?.project_id === "public_demo_streamdeck") return;
    useProjectStore.setState({
      project: createPublicDemoProject(),
      loading: false,
      dirty: false,
      dirtyFields: new Set(),
      selectedElementIds: [],
      error: null,
      undoStack: [],
      redoStack: [],
    });
  }, [project?.project_id]);

  const demoProject = useProjectStore((state) => state.project);
  const statusMessage = useMemo(() => {
    if (!demoProject) return "Loading public demo...";
    if (dirty) {
      return "You are editing the demo locally in your browser. Refresh to reset the launch sample.";
    }
    return "This public demo is client-only. The full alpha with auth, jobs, and live backend compilation runs locally from the repo.";
  }, [demoProject, dirty]);

  const renderEditor = () => (
    <Suspense
      fallback={
        <div className="glass glass-strong h-full w-full rounded-[28px] flex items-center justify-center text-[12px] text-zinc-500">
          Loading layout editor…
        </div>
      }
    >
      <LazyLayoutEditor />
    </Suspense>
  );

  const renderScene = () => (
    <Suspense
      fallback={
        <div className="glass glass-strong h-full w-full flex items-center justify-center text-[12px] text-zinc-500">
          Loading 3D preview…
        </div>
      }
    >
      <LazyScene />
    </Suspense>
  );

  return (
    <div className="app-shell flex h-screen w-screen">
      <aside className="glass glass-strong w-[320px] shrink-0 rounded-r-[28px] flex flex-col">
        <div className="glass-toolbar glass-divider h-16 px-5 border-b flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="glass-chip w-10 h-10 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1" fill="#818cf8" />
                <rect x="9" y="3" width="6" height="4" rx="1" fill="#818cf8" opacity="0.5" />
                <rect x="1" y="9" width="14" height="4" rx="1" fill="#818cf8" opacity="0.25" />
              </svg>
            </div>
            <div>
              <div className="text-[15px] font-semibold text-white">BreakGen</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                Public demo
              </div>
            </div>
          </Link>
          <span className="glass-badge px-2.5 py-1 rounded-full border text-[10px] uppercase tracking-[0.08em] text-emerald-300 bg-emerald-500/10 border-emerald-500/20">
            launch
          </span>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="glass glass-soft rounded-2xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a39bff] mb-3">
              YC-level launch slice
            </div>
            <h1 className="text-[24px] font-semibold leading-[1.02] tracking-[-0.04em] text-white">
              Interactive control-surface demo, public on GitHub Pages.
            </h1>
            <p className="mt-3 text-[13px] leading-[1.7] text-zinc-400">
              This is the public launch surface: editable layout, live 3D preview, mechanical provenance, validation state, and export history in one artifact-backed product record.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener"
                className="glass-chip px-3 py-2 rounded-full text-[12px] text-zinc-300 hover:text-white transition-colors"
              >
                View GitHub
              </a>
              <Link
                to="/"
                className="glass-chip px-3 py-2 rounded-full text-[12px] text-zinc-300 hover:text-white transition-colors"
              >
                Launch page
              </Link>
            </div>
          </div>

          <div className="glass glass-soft rounded-2xl p-4 text-[12px] leading-[1.7] text-zinc-400">
            {statusMessage}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ProjectSurfaces
            project={demoProject}
            familyManifest={publicDemoFamilyManifest}
            providers={publicDemoProviders}
            records={records}
            loading={false}
          />
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="glass-toolbar glass-divider h-12 border-b flex items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-zinc-300">Demo workspace</span>
            <span className="text-zinc-700">/</span>
            <span className="text-[12px] text-zinc-500">
              Edit the sample layout locally and watch the product state update live.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.08em] text-zinc-600">
              streamdeck
            </span>
            <span className="text-[11px] font-mono text-zinc-600">
              r{demoProject?.revision ?? "?"}
            </span>
          </div>
        </div>

        <div className="flex-1 flex">
          <div className="flex-1 p-4 overflow-hidden">
            {renderEditor()}
          </div>
          <div className="w-[44%] shrink-0 glass-divider border-l flex flex-col">
            <div className="flex-1 min-h-0">
              {renderScene()}
            </div>
            <div className="glass-divider border-t p-4">
              <div className="glass glass-soft rounded-2xl p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-600 mb-2">
                  Launch framing
                </div>
                <div className="text-[13px] leading-[1.75] text-zinc-400">
                  Public site: launch narrative plus client-only interactive demo.
                  Private alpha: authenticated workspace, live API, generation jobs,
                  compiler endpoints, and full export flow from the repo.
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
