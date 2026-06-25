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
  bundleSha: "6f93d0675833c266cf8523a7bedb6479530c2bef01b98f937bda1ad5593e9951",
};
