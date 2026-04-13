import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import type { ProjectSummary } from "../types/project";

export function ProjectList() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    api.projects.list().then((p) => {
      setProjects(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleNew = () => {
    navigate("/app/new");
  };

  const handleOpen = (id: string) => {
    navigate(`/app/project/${id}`);
  };

  const handleDelete = async (id: string) => {
    await api.projects.delete(id);
    setProjects((p) => p.filter((x) => x.project_id !== id));
  };

  const familyColor: Record<string, string> = {
    keyboard: "#6366f1", macropad: "#22c55e", streamdeck: "#f59e0b", midi: "#ec4899",
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "validated": return "var(--success)";
      case "exported": return "var(--accent)";
      default: return "var(--text-muted)";
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-root)" }}>
      {/* Top bar */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-muted)" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="3" width="6" height="4" rx="1" fill="var(--accent)" />
              <rect x="9" y="3" width="6" height="4" rx="1" fill="var(--accent)" opacity="0.6" />
              <rect x="1" y="9" width="14" height="4" rx="1" fill="var(--accent)" opacity="0.3" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>BreakGen</span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{user.name}</span>
          )}
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="text-[12px] px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
          >
            Log out
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 pt-8 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[22px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Your Projects
            </h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
              Design, compile, and export custom hardware.
            </p>
          </div>
          <button
            onClick={handleNew}
            className="px-5 py-2.5 text-[13px] font-medium rounded-xl transition-all flex items-center gap-2"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            New Project
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: "var(--border-subtle)", borderTopColor: "var(--accent)" }} />
          </div>
        ) : projects.length === 0 ? (
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
          >
            <div
              className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: "var(--accent-muted)" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M6 10h1M9 10h1M12 10h1M15 10h1M18 10h1M7 14h10" />
              </svg>
            </div>
            <h3 className="text-[15px] font-medium mb-2" style={{ color: "var(--text-primary)" }}>
              No projects yet
            </h3>
            <p className="text-[13px] mb-6" style={{ color: "var(--text-muted)" }}>
              Create your first design and export fabrication-ready files.
            </p>
            <button
              onClick={handleNew}
              className="px-5 py-2.5 text-[13px] font-medium rounded-xl transition-all"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p) => (
              <button
                key={p.project_id}
                onClick={() => handleOpen(p.project_id)}
                className="text-left rounded-xl p-5 transition-all group"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                      {p.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-medium capitalize px-1.5 py-0.5 rounded"
                        style={{ color: familyColor[p.product_family] ?? "var(--text-muted)", background: (familyColor[p.product_family] ?? "#666") + "15" }}>
                        {p.product_family}
                      </span>
                      <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                        {p.key_count} keys &middot; r{p.revision}
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-medium capitalize px-2 py-0.5 rounded-full"
                    style={{ color: statusColor(p.status), background: `${statusColor(p.status)}18` }}
                  >
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : ""}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.project_id); }}
                    className="text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--error)", background: "rgba(239,68,68,0.08)" }}
                  >
                    Delete
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
