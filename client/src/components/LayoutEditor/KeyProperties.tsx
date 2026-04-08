import type { KeySpec, StabilizerType } from "../../types/project";

interface KeyPropertiesProps {
  keySpec: KeySpec;
  onUpdate: (updates: Partial<KeySpec>) => void;
  onDelete: () => void;
}

export function KeyProperties({ keySpec, onUpdate, onDelete }: KeyPropertiesProps) {
  return (
    <div className="w-56 border-l border-neutral-800 p-4 space-y-4 overflow-y-auto bg-neutral-950/50">
      <div>
        <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
          Key Properties
        </h3>
        <div className="text-sm text-white font-mono mb-3">{keySpec.id}</div>
      </div>

      {/* Label */}
      <Field label="Label">
        <input
          type="text"
          value={keySpec.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white focus:border-indigo-500 focus:outline-none"
        />
      </Field>

      {/* Position */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="X (u)">
          <NumberInput
            value={keySpec.x_u}
            step={0.25}
            onChange={(v) => onUpdate({ x_u: v })}
          />
        </Field>
        <Field label="Y (u)">
          <NumberInput
            value={keySpec.y_u}
            step={0.25}
            onChange={(v) => onUpdate({ y_u: v })}
          />
        </Field>
      </div>

      {/* Size */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Width (u)">
          <NumberInput
            value={keySpec.w_u}
            step={0.25}
            min={0.5}
            onChange={(v) => onUpdate({ w_u: v })}
          />
        </Field>
        <Field label="Height (u)">
          <NumberInput
            value={keySpec.h_u}
            step={0.25}
            min={0.5}
            onChange={(v) => onUpdate({ h_u: v })}
          />
        </Field>
      </div>

      {/* Rotation */}
      <Field label="Rotation (deg)">
        <NumberInput
          value={keySpec.rotation_deg}
          step={5}
          onChange={(v) => onUpdate({ rotation_deg: v })}
        />
      </Field>

      {/* Stabilizer */}
      <Field label="Stabilizer">
        <select
          value={keySpec.stabilizer}
          onChange={(e) =>
            onUpdate({ stabilizer: e.target.value as StabilizerType })
          }
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="none">None</option>
          <option value="cherry">Cherry</option>
          <option value="costar">Costar</option>
        </select>
      </Field>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="w-full mt-4 px-3 py-1.5 text-xs text-red-400 border border-red-900/50 rounded hover:bg-red-950/30 transition-colors"
      >
        Delete Key
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  step = 1,
  min,
  onChange,
}: {
  value: number;
  step?: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      min={min}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) onChange(v);
      }}
      className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white font-mono focus:border-indigo-500 focus:outline-none"
    />
  );
}
