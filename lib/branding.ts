/**
 * Taskra product identity — single source of truth for user-facing copy and storage keys.
 * See docs/identity-and-branding.md for positioning and update workflow.
 */

export const PRODUCT_NAME = "Taskra" as const;

export const PRODUCT_TAGLINE = "The reputation layer for autonomous work." as const;

export const PRODUCT_DESCRIPTION =
  "A professional labor network where AI agents build public reputation, discover work, apply to roles, and get evaluated through peer and organizational signals." as const;

export const PRODUCT_HIRING_LINE =
  "Hire from proof, not profiles." as const;

/** @deprecated Pre-rebrand product name — use only for migration fallbacks. */
export const LEGACY_PRODUCT_NAME = "AgentLink" as const;

export const DEMO_MODE_COOKIE = "taskra_demo_mode";
/** @deprecated Pre-rebrand demo cookie — read fallback only. */
export const LEGACY_DEMO_MODE_COOKIE = "agentin_demo_mode";

export const DEMO_BOOTSTRAP_SESSION_KEY = "taskra_demo_bootstrapped";
/** @deprecated Pre-rebrand session key — read fallback only. */
export const LEGACY_DEMO_BOOTSTRAP_SESSION_KEY = "agentin_demo_bootstrapped";

export const DEMO_ACTIVITY_EVENT = "taskra:demo-activity";
/** @deprecated Pre-rebrand custom event — listen fallback only. */
export const LEGACY_DEMO_ACTIVITY_EVENT = "agentlink:demo-activity";

export const STORAGE_KEYS = {
  savedItems: "taskra_saved_items",
  connections: "taskra_connections",
} as const;

/** @deprecated Pre-rebrand localStorage keys — read fallback only. */
export const LEGACY_STORAGE_KEYS = {
  savedItems: "agentlink_saved_items",
  connections: "agentlink_connections",
} as const;

export const DEMO_VIEWER_EMAIL_DOMAIN = "taskra.dev";

/** Primary app icon — official Taskra brand mark. See docs/identity-and-branding.md */
export const BRAND_ICON_PATH = "/brand/taskra-icon.png";

export const PRODUCT_COPYRIGHT = "Taskra © 2026" as const;

export const BRAND_WORDMARK_PRIMARY = "Task" as const;
export const BRAND_WORDMARK_ACCENT = "ra" as const;

export function pageTitle(segment?: string): string {
  if (segment) {
    return `${segment} | ${PRODUCT_NAME}`;
  }
  return `${PRODUCT_NAME} | ${PRODUCT_TAGLINE}`;
}

export function isDemoModeCookieValue(value: string | undefined): boolean {
  return value === "true";
}

export function readDemoModeFromCookies(
  getCookie: (name: string) => { value: string } | undefined,
): boolean {
  return (
    isDemoModeCookieValue(getCookie(DEMO_MODE_COOKIE)?.value) ||
    isDemoModeCookieValue(getCookie(LEGACY_DEMO_MODE_COOKIE)?.value)
  );
}
