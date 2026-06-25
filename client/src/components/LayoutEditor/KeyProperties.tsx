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
    <div className="layout-editor-properties glass glass-strong ml-4 flex w-72 shrink-0 flex-col overflow-y-auto rounded-2xl">
      <div className="px-5 py-4 glass-divider border-b">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Properties</div>
        <div className="flex items-center gap-2">
          <div className="text-[13px] font-mono text-[var(--text-primary)]">{element.id}</div>
          <span className="glass-chip rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            {element.element_type}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-5 p-5">
        <Field label="Label">
          <input
            type="text"
            value={element.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="glass-input h-9 w-full rounded-xl px-3 text-[13px] focus:outline-none transition-colors"
          />
        </Field>

        <Field label="Footprint">
          <input
            type="text"
            value={element.footprint_id ?? ""}
            onChange={(e) => onUpdate({ footprint_id: e.target.value || null })}
            className="glass-input h-9 w-full rounded-xl px-3 text-[13px] font-mono focus:outline-none transition-colors"
          />
        </Field>

        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Position (u)</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="X"><Num value={x_u} step={0.25} onChange={(v) => onUpdate({ x_mm: v * unitPitchMm })} /></Field>
            <Field label="Y"><Num value={y_u} step={0.25} onChange={(v) => onUpdate({ y_mm: v * unitPitchMm })} /></Field>
          </div>
        </div>

        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Size (u)</div>
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
              className="glass-input h-9 w-full rounded-xl px-3 text-[13px] focus:outline-none transition-colors"
            >
              <option value="none">None</option>
              <option value="cherry">Cherry</option>
              <option value="costar">Costar</option>
            </select>
          </Field>
        )}
      </div>

      <div className="glass-divider border-t p-5">
        <button
          onClick={onDelete}
          className="glass-danger h-9 w-full rounded-xl text-[12px] font-semibold transition-all"
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
      <label className="mb-1.5 block text-[11px] text-[var(--text-tertiary)]">{label}</label>
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
        className="glass-input h-9 w-full rounded-xl px-3 text-[13px] font-mono focus:outline-none transition-colors"
        style={{ paddingRight: suffix ? "2.5rem" : undefined }}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-tertiary)]">{suffix}</span>}
    </div>
  );
}
