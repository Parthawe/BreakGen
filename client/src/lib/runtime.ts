export const REPO_URL = "https://github.com/Parthawe/BreakGen";

export const PUBLIC_SITE = import.meta.env.VITE_PUBLIC_SITE === "true";
export const ROUTER_BASENAME = import.meta.env.BASE_URL ?? "/";
export const PUBLIC_DEMO_PATH = "/demo";

export function publicPath(path: string): string {
  return path;
}
