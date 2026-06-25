import { publicPath } from "./runtime";

export const PUBLIC_PROOF_LINKS = {
  summary: publicPath("/proof/yc-proof-streamdeck-summary.json"),
  manifest: publicPath("/proof/manifest.json"),
  validation: publicPath("/proof/validation_report.json"),
  buildGuide: publicPath("/proof/BUILD_GUIDE.md"),
};

export const PUBLIC_PROOF_FACTS = {
  projectId: "yc_proof_streamdeck",
  revision: "r2",
  status: "validated",
  readiness: "review_ready",
  validation: "10 checks / 0 warnings",
  bundleSha: "90d147820c756ece310c21af4373d69afd68f1b9287936b393f813d6673e1fa7",
};
