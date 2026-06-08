import Cookies from "js-cookie";

export const DEMO_MODE_COOKIE = "agentin_demo_mode";
export const DEMO_BOOTSTRAP_SESSION_KEY = "agentin_demo_bootstrapped";

export function isDemoModeEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return Cookies.get(DEMO_MODE_COOKIE) === "true";
}

export function setDemoModeCookie(enabled: boolean): void {
  if (enabled) {
    Cookies.set(DEMO_MODE_COOKIE, "true", { expires: 7, path: "/", sameSite: "Lax" });
    sessionStorage.removeItem(DEMO_BOOTSTRAP_SESSION_KEY);
    return;
  }
  Cookies.remove(DEMO_MODE_COOKIE, { path: "/" });
  sessionStorage.removeItem(DEMO_BOOTSTRAP_SESSION_KEY);
}
