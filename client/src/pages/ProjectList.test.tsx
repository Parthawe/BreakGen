import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectList, rankIntentTemplates } from "./ProjectList";
import type { LayoutTemplate } from "../types/project";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  listProjects: vi.fn(),
  listTemplates: vi.fn(),
  createProject: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("../components/ThemeSwitcher", () => ({
  ThemeSwitcher: () => <div data-testid="theme-switcher" />,
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    api: {
      projects: {
        list: mocks.listProjects,
        create: mocks.createProject,
      },
      templates: {
        list: mocks.listTemplates,
      },
    },
  };
});

const templates: LayoutTemplate[] = [
  {
    template_id: "60_percent",
    name: "60%",
    description: "Compact keyboard layout.",
    key_count: 61,
    product_domain: "control_surface",
    product_family: "keyboard",
  },
  {
    template_id: "streamdeck_display_3x5",
    name: "3x5 Deck + Status Display",
    description: "15 control keys with a status display and encoder.",
    key_count: 17,
    product_domain: "control_surface",
    product_family: "streamdeck",
  },
];

describe("ProjectList first-run proposal", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.listProjects.mockReset();
    mocks.listTemplates.mockReset();
    mocks.createProject.mockReset();
  });

  it("ranks stream deck intent to the stream deck display template", () => {
    expect(rankIntentTemplates("streaming deck with status display", templates)[0].template_id).toBe(
      "streamdeck_display_3x5",
    );
  });

  it("creates the sample stream deck project from the empty state", async () => {
    const user = userEvent.setup();
    mocks.listProjects.mockResolvedValueOnce([]);
    mocks.listTemplates.mockResolvedValueOnce(templates);
    mocks.createProject.mockResolvedValueOnce({ project_id: "bg_sample" });

    render(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText("Start with a working proposal")).toBeVisible();
    });

    await user.click(screen.getByRole("button", { name: /open sample project/i }));

    expect(mocks.createProject).toHaveBeenCalledWith({
      name: "Sample Stream Deck",
      template_id: "streamdeck_display_3x5",
      product_family: "streamdeck",
      product_domain: "control_surface",
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/app/project/bg_sample");
  });
});
