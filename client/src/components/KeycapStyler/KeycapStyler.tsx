import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useProjectStore } from "../../stores/projectStore";

interface Preset {
  id: string;
  description: string;
}

interface Variant {
  asset_id: string;
  prompt: string | null;
  source: string;
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

  useEffect(() => {
    api.keycaps.presets().then(setPresets).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!project) return;
    setGenerating(true);
    setVariants([]);
    setMessage(null);
    try {
      const result = await api.keycaps.generate(
        project.project_id,
        prompt || undefined,
        selectedPreset || undefined
      );
      setVariants((result.variants ?? []) as Variant[]);
      setMessage(result.message ?? null);
      // Reload project to get persisted keycap_assets
      await useProjectStore.getState().loadProject(project.project_id);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Generation failed");
    }
    setGenerating(false);
  };

  const handleApply = async (assetId: string) => {
    if (!project) return;
    try {
      await api.keycaps.apply(project.project_id, assetId);
      setApplied(assetId);
      await useProjectStore.getState().loadProject(project.project_id);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to apply");
    }
  };

  const existingAssets = project?.keycap_assets ?? [];

  return (
    <div className="p-5 h-full overflow-y-auto">
      <div className="mb-6">
        <h3 className="text-[14px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>
          Keycap Style
        </h3>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Describe an aesthetic or pick a preset. AI generates keycap surface variants.
        </p>
      </div>

      {/* Prompt input */}
      <div className="mb-4">
        <textarea
          value={prompt}
          onChange={(e) => { setPrompt(e.target.value); setSelectedPreset(null); }}
          placeholder="weathered brass with subtle patina..."
          rows={2}
          className="w-full rounded-lg px-3 py-2.5 text-[13px] resize-none focus:outline-none transition-colors"
          style={{
            background: "var(--bg-elevated)",
            border: `1px solid ${prompt ? "var(--accent)" : "var(--border-subtle)"}`,
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Presets */}
      <div className="mb-5">
        <div className="text-[10px] font-medium uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
          Style Presets
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedPreset(p.id); setPrompt(""); }}
              className="px-2.5 py-1 text-[11px] rounded-md transition-all"
              style={{
                background: selectedPreset === p.id ? "var(--accent-muted)" : "var(--bg-elevated)",
                border: `1px solid ${selectedPreset === p.id ? "var(--accent)" : "var(--border-subtle)"}`,
                color: selectedPreset === p.id ? "var(--accent-hover)" : "var(--text-secondary)",
              }}
            >
              {p.id}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating || (!prompt && !selectedPreset)}
        className="w-full py-2.5 text-[13px] font-medium rounded-lg transition-all mb-5"
        style={{
          background: generating || (!prompt && !selectedPreset) ? "var(--bg-elevated)" : "var(--accent)",
          color: generating || (!prompt && !selectedPreset) ? "var(--text-muted)" : "#fff",
          cursor: generating || (!prompt && !selectedPreset) ? "not-allowed" : "pointer",
        }}
      >
        {generating ? "Generating..." : "Generate Variants"}
      </button>

      {message && (
        <div className="text-[11px] mb-4 px-3 py-2 rounded-lg" style={{ background: "var(--bg-elevated)", color: "var(--text-tertiary)" }}>
          {message}
        </div>
      )}

      {/* Variants */}
      {variants.length > 0 && (
        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
            Variants ({variants.length})
          </div>
          <div className="grid grid-cols-2 gap-2">
            {variants.map((v) => (
              <button
                key={v.asset_id}
                onClick={() => handleApply(v.asset_id)}
                className="p-3 rounded-lg text-left transition-all"
                style={{
                  background: applied === v.asset_id ? "var(--accent-muted)" : "var(--bg-surface)",
                  border: `1px solid ${applied === v.asset_id ? "var(--accent)" : "var(--border-subtle)"}`,
                }}
              >
                <div className="w-full h-12 rounded-md mb-2 flex items-center justify-center"
                  style={{ background: "var(--bg-root)" }}>
                  <span className="text-[18px]" style={{ color: "var(--text-muted)" }}>
                    {v.source === "shell_library" ? "[]" : "~"}
                  </span>
                </div>
                <div className="text-[10px] font-mono truncate" style={{ color: "var(--text-muted)" }}>
                  {v.asset_id}
                </div>
                {applied === v.asset_id && (
                  <div className="text-[10px] mt-1" style={{ color: "var(--success)" }}>Applied to all keys</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Existing assets */}
      {existingAssets.length > 0 && variants.length === 0 && (
        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
            Project Assets ({existingAssets.length})
          </div>
          <div className="space-y-1.5">
            {existingAssets.map((a) => (
              <button
                key={a.asset_id}
                onClick={() => handleApply(a.asset_id)}
                className="w-full text-left px-3 py-2 rounded-lg text-[12px] transition-all"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                }}
              >
                <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{a.asset_id}</span>
                {a.prompt && <span className="ml-2 text-[11px]" style={{ color: "var(--text-tertiary)" }}>{a.prompt}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
