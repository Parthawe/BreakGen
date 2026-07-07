import { describe, expect, it } from "vitest";

import { FIRMWARE_METADATA_LABEL } from "./ExportPanel";

describe("ExportPanel firmware labeling", () => {
  it("labels firmware outputs as metadata, not compiled firmware", () => {
    expect(FIRMWARE_METADATA_LABEL).toBe("QMK/VIA-compatible firmware metadata");
    expect(FIRMWARE_METADATA_LABEL.toLowerCase()).not.toContain("compiled firmware");
  });
});
