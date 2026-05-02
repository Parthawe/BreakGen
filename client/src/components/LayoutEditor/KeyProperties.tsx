import type { PlacedElementSpec, StabilizerType } from "../../types/project";

interface Props {
  element: PlacedElementSpec;
  unitPitchMm: number;
  onUpdate: (updates: Partial<PlacedElementSpec>) => void;
  onDelete: () => void;
}

export function KeyProperties({ element, unitPitchMm, onUpdate, onDelete }: Props) {
  const x_u = element.x_mm / unitPitchMm;
  const y_u = element.y_mm / unitPitchMm;
  const w_u = element.w_mm / unitPitchMm;
  const h_u = element.h_mm / unitPitchMm;
  const showStabilizer = element.element_type === "key_switch" || element.element_type === "button";

  return (
    <div className="glass glass-strong w-72 shrink-0 ml-4 rounded-2xl overflow-y-auto flex flex-col">
      <div className="px-5 py-4 glass-divider border-b">
        <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-1">Properties</div>
        <div className="flex items-center gap-2">
          <div className="text-[13px] font-mono text-zinc-300">{element.id}</div>
          <span className="glass-chip px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.08em] text-zinc-500">
            {element.element_type}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5 flex-1">
        <Field label="Label">
          <input
            type="text"
            value={element.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="glass-input w-full h-9 rounded-xl px-3 text-[13px] text-white focus:outline-none transition-colors"
          />
        </Field>

        <Field label="Footprint">
          <input
            type="text"
            value={element.footprint_id ?? ""}
            onChange={(e) => onUpdate({ footprint_id: e.target.value || null })}
            className="glass-input w-full h-9 rounded-xl px-3 text-[13px] font-mono text-white focus:outline-none transition-colors"
          />
        </Field>

        <div>
          <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-3">Position (u)</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="X"><Num value={x_u} step={0.25} onChange={(v) => onUpdate({ x_mm: v * unitPitchMm })} /></Field>
            <Field label="Y"><Num value={y_u} step={0.25} onChange={(v) => onUpdate({ y_mm: v * unitPitchMm })} /></Field>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-3">Size (u)</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="W"><Num value={w_u} step={0.25} min={0.5} onChange={(v) => onUpdate({ w_mm: v * unitPitchMm })} /></Field>
            <Field label="H"><Num value={h_u} step={0.25} min={0.5} onChange={(v) => onUpdate({ h_mm: v * unitPitchMm })} /></Field>
          </div>
        </div>

        <Field label="Rotation">
          <Num value={element.rotation_deg} step={5} onChange={(v) => onUpdate({ rotation_deg: v })} suffix="deg" />
        </Field>

        {showStabilizer && (
          <Field label="Stabilizer">
            <select
              value={element.stabilizer}
              onChange={(e) => onUpdate({ stabilizer: e.target.value as StabilizerType })}
              className="glass-input w-full h-9 rounded-xl px-3 text-[13px] text-white focus:outline-none transition-colors"
            >
              <option value="none">None</option>
              <option value="cherry">Cherry</option>
              <option value="costar">Costar</option>
            </select>
          </Field>
        )}
      </div>

      <div className="p-5 glass-divider border-t">
        <button
          onClick={onDelete}
        className="glass-danger w-full h-9 text-[12px] font-medium rounded-xl text-red-300 hover:text-red-200 transition-all"
        >
          Remove Element
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-zinc-600 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Num({ value, step = 1, min, suffix, onChange }: { value: number; step?: number; min?: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="glass-input w-full h-9 rounded-xl px-3 text-[13px] font-mono text-white focus:outline-none transition-colors"
        style={{ paddingRight: suffix ? "2.5rem" : undefined }}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">{suffix}</span>}
    </div>
  );
}
