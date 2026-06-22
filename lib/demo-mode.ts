import Cookies from "js-cookie";

import {
  DEMO_ACTIVITY_EVENT,
  DEMO_BOOTSTRAP_SESSION_KEY,
  DEMO_MODE_COOKIE,
  isDemoModeCookieValue,
  LEGACY_DEMO_ACTIVITY_EVENT,
  LEGACY_DEMO_BOOTSTRAP_SESSION_KEY,
  LEGACY_DEMO_MODE_COOKIE,
} from "@/lib/branding";

export {
  DEMO_ACTIVITY_EVENT,
  DEMO_BOOTSTRAP_SESSION_KEY,
  DEMO_MODE_COOKIE,
  LEGACY_DEMO_ACTIVITY_EVENT,
} from "@/lib/branding";

export function isDemoModeEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    isDemoModeCookieValue(Cookies.get(DEMO_MODE_COOKIE)) ||
    isDemoModeCookieValue(Cookies.get(LEGACY_DEMO_MODE_COOKIE))
  );
}

export function isDemoBootstrapped(): boolean {
  if (typeof sessionStorage === "undefined") {
    return false;
  }
  return (
    sessionStorage.getItem(DEMO_BOOTSTRAP_SESSION_KEY) === "true" ||
    sessionStorage.getItem(LEGACY_DEMO_BOOTSTRAP_SESSION_KEY) === "true"
  );
}

export function setDemoModeCookie(enabled: boolean): void {
  if (enabled) {
    Cookies.set(DEMO_MODE_COOKIE, "true", { expires: 7, path: "/", sameSite: "Lax" });
    Cookies.remove(LEGACY_DEMO_MODE_COOKIE, { path: "/" });
    sessionStorage.removeItem(DEMO_BOOTSTRAP_SESSION_KEY);
    sessionStorage.removeItem(LEGACY_DEMO_BOOTSTRAP_SESSION_KEY);
    return;
  }
  Cookies.remove(DEMO_MODE_COOKIE, { path: "/" });
  Cookies.remove(LEGACY_DEMO_MODE_COOKIE, { path: "/" });
  sessionStorage.removeItem(DEMO_BOOTSTRAP_SESSION_KEY);
  sessionStorage.removeItem(LEGACY_DEMO_BOOTSTRAP_SESSION_KEY);
}

export function subscribeDemoActivity(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(DEMO_ACTIVITY_EVENT, listener);
  window.addEventListener(LEGACY_DEMO_ACTIVITY_EVENT, listener);
  return () => {
    window.removeEventListener(DEMO_ACTIVITY_EVENT, listener);
    window.removeEventListener(LEGACY_DEMO_ACTIVITY_EVENT, listener);
  };
}
