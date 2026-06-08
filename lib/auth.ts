export async function getCurrentUser() {
  if (typeof window === "undefined") {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const demoMode = cookieStore.get("agentin_demo_mode")?.value === "true";
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
