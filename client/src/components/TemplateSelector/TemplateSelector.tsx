import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api } from "../../lib/api";
import type {
  HardwareModuleManifest,
  LayoutTemplate,
  ProductDomain,
  ProductDomainManifest,
  ProductFamily,
  ProductFamilyManifest,
} from "../../types/project";
import { useProjectStore } from "../../stores/projectStore";

interface TemplateSelectorProps {
  onSelect: () => void;
  domains?: ProductDomainManifest[];
  families?: ProductFamilyManifest[];
}

const DOMAIN_META: Record<ProductDomain, { color: string; icon: string; fallbackDesc: string }> = {
  control_surface: { color: "#818cf8", icon: "▦", fallbackDesc: "Controllers, instruments, and programmable tactile interfaces" },
  handheld: { color: "#14b8a6", icon: "▣", fallbackDesc: "Portable devices with displays, audio, and power systems" },
  ambient_device: { color: "#f59e0b", icon: "◉", fallbackDesc: "Lamps, speakers, sensor pods, and electronic objects" },
  wearable: { color: "#ec4899", icon: "◌", fallbackDesc: "Body-adjacent devices where shells and electronics co-design matter" },
};

const FAMILY_META: Record<ProductFamily, { color: string; icon: number[][]; fallbackDesc: string; defaultName: string }> = {
  keyboard: { color: "#818cf8", fallbackDesc: "Staggered layouts with full PCB compilation", defaultName: "My Keyboard", icon: [[1,1,1,1,1,1,1,1,1,1,1,1,1,2],[1.5,1,1,1,1,1,1,1,1,1,1,1,1,1.5],[2.25,1,1,1,1,1,1,1,1,1,1,2.75],[1.25,1.25,1.25,6.25,1.25,1.25,1.25,1.25]] },
  macropad: { color: "#4ade80", fallbackDesc: "Grid-based shortcut pads", defaultName: "My Macro Pad", icon: [[1,1,1],[1,1,1],[1,1,1]] },
  streamdeck: { color: "#fbbf24", fallbackDesc: "Wide-spaced content control surfaces", defaultName: "My Stream Deck", icon: [[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1]] },
  midi: { color: "#f472b6", fallbackDesc: "Keys, encoders, and mappings for music production", defaultName: "My MIDI Controller", icon: [[0,1,0,1,0,1,0],[1,1,1,1,1,1,1,1,1,1]] },
  gamepad: { color: "#38bdf8", fallbackDesc: "Buttons and control clusters for HID devices", defaultName: "My Gamepad", icon: [[0,1,0,1,0],[1,1,1,1,1],[0,1,0,1,0]] },
  pedal_controller: { color: "#f97316", fallbackDesc: "Foot-triggered controls", defaultName: "My Pedal Controller", icon: [[1,1],[2,2]] },
  breath_controller: { color: "#14b8a6", fallbackDesc: "Expressive breath-driven input", defaultName: "My Breath Controller", icon: [[1,3,1],[0,1,0]] },
  handheld_companion: { color: "#22c55e", fallbackDesc: "Portable display-first electronics", defaultName: "My Handheld Companion", icon: [[1,1,1,1],[1,0,0,1],[1,1,1,1]] },
  retro_handheld: { color: "#a78bfa", fallbackDesc: "Retro-inspired portable systems", defaultName: "My Retro Handheld", icon: [[1,1,1],[1,0,1],[1,1,1]] },
  desktop_speaker: { color: "#fb7185", fallbackDesc: "Speaker-first enclosure systems", defaultName: "My Desktop Speaker", icon: [[1,1],[1,1],[2,2]] },
  smart_lamp: { color: "#facc15", fallbackDesc: "Lighting with embedded controls and sensors", defaultName: "My Smart Lamp", icon: [[0,1,0],[1,1,1],[0,1,0]] },
  sensor_pod: { color: "#60a5fa", fallbackDesc: "Sensing devices with custom shells", defaultName: "My Sensor Pod", icon: [[1,1],[0,1,0],[1,1]] },
};

function Sil({ rows, color, s = 5 }: { rows: number[][]; color: string; s?: number }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: `${s * 0.3}px` }}>
      {rows.map((r, i) => (
        <div key={i} className="flex" style={{ gap: `${s * 0.3}px` }}>
          {r.map((w, j) => w > 0 ? (
            <div key={j} className="rounded-[1.5px]" style={{ width: `${w * s - s * 0.3}px`, height: `${s - s * 0.3}px`, background: color, opacity: 0.6 }} />
          ) : <div key={j} style={{ width: `${s * 0.7}px` }} />)}
        </div>
      ))}
    </div>
  );
}

