import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { ActionRunway } from "../ActionRunway";
import type {
  AcceptanceState,
  GenerationProviderManifest,
  KeycapAsset,
} from "../../types/project";
import { useProjectStore } from "../../stores/projectStore";
import { useNotificationStore } from "../../stores/notificationStore";

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
      return "text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
    case "production_ready":
      return "text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 border-indigo-500/20";
    case "rejected":
      return "text-red-600 dark:text-red-300 bg-red-500/10 border-red-500/20";
    case "preview_only":
      return "text-[var(--text-secondary)] bg-[var(--surface-chip)] border-[var(--border-default)]";
    default:
      return "text-amber-600 dark:text-amber-300 bg-amber-500/10 border-amber-500/20";
  }
}

export function assetBuildStateLabel(state: AcceptanceState): string {
  switch (state) {
    case "preview_only":
    case "candidate":
      return "Proposed - not in your build";
    case "accepted":
    case "production_ready":
      return "In your build";
    case "rejected":
      return "Rejected - kept for provenance";
    default:
      return String(state).replace(/_/g, " ");
  }
}

export function assetProviderLabel(provider: string | null | undefined, source: string): string {
  const id = provider ?? source;
  if (id === "meshy") return "AI generated";
  if (id === "shell_library") return "Deterministic library";
  return id.replace(/_/g, " ");
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
  const notify = useNotificationStore((s) => s.notify);

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
      notify({
        tone: response.status === "generating" ? "info" : "success",
        title: response.status === "generating" ? "Generation queued" : "Preview assets generated",
        message:
          response.status === "generating"
            ? `${response.variant_count ?? 0} provider jobs are attached to this project.`
            : "Review the candidate assets before applying them to the layout.",
      });
      await useProjectStore.getState().loadProject(project.project_id);
      await onRecordsRefresh?.();
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Generation failed";
      setMessage(detail);
      notify({ tone: "error", title: "Generation failed", message: detail });
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
      const detail = e instanceof Error ? e.message : "Asset update failed";
      setMessage(detail);
      notify({ tone: "error", title: "Asset update failed", message: detail });
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
      notify({
        tone: acceptanceState === "rejected" ? "warning" : "success",
        title: acceptanceState === "rejected" ? "Asset rejected" : "Asset accepted",
        message: `Revision r${response.revision} now records this asset as ${response.acceptance_state.replace(/_/g, " ")}.`,
      });
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
      notify({
        tone: "success",
        title: "Asset applied",
        message: `${response.applied_to} controls updated at revision r${response.revision}.`,
      });
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
              <div className="truncate text-[12px] text-[var(--text-primary)]">
                {asset.prompt ?? asset.asset_id}
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                {assetProviderLabel(asset.provider, asset.source)} -{" "}
                {asset.normalized ? "normalized" : "raw"}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold leading-[1.35] ${stateTone(asset.acceptance_state)}`}
            >
              {assetBuildStateLabel(asset.acceptance_state)}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isApplied && (
              <span className="text-[10px] uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400">
                Applied
              </span>
            )}
            {asset.watertight && (
              <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
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
                  className="surface-button-primary h-9 flex-1 rounded-lg text-[12px] font-semibold disabled:opacity-50"
                >
                  {pendingAction === "accept" ? "Accepting..." : "Accept"}
                </button>
                <button
                  onClick={() => handleAcceptanceUpdate(asset.asset_id, "rejected")}
                  disabled={!!pendingAction}
                  className="glass-chip h-9 rounded-lg px-3 text-[12px] font-medium text-[var(--text-primary)] disabled:opacity-50"
                >
                  {pendingAction === "reject" ? "Rejecting..." : "Reject"}
                </button>
              </>
            )}
            {section === "library" && (
              <button
                onClick={() => handleApply(asset.asset_id)}
                disabled={!!pendingAction}
                className="surface-button-primary h-9 w-full rounded-lg text-[12px] font-semibold disabled:opacity-50"
              >
                {pendingAction === "apply" ? "Applying..." : isApplied ? "Reapply to controls" : "Apply to controls"}
              </button>
            )}
            {section === "rejected" && (
              <button
                onClick={() => handleAcceptanceUpdate(asset.asset_id, "accepted")}
                disabled={!!pendingAction}
                className="glass-chip h-9 w-full rounded-lg text-[12px] font-medium text-[var(--text-primary)] disabled:opacity-50"
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
        <h3 className="mb-1.5 text-[16px] font-semibold text-[var(--text-primary)]">Appearance Assets</h3>
        <p className="text-[13px] leading-[1.6] text-[var(--text-secondary)]">
          Generate cosmetic caps and surface variants, review them, then explicitly
          accept the ones that should become part of the canonical project.
        </p>
        <div className="mt-4 surface-panel rounded-xl px-4 py-3 text-[12px] leading-[1.6] text-[var(--text-secondary)]">
          Appearance proposals stay outside the build until accepted. Electronics,
          validation, mechanical outputs, and exports are deterministic compiles from
          canonical project state.
        </div>
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
          className="glass-input w-full resize-none rounded-xl px-4 py-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none transition-colors"
        />
      </div>

      <div className="mb-6">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
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
                  ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/25"
                  : "glass-chip text-[var(--text-tertiary)] border-white/[0.06] hover:text-[var(--text-primary)]"
              } border capitalize`}
            >
              {preset.id}
            </button>
          ))}
        </div>
      </div>

      {activeProviders.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
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
                    <span className="text-[13px] text-[var(--text-primary)]">{provider.display_name}</span>
                    <span
                      className={`text-[10px] uppercase tracking-[0.08em] ${
                        provider.status === "enabled"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : provider.status === "fallback"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-[var(--text-tertiary)]"
                      }`}
                    >
                      {provider.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">{provider.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={generating || (!prompt && !selectedPreset)}
        className="surface-button-primary mb-6 h-10 w-full rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50"
      >
        {generating ? "Generating..." : "Generate Preview Assets"}
      </button>

      {generating && (
        <ActionRunway
          eyebrow="Appearance pipeline"
          title="Generating preview assets"
          detail="The project stays editable while candidate assets are created outside canonical state."
        />
      )}

      {message && (
        <div className="glass glass-soft mb-6 rounded-xl px-4 py-3 text-[12px] text-[var(--text-secondary)]">
          {message}
        </div>
      )}

      <div className="mb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              Review Queue
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)]">
              Accept before these can be applied canonically.
            </div>
          </div>
          {reviewAssets.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {reviewAssets.map((asset) => renderAssetCard(asset, "review"))}
            </div>
          ) : (
            <div className="surface-panel rounded-xl px-4 py-3 text-[12px] leading-[1.6] text-[var(--text-secondary)]">
              No review assets yet. Generated previews stay outside canonical project state until you explicitly accept them.
            </div>
          )}
        </div>

      <div className="mb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              Project Library
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)]">
              Accepted assets available to apply to the canonical layout.
            </div>
          </div>
          {acceptedAssets.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {acceptedAssets.map((asset) => renderAssetCard(asset, "library"))}
            </div>
          ) : (
            <div className="surface-panel rounded-xl px-4 py-3 text-[12px] leading-[1.6] text-[var(--text-secondary)]">
              No accepted assets in the canonical library yet. Accepted assets create canonical project state; preview assets do not.
            </div>
          )}
        </div>

      <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              Rejected
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)]">
              Rejected assets stay visible for provenance but stay out of the library.
            </div>
          </div>
          {rejectedAssets.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {rejectedAssets.map((asset) => renderAssetCard(asset, "rejected"))}
            </div>
          ) : (
            <div className="surface-panel rounded-xl px-4 py-3 text-[12px] leading-[1.6] text-[var(--text-secondary)]">
              No rejected assets recorded for this revision.
            </div>
          )}
        </div>
    </div>
  );
}
