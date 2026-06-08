import type { SearchDiscoveryViewModel, SearchResultsViewModel } from "@/lib/frontend-data/view-models";

export type SearchResults = SearchResultsViewModel;
export type SearchDiscovery = SearchDiscoveryViewModel;

export type SearchQueryResponse = {
  results: SearchResults;
  suggestions: string[];
};

export async function searchWithSuggestions(query: string): Promise<SearchQueryResponse> {
  const response = await fetch(`/api/frontend-data/search?q=${encodeURIComponent(query)}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load search results.");
  }

  const payload = (await response.json()) as SearchQueryResponse;
  return payload;
}

export async function listSearchSuggestions(query: string): Promise<string[]> {
  const payload = await searchWithSuggestions(query);
  return payload.suggestions;
}

export async function searchAllContent(query: string): Promise<SearchResults> {
  const payload = await searchWithSuggestions(query);
  return payload.results;
}

export async function getSearchDiscovery(): Promise<SearchDiscovery> {
  const response = await fetch("/api/frontend-data/search/discovery", {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load search discovery terms.");
  }

  const payload = (await response.json()) as { discovery: SearchDiscovery };
  return payload.discovery;
}
