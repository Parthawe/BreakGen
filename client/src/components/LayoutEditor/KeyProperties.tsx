import type { KeySpec, StabilizerType } from "../../types/project";

interface KeyPropertiesProps {
  keySpec: KeySpec;
  onUpdate: (updates: Partial<KeySpec>) => void;
  onDelete: () => void;
}

export function KeyProperties({ keySpec, onUpdate, onDelete }: KeyPropertiesProps) {
  return (
    <div
      className="w-60 shrink-0 ml-3 rounded-xl overflow-y-auto flex flex-col"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
    >
      {/* Header */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="text-[10px] font-medium uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
          Properties
        </div>
        <div className="text-[12px] font-mono" style={{ color: "var(--text-tertiary)" }}>
          {keySpec.id}
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Label */}
        <Field label="Label">
          <Input
            type="text"
            value={keySpec.label}
            onChange={(v) => onUpdate({ label: v })}
          />
        </Field>

        {/* Position */}
        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
            Position
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="X">
              <NumInput value={keySpec.x_u} step={0.25} onChange={(v) => onUpdate({ x_u: v })} />
            </Field>
            <Field label="Y">
              <NumInput value={keySpec.y_u} step={0.25} onChange={(v) => onUpdate({ y_u: v })} />
            </Field>
          </div>
        </div>

        {/* Size */}
        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
            Size
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="W">
              <NumInput value={keySpec.w_u} step={0.25} min={0.5} onChange={(v) => onUpdate({ w_u: v })} />
            </Field>
            <Field label="H">
              <NumInput value={keySpec.h_u} step={0.25} min={0.5} onChange={(v) => onUpdate({ h_u: v })} />
            </Field>
          </div>
        </div>

        {/* Rotation */}
        <Field label="Rotation">
          <NumInput value={keySpec.rotation_deg} step={5} onChange={(v) => onUpdate({ rotation_deg: v })} suffix="deg" />
        </Field>

        {/* Stabilizer */}
        <Field label="Stabilizer">
          <select
            value={keySpec.stabilizer}
            onChange={(e) => onUpdate({ stabilizer: e.target.value as StabilizerType })}
            className="w-full rounded-lg px-3 py-2 text-[12px] focus:outline-none transition-colors"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            <option value="none">None</option>
            <option value="cherry">Cherry</option>
            <option value="costar">Costar</option>
          </select>
        </Field>
      </div>

      {/* Delete */}
      <div className="p-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <button
          onClick={onDelete}
          className="w-full py-2 text-[12px] font-medium rounded-lg transition-all duration-150"
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            color: "var(--error)",
            border: "1px solid rgba(239, 68, 68, 0.15)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)")}
        >
          Remove Key
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ type, value, onChange }: { type: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg px-3 py-2 text-[12px] focus:outline-none transition-colors"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        color: "var(--text-primary)",
      }}
    />
  );
}

function NumInput({
  value, step = 1, min, suffix, onChange,
}: {
  value: number; step?: number; min?: number; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        className="w-full rounded-lg px-3 py-2 text-[12px] font-mono focus:outline-none transition-colors"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-primary)",
          paddingRight: suffix ? "2.5rem" : "0.75rem",
        }}
      />
      {suffix && (
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px]"
          style={{ color: "var(--text-muted)" }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}
