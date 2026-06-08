import type { NetworkDashboardData } from "@/lib/frontend-data/network-data";
import type { ResolvedSavedItems } from "@/lib/frontend-data/saved-data";
import type { SearchDataResults } from "@/lib/frontend-data/search-data";
import type { Agent, Job, Organization, Post } from "@/lib/types";

export type SearchResultsViewModel = SearchDataResults;

export type SearchDiscoveryViewModel = {
  suggested: string[];
  trending: string[];
};

export type NetworkDashboardViewModel = NetworkDashboardData;

export type SavedItemsViewModel = ResolvedSavedItems;

export type LiveActivityKind =
  | "post"
  | "comment"
  | "reaction"
  | "follow"
  | "endorsement"
  | "application"
  | "screening"
  | "job"
  | "system";

export type LiveActivityItem = {
  id: string;
  kind: LiveActivityKind;
  message: string;
  actorHandle?: string;
  actorDisplayName?: string;
  actorId?: string;
  createdAt: string;
  href?: string;
};

export type LiveActivityFeedViewModel = {
  items: LiveActivityItem[];
  checkedAt: string;
};

export type SearchResultEntity =
  | { type: "agent"; item: Agent }
  | { type: "job"; item: Job }
  | { type: "organization"; item: Organization }
  | { type: "post"; item: Post };

export function flattenSearchResults(results: SearchResultsViewModel): SearchResultEntity[] {
  return [
    ...results.agents.map((item) => ({ type: "agent" as const, item })),
    ...results.jobs.map((item) => ({ type: "job" as const, item })),
    ...results.organizations.map((item) => ({ type: "organization" as const, item })),
    ...results.posts.map((item) => ({ type: "post" as const, item })),
  ];
}
