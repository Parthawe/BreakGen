import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EvidencePanel } from "./EvidencePanel";

const mocks = vi.hoisted(() => ({
  evidence: vi.fn(),
  downloadArtifact: vi.fn(),
}));

vi.mock("../../lib/api", () => ({
  api: {
    records: {
      evidence: mocks.evidence,
      downloadArtifact: mocks.downloadArtifact,
    },
  },
}));

describe("EvidencePanel", () => {
  it("renders artifact hashes and export caveats from the evidence ledger", async () => {
    mocks.evidence.mockResolvedValueOnce({
      project_id: "bg_test",
      current_revision: 2,
      missing_outputs: [
        "Gerbers, drill files, and PCB assembly outputs are not generated yet.",
      ],
      events: [
        {
          event_id: "artifact-bundle_abc",
          event_type: "export_bundle",
          revision: 2,
          created_at: "2026-07-06T12:00:00Z",
          title: "Export Bundle",
          summary: "Review-ready evidence bundle; not a complete fabrication package.",
          readiness: "review_ready",
          validation_report: null,
          jobs: [],
          artifacts: [
            {
              artifact_id: "bundle_abc",
              kind: "export_bundle",
              artifact_role: "export_bundle",
              revision: 2,
              source_revision: 2,
              file_name: "bundle_abc.zip",
              sha256: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              short_sha256: "1234567890ab",
              content_type: "application/zip",
              acceptance_state: "review_ready",
              producer_id: "export_bundler",
              created_at: "2026-07-06T12:00:00Z",
            },
          ],
        },
      ],
    });

    render(<EvidencePanel projectId="bg_test" />);

    expect(screen.getByText(/loading evidence ledger/i)).toBeVisible();

    await waitFor(() => {
      expect(screen.getByText("1234567890ab")).toBeVisible();
    });
    expect(screen.getByText("bundle_abc")).toBeVisible();
    expect(screen.getByText(/not fabrication complete/i)).toBeVisible();
    expect(screen.getByText(/gerbers, drill files/i)).toBeVisible();
  });
});
