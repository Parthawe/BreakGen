import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type {
  AcceptanceState,
  GenerationProviderManifest,
  KeycapAsset,
} from "../../types/project";
import { useProjectStore } from "../../stores/projectStore";

interface Preset {
  id: string;
  description: string;
}

type AssetAction = "accept" | "reject" | "apply";

function hashGradient(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  const hue1 = Math.abs(h) % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1},50%,25%) 0%, hsl(${hue2},40%,15%) 100%)`;
}

function stateTone(state: AcceptanceState): string {
  switch (state) {
    case "accepted":
      return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
    case "production_ready":
      return "text-indigo-300 bg-indigo-500/10 border-indigo-500/20";
    case "rejected":
      return "text-red-300 bg-red-500/10 border-red-500/20";
    case "preview_only":
      return "text-zinc-400 bg-white/[0.04] border-white/[0.08]";
    default:
      return "text-amber-300 bg-amber-500/10 border-amber-500/20";
  }
}

function stateLabel(state: AcceptanceState): string {
  return state.replace(/_/g, " ");
}

export function KeycapStyler({
  onRecordsRefresh,
}: {
  onRecordsRefresh?: () => Promise<void>;
}) {
  const project = useProjectStore((s) => s.project);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [providers, setProviders] = useState<GenerationProviderManifest[]>([]);
  const [prompt, setPrompt] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [assetActionById, setAssetActionById] = useState<Record<string, AssetAction | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.keycaps.presets().then(setPresets).catch(() => {});
    api.platform.providers().then(setProviders).catch(() => {});
  }, []);

  useEffect(() => {
    const defaultProvider =
      project?.style_request.provider ??
      providers.find((provider) => provider.status === "enabled")?.id ??
      providers.find((provider) => provider.status === "fallback")?.id ??
      null;
    setSelectedProvider(defaultProvider);
  }, [project?.style_request.provider, providers]);

  const assets = project?.keycap_assets ?? [];
  const reviewAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.acceptance_state === "candidate" ||
          asset.acceptance_state === "preview_only",
      ),
    [assets],
  );
  const acceptedAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.acceptance_state === "accepted" ||
          asset.acceptance_state === "production_ready",
      ),
    [assets],
  );
  const rejectedAssets = useMemo(
    () => assets.filter((asset) => asset.acceptance_state === "rejected"),
    [assets],
  );
  const appliedAssetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const element of project?.layout.elements ?? []) {
      const assetId = element.keycap_asset_id ?? element.appearance_ref;
      if (assetId) ids.add(assetId);
    }
    return ids;
  }, [project?.layout.elements]);

  const handleGenerate = async () => {
    if (!project) return;
    setGenerating(true);
    setMessage(null);
    try {
      const response = await api.keycaps.generate(
        project.project_id,
        prompt || undefined,
        selectedPreset || undefined,
        selectedProvider || undefined,
      );
      setMessage(
        response.message ??
          (response.status === "generating"
            ? `Submitted ${response.variant_count ?? 0} provider jobs. Review them from the workspace records while they complete.`
            : "Generated preview assets. Accept the ones that should enter the canonical project library.")
      );
      await useProjectStore.getState().loadProject(project.project_id);
      await onRecordsRefresh?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Generation failed");
    }
    setGenerating(false);
  };

  const runAssetAction = async (
    assetId: string,
    action: AssetAction,
    callback: () => Promise<void>,
  ) => {
    setMessage(null);
    setAssetActionById((current) => ({ ...current, [assetId]: action }));
    try {
      await callback();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Asset update failed");
    } finally {
      setAssetActionById((current) => ({ ...current, [assetId]: undefined }));
    }
  };

  const handleAcceptanceUpdate = async (
    assetId: string,
    acceptanceState: AcceptanceState,
  ) => {
    if (!project) return;
    const action = acceptanceState === "rejected" ? "reject" : "accept";
    await runAssetAction(assetId, action, async () => {
      const response = await api.keycaps.updateAcceptance(
        project.project_id,
        assetId,
        acceptanceState,
        project.revision,
      );
      setMessage(
        `Asset ${response.asset_id} is now ${response.acceptance_state.replace(/_/g, " ")} at revision r${response.revision}.`,
      );
      await useProjectStore.getState().loadProject(project.project_id);
      await onRecordsRefresh?.();
    });
  };

  const handleApply = async (assetId: string) => {
    if (!project) return;
    await runAssetAction(assetId, "apply", async () => {
      const response = await api.keycaps.apply(
        project.project_id,
        assetId,
        project.revision,
      );
      setMessage(
        `Applied ${response.asset_id} to ${response.applied_to} controls at revision r${response.revision}.`,
      );
      await useProjectStore.getState().loadProject(project.project_id);
      await onRecordsRefresh?.();
    });
  };

  const activeProviders = providers.filter((provider) =>
    provider.supported_asset_types.includes("keycap"),
  );

  const renderAssetCard = (
    asset: KeycapAsset,
    section: "review" | "library" | "rejected",
  ) => {
    const pendingAction = assetActionById[asset.asset_id];
    const isApplied = appliedAssetIds.has(asset.asset_id);
    return (
      <div
        key={asset.asset_id}
        className="glass glass-soft rounded-xl overflow-hidden"
      >
        <div
          className="h-20 flex items-center justify-center"
          style={{ background: hashGradient(asset.asset_id + (asset.prompt ?? "")) }}
        >
          <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm" />
        </div>
        <div className="p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] text-zinc-300 truncate">
                {asset.prompt ?? asset.asset_id}
              </div>
              <div className="text-[11px] text-zinc-600 mt-1">
                {(asset.provider ?? asset.source).replace(/_/g, " ")} •{" "}
                {asset.normalized ? "normalized" : "raw"}
              </div>
            </div>
            <span
              className={`shrink-0 px-2 py-1 rounded-full border text-[10px] uppercase tracking-[0.08em] ${stateTone(asset.acceptance_state)}`}
            >
              {stateLabel(asset.acceptance_state)}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isApplied && (
              <span className="text-[10px] uppercase tracking-[0.08em] text-emerald-400">
                Applied
              </span>
            )}
            {asset.watertight && (
              <span className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">
                Watertight
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {section === "review" && (
              <>
                <button
                  onClick={() => handleAcceptanceUpdate(asset.asset_id, "accepted")}
                  disabled={!!pendingAction}
                  className="flex-1 h-9 rounded-lg text-[12px] font-medium bg-white text-[#050507] hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600"
                >
                  {pendingAction === "accept" ? "Accepting..." : "Accept"}
                </button>
                <button
                  onClick={() => handleAcceptanceUpdate(asset.asset_id, "rejected")}
                  disabled={!!pendingAction}
                  className="glass-chip h-9 px-3 rounded-lg text-[12px] font-medium text-zinc-300 disabled:opacity-50"
                >
                  {pendingAction === "reject" ? "Rejecting..." : "Reject"}
                </button>
              </>
            )}
            {section === "library" && (
              <button
                onClick={() => handleApply(asset.asset_id)}
                disabled={!!pendingAction}
                className="w-full h-9 rounded-lg text-[12px] font-medium bg-white text-[#050507] hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600"
              >
                {pendingAction === "apply" ? "Applying..." : isApplied ? "Reapply to controls" : "Apply to controls"}
              </button>
            )}
            {section === "rejected" && (
              <button
                onClick={() => handleAcceptanceUpdate(asset.asset_id, "accepted")}
                disabled={!!pendingAction}
                className="glass-chip w-full h-9 rounded-lg text-[12px] font-medium text-zinc-300 disabled:opacity-50"
              >
                {pendingAction === "accept" ? "Restoring..." : "Restore to library"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-8">
        <h3 className="text-[16px] font-semibold text-white mb-1.5">Appearance Assets</h3>
        <p className="text-[13px] text-zinc-500 leading-[1.6]">
          Generate cosmetic caps and surface variants, review them, then explicitly
          accept the ones that should become part of the canonical project.
        </p>
      </div>

      <div className="mb-5">
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setSelectedPreset(null);
          }}
          placeholder="weathered brass with subtle patina..."
          rows={3}
          className="glass-input w-full rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-zinc-600 focus:outline-none resize-none transition-colors"
        />
      </div>

      <div className="mb-6">
        <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-3">
          Presets
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                setSelectedPreset(preset.id);
                setPrompt("");
              }}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-full transition-all ${
                selectedPreset === preset.id
                  ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/25"
                  : "glass-chip text-zinc-500 border-white/[0.06] hover:text-zinc-300"
              } border capitalize`}
            >
              {preset.id}
            </button>
          ))}
        </div>
      </div>

      {activeProviders.length > 0 && (
        <div className="mb-6">
          <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-3">
            Provider
          </div>
          <div className="space-y-2">
            {activeProviders.map((provider) => {
              const selectable = provider.status === "enabled" || provider.status === "fallback";
              const selected = selectedProvider === provider.id;
              return (
                <button
                  key={provider.id}
                  onClick={() => selectable && setSelectedProvider(provider.id)}
                  disabled={!selectable}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    selected
                      ? "bg-indigo-500/8 border-indigo-500/25"
                      : "glass glass-soft border-white/[0.08]"
                  } ${selectable ? "hover:border-white/[0.08]" : "opacity-50 cursor-not-allowed"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-zinc-300">{provider.display_name}</span>
                    <span
                      className={`text-[10px] uppercase tracking-[0.08em] ${
                        provider.status === "enabled"
                          ? "text-emerald-400"
                          : provider.status === "fallback"
                            ? "text-amber-400"
                            : "text-zinc-600"
                      }`}
                    >
                      {provider.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-600 mt-1">{provider.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={generating || (!prompt && !selectedPreset)}
        className="w-full h-10 text-[13px] font-medium rounded-xl transition-all mb-6 bg-white text-[#050507] hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600"
      >
        {generating ? "Generating..." : "Generate Preview Assets"}
      </button>

      {message && (
        <div className="glass glass-soft text-[12px] mb-6 px-4 py-3 rounded-xl text-zinc-500">
          {message}
        </div>
      )}

      {reviewAssets.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em]">
              Review Queue
            </div>
            <div className="text-[11px] text-zinc-600">
              Accept before these can be applied canonically.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {reviewAssets.map((asset) => renderAssetCard(asset, "review"))}
          </div>
        </div>
      )}

      {acceptedAssets.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em]">
              Project Library
            </div>
            <div className="text-[11px] text-zinc-600">
              Accepted assets available to apply to the canonical layout.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {acceptedAssets.map((asset) => renderAssetCard(asset, "library"))}
          </div>
        </div>
      )}

      {rejectedAssets.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em]">
              Rejected
            </div>
            <div className="text-[11px] text-zinc-600">
              Rejected assets stay visible for provenance but stay out of the library.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {rejectedAssets.map((asset) => renderAssetCard(asset, "rejected"))}
          </div>
        </div>
      )}
    </div>
  );
}