function StepHeader({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="template-flow__intro">
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}

export function TemplateSelector({ onSelect, domains, families }: TemplateSelectorProps) {
  const [selectedDomain, setSelectedDomain] = useState<ProductDomain | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<ProductFamily | null>(null);
  const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
  const [hardwareModules, setHardwareModules] = useState<HardwareModuleManifest[]>([]);
  const [loading, setLoading] = useState(false);
  const createProject = useProjectStore((s) => s.createProject);

  const domainSource: ProductDomainManifest[] =
    domains?.length
      ? domains
      : Object.entries(DOMAIN_META).map(([domain, meta]) => ({
          domain: domain as ProductDomain,
          display_name: domain.replaceAll("_", " "),
          description: meta.fallbackDesc,
          enabled_families: domain === "control_surface"
            ? ["keyboard", "macropad", "streamdeck", "midi", "gamepad"]
            : [],
          status: domain === "control_surface" ? "enabled" : "planned",
        }));
  const enabledDomains = domainSource.filter(
    (domain) => domain.status === "enabled" && domain.enabled_families.length > 0,
  );

  const familySource: ProductFamilyManifest[] = families?.length
    ? families
    : [
        { domain: "control_surface", family: "keyboard", display_name: "Keyboard", description: FAMILY_META.keyboard.fallbackDesc, status: "enabled", stages: [], required_inputs: [], supported_capabilities: [], available_templates: [], editor_modules: [], supported_module_types: [] },
        { domain: "control_surface", family: "macropad", display_name: "Macro Pad", description: FAMILY_META.macropad.fallbackDesc, status: "enabled", stages: [], required_inputs: [], supported_capabilities: [], available_templates: [], editor_modules: [], supported_module_types: [] },
        { domain: "control_surface", family: "streamdeck", display_name: "Stream Deck", description: FAMILY_META.streamdeck.fallbackDesc, status: "enabled", stages: [], required_inputs: [], supported_capabilities: [], available_templates: [], editor_modules: [], supported_module_types: [] },
        { domain: "control_surface", family: "midi", display_name: "MIDI Controller", description: FAMILY_META.midi.fallbackDesc, status: "enabled", stages: [], required_inputs: [], supported_capabilities: [], available_templates: [], editor_modules: [], supported_module_types: [] },
        { domain: "control_surface", family: "gamepad", display_name: "Gamepad", description: FAMILY_META.gamepad.fallbackDesc, status: "enabled", stages: [], required_inputs: [], supported_capabilities: [], available_templates: [], editor_modules: [], supported_module_types: [] },
        { domain: "handheld", family: "handheld_companion", display_name: "Handheld Companion", description: FAMILY_META.handheld_companion.fallbackDesc, status: "proof", stages: [], required_inputs: [], supported_capabilities: [], available_templates: [], editor_modules: [], supported_module_types: [] },
      ];

  const activeDomain = selectedDomain ?? enabledDomains[0]?.domain ?? null;
  const visibleFamilies = useMemo(
    () => familySource.filter((entry) => entry.domain === activeDomain && entry.status === "enabled"),
    [familySource, activeDomain],
  );

  useEffect(() => {
    if (!activeDomain) return;
    if (!selectedDomain) {
      setSelectedDomain(activeDomain);
    }
    if (!visibleFamilies.some((entry) => entry.family === selectedFamily)) {
      setSelectedFamily(visibleFamilies[0]?.family ?? null);
    }
  }, [activeDomain, selectedDomain, selectedFamily, visibleFamilies]);

  useEffect(() => {
    if (!selectedFamily || !activeDomain) return;
    setLoading(true);
    Promise.all([
      api.templates.list(selectedFamily, activeDomain),
      api.platform.hardwareModules(selectedFamily, activeDomain),
    ])
      .then(([templateList, moduleList]) => {
        setTemplates(templateList);
        setHardwareModules(moduleList);
      })
      .finally(() => setLoading(false));
  }, [activeDomain, selectedFamily]);

  const handleSelectTemplate = async (templateId: string) => {
    if (!selectedFamily || !activeDomain) return;
    await createProject(
      FAMILY_META[selectedFamily].defaultName ?? "My Project",
      templateId,
      selectedFamily,
      activeDomain,
    );
    onSelect();
  };

  if (!activeDomain || !selectedFamily) {
    return (
      <div className="template-selector flex min-h-full items-center justify-center p-4 md:p-10">
        <div className="template-flow max-w-[760px] w-full">
          <StepHeader
            eyebrow="Product scope"
            title="Choose a live compiler path."
            copy="BreakGen starts only with families that can become real revisioned projects today. Planned domains stay visible elsewhere, not inside this creation flow."
          />
          <div className="grid gap-3 md:gap-4">
            {enabledDomains.map((domain) => {
              const meta = DOMAIN_META[domain.domain];
              return (
                <button
                  key={domain.domain}
                  onClick={() => setSelectedDomain(domain.domain)}
                  className="template-option-card glass group border text-left transition-all duration-300 hover:-translate-y-0.5"
                  style={{ background: `linear-gradient(180deg, ${meta.color}0c 0%, transparent 100%)`, borderColor: `${meta.color}15` }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${meta.color}30`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${meta.color}10`; }}
                >
                  <div className="template-option-card__icon text-[24px]" style={{ background: `${meta.color}0a`, color: meta.color }}>
                    {meta.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="mb-1 text-[16px] font-semibold text-[var(--text-primary)]">{domain.display_name}</h3>
                    <p className="text-[13px] leading-[1.55] text-[var(--text-secondary)]">{domain.description}</p>
                    <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                      {domain.enabled_families.length} live families
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const familyManifest = familySource.find((entry) => entry.family === selectedFamily) ?? null;
  const accent = FAMILY_META[selectedFamily].color;
  const activeDomainManifest = enabledDomains.find((domain) => domain.domain === activeDomain);

  return (
    <div className="template-selector flex min-h-full items-center justify-center p-4 md:p-8">
      <div className="template-flow template-flow--matrix w-full max-w-[1180px]">
        <StepHeader
          eyebrow="New project"
          title="Pick the device, baseline, and compiler path together."
          copy="The first decision should feel like a product cockpit: domain, family, hardware modules, and starter templates stay visible before the project record is created."
        />

        <div className="template-decision-grid">
          <section className="template-decision-panel">
            <div className="template-panel-label">Domain</div>
            <div className="template-domain-list">
              {enabledDomains.map((domain) => {
                const meta = DOMAIN_META[domain.domain];
                const selected = domain.domain === activeDomain;
                return (
                  <button
                    key={domain.domain}
                    onClick={() => {
                      setSelectedDomain(domain.domain);
                      setSelectedFamily(null);
                    }}
                    className={`template-decision-button ${selected ? "is-selected" : ""}`}
                    style={{ "--template-accent": meta.color } as CSSProperties}
                  >
                    <span>{meta.icon}</span>
                    <b>{domain.display_name}</b>
                    <small>{domain.enabled_families.length} live families</small>
                  </button>
                );
              })}
            </div>
            {activeDomainManifest && (
              <p>{activeDomainManifest.description}</p>
            )}
          </section>

          <section className="template-decision-panel template-decision-panel--families">
            <div className="template-panel-label">Family</div>
            <div className="template-family-list">
              {visibleFamilies.map((entry) => {
                const meta = FAMILY_META[entry.family];
                const selected = entry.family === selectedFamily;
                return (
                  <button
                    key={entry.family}
                    onClick={() => setSelectedFamily(entry.family)}
                    aria-label={`Choose ${entry.display_name}`}
                    className={`template-family-button ${selected ? "is-selected" : ""}`}
                    style={{ "--template-accent": meta.color } as CSSProperties}
                  >
                    <div className="template-family-button__icon">
                      <Sil rows={meta.icon} color={meta.color} s={entry.family === "keyboard" ? 3.9 : 6.6} />
                    </div>
                    <div>
                      <b>{entry.display_name}</b>
                      <span>{entry.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="template-decision-panel template-decision-panel--templates">
            <div className="template-panel-label">Starter baseline</div>
            {familyManifest && (
              <div className="template-baseline">
                <div className="template-baseline__top">
                  <span style={{ background: accent }} />
                  <b>{familyManifest.display_name}</b>
                </div>
                <p>{familyManifest.description}</p>
                <div>
                  {(hardwareModules.length > 0 ? hardwareModules.slice(0, 6).map((module) => module.module_type) : familyManifest.supported_module_types).map((moduleType) => (
                    <span key={moduleType}>{moduleType.replaceAll("_", " ")}</span>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 animate-spin rounded-full border-2 border-[var(--border-default)]" style={{ borderTopColor: accent }} />
              </div>
            ) : (
              templates.length > 0 ? (
                <div className="template-template-list">
                  {templates.map((template) => (
                    <button
                      key={template.template_id}
                      onClick={() => handleSelectTemplate(template.template_id)}
                      className="template-list-button glass glass-soft group w-full border text-left transition-all duration-200 hover:border-white/[0.12]"
                    >
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">{template.name}</h3>
                        <p className="mt-0.5 text-[13px] leading-[1.5] text-[var(--text-secondary)]">{template.description}</p>
                      </div>
                      <span className="ml-6 shrink-0 text-[12px] font-mono text-[var(--text-tertiary)]">{template.key_count}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="surface-panel rounded-[18px] px-5 py-4 text-[13px] leading-[1.7] text-[var(--text-secondary)]">
                  No templates are available for this family yet. Choose another live family while this compiler path is completed.
                </div>
              )
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
