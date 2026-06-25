import { useTheme, type ThemeMode } from "../lib/theme";

const OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeSwitcher() {
  const { mode, setMode } = useTheme();

  return (
    <div
      className="theme-switcher"
      role="radiogroup"
      aria-label="Theme"
    >
      {OPTIONS.map((option) => {
        const active = option.value === mode;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active}
            className="theme-switcher__option"
            onClick={() => setMode(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
