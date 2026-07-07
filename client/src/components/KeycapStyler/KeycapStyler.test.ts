import { describe, expect, it } from "vitest";

import { assetBuildStateLabel, assetProviderLabel } from "./KeycapStyler";

describe("KeycapStyler autonomy labels", () => {
  it("labels proposed and accepted assets by build inclusion", () => {
    expect(assetBuildStateLabel("candidate")).toBe("Proposed - not in your build");
    expect(assetBuildStateLabel("preview_only")).toBe("Proposed - not in your build");
    expect(assetBuildStateLabel("accepted")).toBe("In your build");
    expect(assetBuildStateLabel("production_ready")).toBe("In your build");
    expect(assetBuildStateLabel("rejected")).toBe("Rejected - kept for provenance");
  });

  it("labels provider source without hiding deterministic fallback", () => {
    expect(assetProviderLabel("meshy", "meshy")).toBe("AI generated");
    expect(assetProviderLabel("shell_library", "shell_library")).toBe("Deterministic library");
  });
});
