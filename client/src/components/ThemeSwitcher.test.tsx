import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { ThemeSwitcher } from "./ThemeSwitcher";
import { ThemeProvider } from "../lib/theme";

function renderThemeSwitcher() {
  return render(
    <ThemeProvider>
      <ThemeSwitcher />
    </ThemeProvider>,
  );
}

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  });

  it("renders as an accessible theme radiogroup", () => {
    renderThemeSwitcher();

    expect(screen.getByRole("radiogroup", { name: /theme/i })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("persists the selected theme", async () => {
    const user = userEvent.setup();
    renderThemeSwitcher();

    await user.click(screen.getByRole("radio", { name: "Light" }));

    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(window.localStorage.getItem("breakgen.theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

