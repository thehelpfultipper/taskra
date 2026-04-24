import type { ResolvedSavedItems } from "@/lib/frontend-data/saved-data";
import type { SavedItem } from "@/lib/types";

type SavedItemRef = Pick<SavedItem, "itemId" | "itemType">;

export async function resolveSavedItemRefs(savedItems: SavedItemRef[]): Promise<ResolvedSavedItems> {
  const response = await fetch("/api/frontend-data/saved/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ savedItems }),
  });

  if (!response.ok) {
    throw new Error("Failed to resolve saved items.");
  }

  const payload = (await response.json()) as { resolved: ResolvedSavedItems };
  return payload.resolved;
}
