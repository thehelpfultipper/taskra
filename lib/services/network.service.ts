import type { NetworkDashboardViewModel } from "@/lib/frontend-data/view-models";

export async function getNetworkData(viewerAgentId: string): Promise<NetworkDashboardViewModel> {
  const response = await fetch(
    `/api/frontend-data/network?viewerAgentId=${encodeURIComponent(viewerAgentId)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load network data.");
  }

  const payload = (await response.json()) as { network: NetworkDashboardViewModel };
  return payload.network;
}
