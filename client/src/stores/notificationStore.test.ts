import { beforeEach, describe, expect, it } from "vitest";

import { useNotificationStore } from "./notificationStore";

describe("notificationStore", () => {
  beforeEach(() => {
    useNotificationStore.getState().clear();
  });

  it("adds newest notifications first and caps the deck", () => {
    for (let index = 0; index < 6; index += 1) {
      useNotificationStore.getState().notify({
        tone: "info",
        title: `Notice ${index}`,
      });
    }

    const items = useNotificationStore.getState().items;
    expect(items).toHaveLength(4);
    expect(items[0].title).toBe("Notice 5");
    expect(items[3].title).toBe("Notice 2");
  });

  it("dismisses a notification by id", () => {
    const id = useNotificationStore.getState().notify({
      tone: "success",
      title: "Saved",
    });

    useNotificationStore.getState().dismiss(id);

    expect(useNotificationStore.getState().items).toEqual([]);
  });
});

