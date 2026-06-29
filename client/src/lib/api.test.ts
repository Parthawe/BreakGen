import { describe, expect, it } from "vitest";

import { ApiError, extractRevisionConflict, isApiError } from "./api";

describe("api error helpers", () => {
  it("extracts revision conflict details from backend messages", () => {
    expect(
      extractRevisionConflict("Revision conflict: expected 4, current is 7"),
    ).toEqual({
      expectedRevision: 4,
      currentRevision: 7,
    });
  });

  it("returns null conflict values for unrelated errors", () => {
    expect(extractRevisionConflict("Something else failed")).toEqual({
      expectedRevision: null,
      currentRevision: null,
    });
  });

  it("identifies ApiError instances", () => {
    expect(isApiError(new ApiError(503, "unavailable", "server_error"))).toBe(
      true,
    );
    expect(isApiError(new Error("plain error"))).toBe(false);
  });
});

