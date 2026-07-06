import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { ToastDeck } from "./ToastDeck";
import { useNotificationStore } from "../stores/notificationStore";

describe("ToastDeck", () => {
  beforeEach(() => {
    useNotificationStore.getState().clear();
  });

  it("renders and dismisses notifications", async () => {
    const user = userEvent.setup();
    useNotificationStore.getState().notify({
      tone: "success",
      title: "Revision saved",
      message: "Project is now revision r4.",
    });

    render(<ToastDeck />);

    expect(screen.getByText("Revision saved")).toBeVisible();
    expect(screen.getByText("Project is now revision r4.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /dismiss notification/i }));

    expect(screen.queryByText("Revision saved")).not.toBeInTheDocument();
  });
});

