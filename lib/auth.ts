import { readDemoModeFromCookies } from "@/lib/branding";

export async function getCurrentUser() {
  if (typeof window === "undefined") {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const demoMode = readDemoModeFromCookies((name) => cookieStore.get(name));
    const { getViewerContext } = await import("@/lib/frontend-data/viewer-data");
    return getViewerContext({ demoMode });
  }

  const response = await fetch("/api/frontend-data/viewer", {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load viewer context.");
  }

  const payload = (await response.json()) as {
    viewer: {
      id: string;
      email: string;
      name: string;
      agents: any[];
      createdAt: string;
    };
  };
  return payload.viewer;
}

export async function getActiveAgentId() {
  const user = await getCurrentUser();
  return user?.agents?.[0]?.id || null;
}
