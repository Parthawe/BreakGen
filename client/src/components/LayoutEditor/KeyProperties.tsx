import type { KeySpec, StabilizerType } from "../../types/project";

interface Props {
  keySpec: KeySpec;
  onUpdate: (updates: Partial<KeySpec>) => void;
  onDelete: () => void;
}

export function KeyProperties({ keySpec, onUpdate, onDelete }: Props) {
  return (
    <div className="w-64 shrink-0 ml-4 rounded-2xl overflow-y-auto flex flex-col bg-[#0b0b0f] border border-white/[0.04]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.04]">
        <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-1">Properties</div>
        <div className="text-[13px] font-mono text-zinc-400">{keySpec.id}</div>
      </div>

      <div className="p-5 space-y-5 flex-1">
        {/* Label */}
        <Field label="Label">
          <input type="text" value={keySpec.label} onChange={(e) => onUpdate({ label: e.target.value })}
            className="w-full h-9 rounded-xl px-3 text-[13px] bg-white/[0.03] border border-white/[0.06] text-white focus:outline-none focus:border-indigo-500/30 transition-colors" />
        </Field>

        {/* Position */}
        <div>
          <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-3">Position</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="X"><Num value={keySpec.x_u} step={0.25} onChange={(v) => onUpdate({ x_u: v })} /></Field>
            <Field label="Y"><Num value={keySpec.y_u} step={0.25} onChange={(v) => onUpdate({ y_u: v })} /></Field>
          </div>
        </div>

        {/* Size */}
        <div>
          <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em] mb-3">Size</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="W"><Num value={keySpec.w_u} step={0.25} min={0.5} onChange={(v) => onUpdate({ w_u: v })} /></Field>
            <Field label="H"><Num value={keySpec.h_u} step={0.25} min={0.5} onChange={(v) => onUpdate({ h_u: v })} /></Field>
          </div>
        </div>

        {/* Rotation */}
        <Field label="Rotation">
          <Num value={keySpec.rotation_deg} step={5} onChange={(v) => onUpdate({ rotation_deg: v })} suffix="deg" />
        </Field>

        {/* Stabilizer */}
        <Field label="Stabilizer">
          <select value={keySpec.stabilizer} onChange={(e) => onUpdate({ stabilizer: e.target.value as StabilizerType })}
            className="w-full h-9 rounded-xl px-3 text-[13px] bg-white/[0.03] border border-white/[0.06] text-white focus:outline-none focus:border-indigo-500/30 transition-colors">
            <option value="none">None</option>
            <option value="cherry">Cherry</option>
            <option value="costar">Costar</option>
          </select>
        </Field>
      </div>

      <div className="p-5 border-t border-white/[0.04]">
        <button onClick={onDelete}
          className="w-full h-9 text-[12px] font-medium rounded-xl text-red-400/70 bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 hover:text-red-400 transition-all">
          Remove Key
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
      <input type="number" value={value} step={step} min={min}
        onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
        className="w-full h-9 rounded-xl px-3 text-[13px] font-mono bg-white/[0.03] border border-white/[0.06] text-white focus:outline-none focus:border-indigo-500/30 transition-colors"
        style={{ paddingRight: suffix ? "2.5rem" : undefined }} />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">{suffix}</span>}
    </div>
  );
}
