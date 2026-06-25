import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { isApiError } from "../lib/api";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import type { ProjectSummary } from "../types/project";

const FAMILY_META: Record<
  string,
  { color: string; label: string; icon: number[][] }
> = {
  keyboard: {
    color: "#818cf8",
    label: "Keyboard",
    icon: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1.5, 1, 1, 1, 1, 1, 1, 1, 1.5],
      [2.25, 1, 1, 1, 1, 1, 1, 2.75],
    ],
  },
  macropad: {
    color: "#4ade80",
    label: "Macro Pad",
    icon: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ],
  },
  streamdeck: {
    color: "#fbbf24",
    label: "Stream Deck",
    icon: [
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
    ],
  },
  midi: {
    color: "#f472b6",
    label: "MIDI",
    icon: [
      [0, 1, 0, 1, 0],
      [1, 1, 1, 1, 1, 1],
    ],
  },
  gamepad: {
    color: "#38bdf8",
    label: "Gamepad",
    icon: [
      [0, 1, 0, 1, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 0, 1, 0],
    ],
  },
  pedal_controller: {
    color: "#f97316",
    label: "Pedal",
    icon: [
      [1, 1, 1],
      [2, 2],
    ],
  },
  breath_controller: {
    color: "#14b8a6",
    label: "Breath",
    icon: [
      [1, 3, 1],
      [0, 1, 0],
    ],
  },
  handheld_companion: {
    color: "#22c55e",
    label: "Handheld",
    icon: [
      [1, 1, 1, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1],
    ],
  },
};

