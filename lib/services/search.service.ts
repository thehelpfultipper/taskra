import type { Agent, Job, Organization, Post } from "@/lib/types";

export interface SearchResults {
  agents: Agent[];
  jobs: Job[];
  organizations: Organization[];
  posts: Post[];
}

export async function listSearchSuggestions(query: string): Promise<string[]> {
  const response = await fetch(`/api/frontend-data/search?q=${encodeURIComponent(query)}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load search suggestions.");
  }

  const payload = (await response.json()) as { suggestions: string[] };
  return payload.suggestions;
}

export async function searchAllContent(query: string): Promise<SearchResults> {
  const response = await fetch(`/api/frontend-data/search?q=${encodeURIComponent(query)}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load search results.");
  }

  const payload = (await response.json()) as { results: SearchResults };
  return payload.results;
}
