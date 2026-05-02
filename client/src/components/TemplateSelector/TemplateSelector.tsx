import { useEffect, useMemo, useState } from "react";
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

  const familySource: ProductFamilyManifest[] = families?.length
    ? families
    : [
        { domain: "control_surface", family: "keyboard", display_name: "Keyboard", description: FAMILY_META.keyboard.fallbackDesc, status: "enabled", stages: [], required_inputs: [], supported_capabilities: [], available_templates: [], editor_modules: [], supported_module_types: [] },
        { domain: "control_surface", family: "macropad", display_name: "Macro Pad", description: FAMILY_META.macropad.fallbackDesc, status: "enabled", stages: [], required_inputs: [], supported_capabilities: [], available_templates: [], editor_modules: [], supported_module_types: [] },
        { domain: "control_surface", family: "streamdeck", display_name: "Stream Deck", description: FAMILY_META.streamdeck.fallbackDesc, status: "enabled", stages: [], required_inputs: [], supported_capabilities: [], available_templates: [], editor_modules: [], supported_module_types: [] },
        { domain: "control_surface", family: "midi", display_name: "MIDI Controller", description: FAMILY_META.midi.fallbackDesc, status: "enabled", stages: [], required_inputs: [], supported_capabilities: [], available_templates: [], editor_modules: [], supported_module_types: [] },
        { domain: "control_surface", family: "gamepad", display_name: "Gamepad", description: FAMILY_META.gamepad.fallbackDesc, status: "enabled", stages: [], required_inputs: [], supported_capabilities: [], available_templates: [], editor_modules: [], supported_module_types: [] },
      ];

  const visibleFamilies = useMemo(
    () => familySource.filter((entry) => entry.domain === selectedDomain && entry.status === "enabled"),
    [familySource, selectedDomain],
  );

  useEffect(() => {
    if (!selectedFamily || !selectedDomain) return;
    setLoading(true);
    Promise.all([
      api.templates.list(selectedFamily, selectedDomain),
      api.platform.hardwareModules(selectedFamily, selectedDomain),
    ])
      .then(([templateList, moduleList]) => {
        setTemplates(templateList);
        setHardwareModules(moduleList);
      })
      .finally(() => setLoading(false));
  }, [selectedDomain, selectedFamily]);

  const handleSelectTemplate = async (templateId: string) => {
    if (!selectedFamily || !selectedDomain) return;
    await createProject(
      FAMILY_META[selectedFamily].defaultName ?? "My Project",
      templateId,
      selectedFamily,
      selectedDomain,
    );
    onSelect();
  };

  if (!selectedDomain) {
    return (
      <div className="flex items-center justify-center min-h-full p-10">
        <div className="max-w-[760px] w-full">
          <div className="text-center mb-14">
            <h2 className="text-[28px] font-bold text-white tracking-[-0.02em] mb-2">What class of device are you building?</h2>
            <p className="text-[14px] text-zinc-500">BreakGen is now organized around electronics-first product domains, not just keyboard variants.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {domainSource.map((domain) => {
              const meta = DOMAIN_META[domain.domain];
              const enabled = domain.status === "enabled" && domain.enabled_families.length > 0;
              return (
                <button
                  key={domain.domain}
                  onClick={() => enabled && setSelectedDomain(domain.domain)}
                  disabled={!enabled}
                  className={`glass text-left p-6 rounded-[20px] transition-all duration-300 group border ${
                    enabled ? "hover:-translate-y-0.5" : "opacity-50 cursor-not-allowed"
                  }`}
                  style={{ background: `linear-gradient(180deg, ${meta.color}0c 0%, transparent 100%)`, borderColor: `${meta.color}15` }}
                  onMouseEnter={(e) => { if (enabled) e.currentTarget.style.borderColor = `${meta.color}30`; }}
                  onMouseLeave={(e) => { if (enabled) e.currentTarget.style.borderColor = `${meta.color}10`; }}
                >
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-[26px]" style={{ background: `${meta.color}0a`, color: meta.color }}>
                    {meta.icon}
                  </div>
                  <h3 className="text-[16px] font-semibold text-white mb-1">{domain.display_name}</h3>
                  <p className="text-[13px] text-zinc-500 leading-[1.5]">{domain.description}</p>
                  <div className="mt-4 text-[11px] text-zinc-600">
                    {enabled ? `${domain.enabled_families.length} enabled families` : "Planned"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (!selectedFamily) {
    return (
      <div className="flex items-center justify-center min-h-full p-10">
        <div className="max-w-[760px] w-full">
          <button onClick={() => setSelectedDomain(null)} className="text-[12px] text-zinc-600 hover:text-zinc-400 mb-6 flex items-center gap-1 transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            Back to domains
          </button>
          <h2 className="text-[24px] font-bold text-white tracking-[-0.02em] mb-2">Choose a family</h2>
          <p className="text-[14px] text-zinc-500 mb-10">Families share one platform shell, but each one gets its own editor and compiler rules.</p>
          <div className="grid grid-cols-2 gap-4">
            {visibleFamilies.map((entry) => {
              const meta = FAMILY_META[entry.family];
              return (
                <button
                  key={entry.family}
                  onClick={() => setSelectedFamily(entry.family)}
                  className="glass text-left p-6 rounded-[20px] transition-all duration-300 group hover:-translate-y-0.5 border"
                  style={{ background: `linear-gradient(180deg, ${meta.color}0c 0%, transparent 100%)`, borderColor: `${meta.color}15` }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${meta.color}30`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${meta.color}10`; }}
                >
                  <div className="w-20 h-14 rounded-xl flex items-center justify-center mb-4" style={{ background: `${meta.color}0a` }}>
                    <Sil rows={meta.icon} color={meta.color} s={entry.family === "keyboard" ? 5 : 8} />
                  </div>
                  <h3 className="text-[16px] font-semibold text-white mb-1">{entry.display_name}</h3>
                  <p className="text-[13px] text-zinc-500 leading-[1.5]">{entry.description}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {entry.supported_module_types.slice(0, 3).map((type) => (
                      <span key={type} className="glass-chip px-2 py-0.5 rounded-full text-[10px] text-zinc-500">
                        {type.replaceAll("_", " ")}
                      </span>
                    ))}
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

  return (
    <div className="flex items-center justify-center min-h-full p-10">
      <div className="max-w-[620px] w-full">
        <button onClick={() => setSelectedFamily(null)} className="text-[12px] text-zinc-600 hover:text-zinc-400 mb-6 flex items-center gap-1 transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          Back to families
        </button>
        <h2 className="text-[24px] font-bold text-white tracking-[-0.02em] mb-2">Choose a template</h2>
        <p className="text-[14px] text-zinc-500 mb-6">Start with a constrained baseline, then customize the layout, assets, and electronics.</p>

        {familyManifest && (
          <div className="glass glass-soft rounded-[18px] p-4 mb-6">
            <div className="text-[11px] uppercase tracking-[0.1em] text-zinc-600 mb-3">Hardware baseline</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {(hardwareModules.length > 0 ? hardwareModules.slice(0, 6).map((module) => module.module_type) : familyManifest.supported_module_types).map((moduleType) => (
                <span key={moduleType} className="glass-chip px-2.5 py-1 rounded-full text-[11px] text-zinc-400">
                  {moduleType.replaceAll("_", " ")}
                </span>
              ))}
            </div>
            <div className="text-[12px] text-zinc-500 leading-[1.6]">
              {familyManifest.description}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 rounded-full animate-spin border-zinc-700" style={{ borderTopColor: accent }} />
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <button
                key={template.template_id}
                onClick={() => handleSelectTemplate(template.template_id)}
                className="glass glass-soft w-full text-left p-5 rounded-[18px] transition-all duration-200 flex items-center justify-between border hover:border-white/[0.12] group"
              >
                <div>
                  <h3 className="text-[15px] font-semibold text-white group-hover:text-indigo-200 transition-colors">{template.name}</h3>
                  <p className="text-[13px] text-zinc-500 mt-0.5">{template.description}</p>
                </div>
                <span className="text-[12px] font-mono text-zinc-600 shrink-0 ml-6">{template.key_count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