function MiniSilhouette({
  rows,
  color,
}: {
  rows: number[][];
  color: string;
}) {
  return (
    <div className="flex flex-col items-center" style={{ gap: "2px" }}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex" style={{ gap: "2px" }}>
          {row.map((width, cellIndex) =>
            width > 0 ? (
              <div
                key={cellIndex}
                className="rounded-[2px]"
                style={{
                  width: `${width * 5 - 2}px`,
                  height: "3px",
                  background: color,
                  opacity: 0.72,
                }}
              />
            ) : (
              <div key={cellIndex} style={{ width: "3px" }} />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function projectStatusTone(status: string) {
  switch (status) {
    case "exported":
      return {
        color: "var(--accent)",
        background: "var(--accent-muted)",
      };
    case "validated":
      return {
        color: "var(--success)",
        background: "rgba(31, 157, 90, 0.12)",
      };
    default:
      return {
        color: "var(--text-tertiary)",
        background: "var(--surface-chip)",
      };
  }
}

function ProjectListSkeleton() {
  return (
    <section className="project-list-skeleton grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading project records">
      {Array.from({ length: 6 }).map((_, index) => (
        <article key={index} className="surface-panel rounded-[26px] p-5">
          <div className="flex items-start gap-4">
            <div className="skeleton-block h-14 w-14 shrink-0 rounded-[18px]" />
            <div className="min-w-0 flex-1">
              <div className="skeleton-block h-4 w-3/5 rounded-full" />
              <div className="mt-3 flex gap-2">
                <div className="skeleton-block h-3 w-16 rounded-full" />
                <div className="skeleton-block h-3 w-20 rounded-full" />
              </div>
            </div>
          </div>
          <div className="section-rule mt-5 grid grid-cols-3 gap-3 pt-4">
            <div className="skeleton-block h-9 rounded-[12px]" />
            <div className="skeleton-block h-9 rounded-[12px]" />
            <div className="skeleton-block h-9 rounded-[12px]" />
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="skeleton-block h-7 w-24 rounded-full" />
            <div className="skeleton-block h-7 w-20 rounded-full" />
          </div>
        </article>
      ))}
    </section>
  );
}

export function ProjectList() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const handleUnauthorized = useAuthStore((state) => state.handleUnauthorized);
  const navigate = useNavigate();

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.projects.list();
      setProjects(data);
    } catch (loadError) {
      if (isApiError(loadError) && loadError.status === 401) {
        handleUnauthorized("Your session expired while loading the project index. Sign in again to continue.");
      }
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the project index.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Projects — BreakGen";
    void loadProjects();
  }, []);

  const handleDelete = async (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    try {
      await api.projects.delete(id);
      setProjects((current) => current.filter((item) => item.project_id !== id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete this project.",
      );
    }
  };

  return (
    <div className="app-shell min-h-screen px-5 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-[1380px]">
        <nav className="surface-toolbar mb-6 flex items-center justify-between rounded-[24px] px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              aria-label="Open BreakGen landing page"
              className="surface-chip flex h-10 w-10 items-center justify-center rounded-2xl"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1" fill="var(--accent)" />
                <rect x="9" y="3" width="6" height="4" rx="1" fill="var(--accent)" opacity="0.48" />
                <rect x="1" y="9" width="14" height="4" rx="1" fill="var(--accent)" opacity="0.24" />
              </svg>
            </button>
            <div>
              <div className="text-[15px] font-semibold text-[var(--text-primary)]">BreakGen</div>
              <div className="text-[12px] text-[var(--text-tertiary)]">
                Control-surface project index
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            {user && (
              <div className="hidden text-right md:block">
                <div className="text-[13px] font-medium text-[var(--text-primary)]">{user.name}</div>
                <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                  authenticated alpha
                </div>
              </div>
            )}
            <button
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="surface-button rounded-full px-4 py-2 text-[12px] font-semibold transition-colors"
            >
              Log out
            </button>
          </div>
        </nav>

        <header className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="surface-strong rounded-[30px] p-7 md:p-8">
            <div className="eyebrow">Project desk</div>
            <h1 className="mt-4 text-[36px] font-semibold leading-[0.96] tracking-[-0.05em] text-[var(--text-primary)] md:text-[48px]">
              Build a sharper alpha by keeping every product revision legible.
            </h1>
            <p className="mt-5 max-w-[720px] text-[15px] leading-[1.8] text-[var(--text-secondary)]">
              Projects are indexed by family, revision state, and control count. The goal is not to
              store files. The goal is to keep each device readable as a working product system.
            </p>
            <div className="section-rule mt-8 grid gap-4 pt-6 md:grid-cols-3">
              {[
                ["families", "5 live alpha families"],
                ["history", "revisioned project state"],
                ["outputs", "validation, mechanical, export"],
              ].map(([label, copy]) => (
                <div key={label}>
                  <div className="eyebrow">{label}</div>
                  <div className="mt-2 text-[14px] font-medium text-[var(--text-primary)]">{copy}</div>
                </div>
              ))}
            </div>
          </section>

          <aside className="surface-panel rounded-[30px] p-6">
            <div className="eyebrow">Alpha scope</div>
            <h2 className="mt-4 text-[24px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              One product record per device.
            </h2>
            <p className="mt-3 text-[14px] leading-[1.75] text-[var(--text-secondary)]">
              The index is for reading project health quickly: family, revision state,
              source artifacts, validation, and export history from one shell.
            </p>
            <div className="section-rule mt-6 grid gap-3 pt-5 text-[12px] text-[var(--text-secondary)]">
              <span>Live families are gated by compiler readiness.</span>
              <span>Review-ready exports stay separate from fabrication-complete status.</span>
            </div>
          </aside>
        </header>

        {loading ? (
          <ProjectListSkeleton />
        ) : error ? (
          <section className="surface-panel rounded-[30px] p-12 text-center">
            <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              Project index unavailable
            </h3>
            <p className="mx-auto mt-3 max-w-[480px] text-[15px] leading-[1.75] text-[var(--text-secondary)]">
              {error}
            </p>
            <div className="mt-7 flex items-center justify-center gap-3">
              <button
                onClick={() => void loadProjects()}
                className="surface-button-primary h-11 rounded-[16px] px-6 text-[14px] font-semibold"
              >
                Retry
              </button>
              <button
                onClick={() => navigate("/app/new")}
                className="surface-button h-11 rounded-[16px] px-6 text-[14px] font-semibold"
              >
                Start New Project
              </button>
            </div>
          </section>
        ) : projects.length === 0 ? (
          <section className="surface-panel rounded-[30px] p-12 text-center">
            <div className="surface-chip mx-auto flex h-16 w-16 items-center justify-center rounded-[22px]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M6 10h1M9 10h1M12 10h1M15 10h1M18 10h1M7 14h10" />
              </svg>
            </div>
            <h3 className="mt-5 text-[22px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              No projects yet
            </h3>
            <p className="mx-auto mt-3 max-w-[420px] text-[15px] leading-[1.75] text-[var(--text-secondary)]">
              The project list is empty because there is no active product record yet. Start with a
              family, pick a constrained template, and let the platform carry the rest.
            </p>
            <button
              onClick={() => navigate("/app/new")}
              className="surface-button-primary mt-7 h-11 rounded-[16px] px-6 text-[14px] font-semibold"
            >
              Create Your First Project
            </button>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => {
              const meta = FAMILY_META[project.product_family] ?? {
                color: "var(--accent)",
                label: project.product_family,
                icon: [[1, 1, 1]],
              };
              const status = projectStatusTone(project.status);

              return (
                <button
                  key={project.project_id}
                  onClick={() => navigate(`/app/project/${project.project_id}`)}
                  className="surface-panel group rounded-[26px] p-5 text-left transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="surface-subcard flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px]"
                      style={{ background: `${meta.color}14` }}
                    >
                      <MiniSilhouette rows={meta.icon} color={meta.color} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                            {project.name}
                          </h3>
                          <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                            <span style={{ color: meta.color }}>{meta.label}</span>
                            <span>•</span>
                            <span>{project.key_count} controls</span>
                          </div>
                        </div>

                        <button
                          onClick={(event) => handleDelete(event, project.project_id)}
                          className="rounded-full px-2 py-1 text-[11px] text-[var(--text-tertiary)] opacity-0 transition-all hover:bg-[var(--error-surface)] hover:text-[var(--error)] group-hover:opacity-100"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="section-rule mt-5 grid grid-cols-3 gap-3 pt-4 text-[11px]">
                        <div>
                          <div className="text-[var(--text-tertiary)]">Revision</div>
                          <div className="mt-1 font-mono text-[var(--text-primary)]">r{project.revision}</div>
                        </div>
                        <div>
                          <div className="text-[var(--text-tertiary)]">Updated</div>
                          <div className="mt-1 text-[var(--text-primary)]">
                            {project.updated_at
                              ? new Date(project.updated_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[var(--text-tertiary)]">Status</div>
                          <div
                            className="mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                            style={status}
                          >
                            {project.status}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
