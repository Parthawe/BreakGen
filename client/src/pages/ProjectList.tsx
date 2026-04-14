import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import type { ProjectSummary } from "../types/project";

const FAMILY_META: Record<string, { color: string; label: string }> = {
  keyboard: { color: "#6366f1", label: "Keyboard" },
  macropad: { color: "#22c55e", label: "Macro Pad" },
  streamdeck: { color: "#f59e0b", label: "Stream Deck" },
  midi: { color: "#ec4899", label: "MIDI" },
};

export function ProjectList() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    api.projects.list().then(setProjects).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await api.projects.delete(id);
    setProjects((p) => p.filter((x) => x.project_id !== id));
  };

  return (
    <div className="min-h-screen bg-[#08080a]">
      {/* Nav */}
      <nav className="border-b border-white/[0.04]">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14 px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="6" height="4" rx="1" fill="#6366f1" />
                <rect x="9" y="3" width="6" height="4" rx="1" fill="#6366f1" opacity="0.5" />
                <rect x="1" y="9" width="14" height="4" rx="1" fill="#6366f1" opacity="0.25" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold text-white">BreakGen</span>
          </div>
          <div className="flex items-center gap-3">
            {user && <span className="text-[13px] text-zinc-500">{user.name}</span>}
            <button onClick={() => { logout(); navigate("/"); }}
              className="h-8 px-3 text-[12px] font-medium text-zinc-400 rounded-lg border border-white/[0.06] hover:border-white/[0.12] hover:text-white transition-all">
              Log out
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h1 className="text-[28px] font-bold text-white mb-1">Your Projects</h1>
            <p className="text-[14px] text-zinc-500">Design, compile, and export custom hardware.</p>
          </div>
          <button onClick={() => navigate("/app/new")}
            className="h-10 px-5 text-[13px] font-medium rounded-xl bg-white text-black hover:bg-zinc-200 transition-colors flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            New Project
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 rounded-full animate-spin border-zinc-700 border-t-indigo-500" />
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl p-16 text-center bg-[#0f0f12] border border-white/[0.04]">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 mx-auto mb-5 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round">
                <rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h1M9 10h1M12 10h1M15 10h1M18 10h1M7 14h10" />
              </svg>
            </div>
            <h3 className="text-[18px] font-semibold text-white mb-2">No projects yet</h3>
            <p className="text-[14px] text-zinc-500 mb-8 max-w-sm mx-auto">
              Create your first design — pick a product family, choose a template, and start building.
            </p>
            <button onClick={() => navigate("/app/new")}
              className="h-11 px-7 text-[14px] font-medium rounded-xl bg-white text-black hover:bg-zinc-200 transition-colors">
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p) => {
              const fm = FAMILY_META[p.product_family] ?? { color: "#71717a", label: p.product_family };
              return (
                <button key={p.project_id} onClick={() => navigate(`/app/project/${p.project_id}`)}
                  className="text-left rounded-2xl p-6 transition-all duration-200 group bg-[#0f0f12] border border-white/[0.04] hover:border-white/[0.1] hover:-translate-y-0.5">
                  {/* Color dot + family */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: fm.color }} />
                    <span className="text-[11px] font-medium text-zinc-500">{fm.label}</span>
                    <span className="text-zinc-700">&middot;</span>
                    <span className="text-[11px] font-mono text-zinc-600">{p.key_count} keys</span>
                  </div>

                  {/* Name */}
                  <h3 className="text-[16px] font-semibold text-white mb-1 group-hover:text-indigo-300 transition-colors">{p.name}</h3>

                  {/* Meta row */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-zinc-600">r{p.revision}</span>
                      <span className="text-[11px] text-zinc-600">
                        {p.updated_at ? new Date(p.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium capitalize px-2 py-0.5 rounded-full"
                        style={{ color: p.status === "exported" ? "#6366f1" : p.status === "validated" ? "#22c55e" : "#52525b",
                          background: p.status === "exported" ? "#6366f115" : p.status === "validated" ? "#22c55e15" : "#52525b10" }}>
                        {p.status}
                      </span>
                      <button onClick={(e) => handleDelete(e, p.project_id)}
                        className="text-[10px] px-2 py-0.5 rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all">
                        Delete
                      </button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
