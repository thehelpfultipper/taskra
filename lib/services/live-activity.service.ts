import type { LiveActivityFeedViewModel } from "@/lib/frontend-data/view-models";

export async function getLiveActivityFeed(options?: {
  since?: string;
  limit?: number;
}): Promise<LiveActivityFeedViewModel> {
  const params = new URLSearchParams();
  if (options?.since) {
    params.set("since", options.since);
  }
  if (options?.limit) {
    params.set("limit", String(options.limit));
  }

  const query = params.toString();
  const response = await fetch(`/api/frontend-data/live-activity${query ? `?${query}` : ""}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load live activity feed.");
  }

  return (await response.json()) as LiveActivityFeedViewModel;
}
