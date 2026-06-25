import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LaunchCapture } from "../components/LaunchCapture";
import { ProjectSurfaces } from "../components/PlatformSurfaces";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import {
  createPublicDemoProject,
  createPublicDemoRecords,
  publicDemoFamilyManifest,
  publicDemoProviders,
} from "../demo/publicDemo";
import { trackEvent } from "../lib/analytics";
import { REPO_URL } from "../lib/runtime";
import { useProjectStore } from "../stores/projectStore";

const LazyLayoutEditor = lazy(async () => ({
  default: (await import("../components/LayoutEditor")).LayoutEditor,
}));

const LazyScene = lazy(async () => ({
  default: (await import("../components/Preview3D")).Scene,
}));

const DEMO_SIGNALS = [
  { label: "layout", value: "live edit" },
  { label: "preview", value: "3D chamber" },
  { label: "records", value: "static sample" },
];

export function PublicDemo() {
  const project = useProjectStore((state) => state.project);
  const dirty = useProjectStore((state) => state.dirty);
  const [records] = useState(createPublicDemoRecords);

  useEffect(() => {
    document.title = "BreakGen Demo — Public Launch";
    trackEvent("public_demo_view", { surface: "demo" });
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
    if (!demoProject) return "Loading public demo…";
    if (dirty) {
      return "You are editing the public sample locally in your browser. Refresh to reset it.";
    }
    return "This public demo is client-only. The authenticated alpha adds backend compilation, records, jobs, and export lifecycle data.";
  }, [demoProject, dirty]);

  const renderEditor = () => (
    <Suspense
      fallback={
        <div className="surface-strong flex h-full w-full items-center justify-center rounded-[30px] text-[12px] text-[var(--text-tertiary)]">
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
        <div className="surface-strong flex h-full w-full items-center justify-center text-[12px] text-[var(--text-tertiary)]">
          Loading 3D preview…
        </div>
      }
    >
      <LazyScene />
    </Suspense>
  );

  return (
    <div className="app-shell min-h-screen px-5 py-5 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
        <header className="surface-toolbar flex flex-wrap items-center justify-between gap-4 rounded-[24px] px-5 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="surface-chip flex h-11 w-11 items-center justify-center rounded-2xl">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1" fill="var(--accent)" />
                <rect x="9" y="3" width="6" height="4" rx="1" fill="var(--accent)" opacity="0.48" />
                <rect x="1" y="9" width="14" height="4" rx="1" fill="var(--accent)" opacity="0.24" />
              </svg>
            </Link>
            <div>
              <div className="text-[15px] font-semibold text-[var(--text-primary)]">BreakGen</div>
              <div className="text-[12px] text-[var(--text-tertiary)]">
                Public demo workspace
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ThemeSwitcher />
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener"
              onClick={() => trackEvent("public_demo_cta_click", { surface: "demo", target: "github", placement: "nav" })}
              className="surface-button inline-flex h-11 items-center rounded-full px-4 text-[13px] font-semibold"
            >
              GitHub
            </a>
            <Link
              to="/"
              onClick={() => trackEvent("public_demo_cta_click", { surface: "demo", target: "landing", placement: "nav" })}
              className="surface-button-primary inline-flex h-11 items-center rounded-full px-5 text-[13px] font-semibold"
            >
              Launch page
            </Link>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
          <aside className="surface-panel order-2 flex flex-col overflow-hidden rounded-[32px] xl:order-1 xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)]">
            <div className="surface-strong p-6">
              <div className="eyebrow">Launch slice</div>
              <h1 className="mt-4 text-[34px] font-semibold leading-[0.94] tracking-[-0.05em] text-[var(--text-primary)]">
                Interactive control-surface demo, public and explorable.
              </h1>
              <p className="mt-4 text-[14px] leading-[1.8] text-[var(--text-secondary)]">
                This route proves the product character of BreakGen: editable layout,
                live preview, static sample records, and a visible trust layer in a shareable public build.
              </p>

              <div className="section-rule mt-6 grid gap-3 pt-5">
                {[
                  ["17", "controls in the sample"],
                  ["3", "appearance assets tracked"],
                  ["1", "mechanical sample attached"],
                ].map(([value, label]) => (
                  <div key={label} className="flex items-end justify-between gap-3">
                    <div className="text-[28px] font-semibold leading-none tracking-[-0.05em] text-[var(--text-primary)]">
                      {value}
                    </div>
                    <div className="max-w-[190px] text-right text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-rule p-6">
              <div className="eyebrow">Status</div>
              <p className="mt-3 text-[13px] leading-[1.75] text-[var(--text-secondary)]">
                {statusMessage}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <ProjectSurfaces
                project={demoProject}
                familyManifest={publicDemoFamilyManifest}
                providers={publicDemoProviders}
                records={records}
                qualityGate={null}
                loading={false}
              />
            </div>
          </aside>

          <div className="order-1 grid min-h-[620px] gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:order-2 xl:min-h-[780px]">
            <section className="surface-panel order-2 flex min-h-[540px] flex-col rounded-[32px] p-4 lg:order-1 xl:min-h-0">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {DEMO_SIGNALS.map((item) => (
                  <span
                    key={item.label}
                    className="surface-chip rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]"
                  >
                    {item.label}
                    <span className="mx-1 text-[var(--text-muted)]">/</span>
                    <span className="text-[var(--text-primary)]">{item.value}</span>
                  </span>
                ))}
              </div>
              <div className="min-h-0 flex-1">{renderEditor()}</div>
            </section>

            <div className="order-1 flex min-h-0 flex-col gap-6 lg:order-2">
              <section className="preview-chamber relative h-[420px] flex-none rounded-[32px] sm:h-[520px]">
                <div className="surface-toolbar absolute left-5 top-5 z-20 rounded-[20px] px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    Preview chamber
                  </div>
                  <div className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">
                    Panel, controls, and accepted parts
                  </div>
                </div>
                <div className="surface-toolbar absolute bottom-5 left-5 z-20 rounded-[20px] px-4 py-3">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      ["controls", "17"],
                      ["accepted", "2"],
                      ["mechanical", "panel"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</div>
                        <div className="mt-1 text-[16px] font-semibold text-[var(--text-primary)]">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="demo-product-evidence" aria-hidden="true">
                  <div className="demo-product-evidence__plate">
                    {Array.from({ length: 15 }).map((_, index) => (
                      <span key={index} />
                    ))}
                    <i />
                  </div>
                  <div className="demo-product-evidence__rail">
                    <span>rev r7</span>
                    <span>panel.dxf</span>
                    <span>validated</span>
                  </div>
                </div>
                {renderScene()}
              </section>

              <section className="surface-panel rounded-[32px] p-6">
                <div className="eyebrow">What this proves</div>
                <div className="section-rule mt-4 grid gap-4 pt-5">
                  <div className="text-[14px] leading-[1.8] text-[var(--text-secondary)]">
                    One product record spans layout, 3D preview, electronics, validation, and export history.
                  </div>
                  <div className="text-[14px] leading-[1.8] text-[var(--text-secondary)]">
                    The public launch site behaves like software, not just marketing.
                  </div>
                  <div className="text-[14px] leading-[1.8] text-[var(--text-secondary)]">
                    The authenticated alpha deepens the same model instead of diverging into a separate product story.
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
      <LaunchCapture surface="demo" />
    </div>
  );
}
