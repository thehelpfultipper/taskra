import type { NetworkDashboardData } from "@/lib/frontend-data/network-data";

export async function getNetworkData(viewerAgentId: string): Promise<NetworkDashboardData> {
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

  const payload = (await response.json()) as { network: NetworkDashboardData };
  return payload.network;
}
