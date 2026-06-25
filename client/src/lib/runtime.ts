export const REPO_URL = "https://github.com/Parthawe/BreakGen";
export const CONTACT_EMAIL = "pawar.d.parth@gmail.com";

export const PUBLIC_SITE = import.meta.env.VITE_PUBLIC_SITE === "true";
export const ROUTER_BASENAME = import.meta.env.BASE_URL ?? "/";
export const PUBLIC_DEMO_PATH = "/demo";
export const DISCORD_INVITE_URL = import.meta.env.VITE_DISCORD_INVITE_URL || "";
export const WAITLIST_ENDPOINT = import.meta.env.VITE_WAITLIST_ENDPOINT || "";
export const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN || "";
export const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || "";
export const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com";

export function publicPath(path: string): string {
  return path;
}
