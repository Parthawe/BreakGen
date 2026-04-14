import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useProjectStore } from "../../stores/projectStore";

interface Preset { id: string; description: string; }
interface Variant { asset_id: string; prompt: string | null; source: string; }

// Generate a gradient from a string hash
function hashGradient(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  const hue1 = Math.abs(h) % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1},50%,25%) 0%, hsl(${hue2},40%,15%) 100%)`;
}

export function KeycapStyler() {
  const project = useProjectStore((s) => s.project);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [prompt, setPrompt] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [applied, setApplied] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { api.keycaps.presets().then(setPresets).catch(() => {}); }, []);

  const handleGenerate = async () => {
    if (!project) return;
    setGenerating(true); setVariants([]); setMessage(null);
    try {
      const r = await api.keycaps.generate(project.project_id, prompt || undefined, selectedPreset || undefined);
      setVariants((r.variants ?? []) as Variant[]);
      setMessage(r.message ?? null);
      await useProjectStore.getState().loadProject(project.project_id);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Generation failed"); }
    setGenerating(false);
  };

  const handleApply = async (assetId: string) => {
    if (!project) return;
    try {
      await api.keycaps.apply(project.project_id, assetId);
      setApplied(assetId);
      await useProjectStore.getState().loadProject(project.project_id);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Failed to apply"); }
  };

  const existingAssets = project?.keycap_assets ?? [];

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-8">
        <h3 className="text-[16px] font-semibold text-white mb-1.5">Keycap Style</h3>
        <p className="text-[13px] text-zinc-500 leading-[1.6]">Describe an aesthetic or pick a preset. AI generates keycap surface variants.</p>
      </div>

      {/* Prompt */}
      <div className="mb-5">
        <textarea value={prompt} onChange={(e) => { setPrompt(e.target.value); setSelectedPreset(null); }}
          placeholder="weathered brass with subtle patina..."
          rows={3}
          className="w-full rounded-xl px-4 py-3 text-[14px] bg-white/[0.03] border border-white/[0.06] text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/30 resize-none transition-colors" />
      </div>

      {/* Presets */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-3">Presets</div>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p.id} onClick={() => { setSelectedPreset(p.id); setPrompt(""); }}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-full transition-all ${
                selectedPreset === p.id
                  ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/25"
                  : "bg-white/[0.03] text-zinc-500 border-white/[0.04] hover:text-zinc-300 hover:border-white/[0.08]"} border capitalize`}>
              {p.id}
            </button>
          ))}
        </div>
      </div>

      {/* Generate */}
      <button onClick={handleGenerate} disabled={generating || (!prompt && !selectedPreset)}
        className="w-full h-10 text-[13px] font-medium rounded-xl transition-all mb-6 bg-white text-[#050507] hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600">
        {generating ? "Generating..." : "Generate Variants"}
      </button>

      {message && (
        <div className="text-[12px] mb-6 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-zinc-500">{message}</div>
      )}

      {/* Variants */}
      {variants.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-4">Variants</div>
          <div className="grid grid-cols-2 gap-3">
            {variants.map((v) => (
              <button key={v.asset_id} onClick={() => handleApply(v.asset_id)}
                className={`rounded-xl overflow-hidden transition-all duration-200 ${
                  applied === v.asset_id ? "ring-2 ring-indigo-500/50" : "hover:-translate-y-0.5"} border border-white/[0.04]`}>
                {/* Gradient preview derived from prompt */}
                <div className="h-20 flex items-center justify-center" style={{ background: hashGradient(v.asset_id + (v.prompt ?? "")) }}>
                  <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm" />
                </div>
                <div className="p-3 bg-[#0a0a0f]">
                  <div className="text-[11px] text-zinc-500 truncate">{v.prompt ?? "shell variant"}</div>
                  {applied === v.asset_id && <div className="text-[10px] text-emerald-400 mt-1">Applied</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Existing assets */}
      {existingAssets.length > 0 && variants.length === 0 && (
        <div>
          <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-4">Project Assets</div>
          <div className="space-y-2">
            {existingAssets.map((a) => (
              <button key={a.asset_id} onClick={() => handleApply(a.asset_id)}
                className="w-full text-left px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all">
                <div className="text-[12px] text-zinc-400">{a.prompt ?? a.asset_id}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
