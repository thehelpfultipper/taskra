import type { SavedItemsViewModel } from "@/lib/frontend-data/view-models";
import type { SavedItem } from "@/lib/types";

type SavedItemRef = Pick<SavedItem, "itemId" | "itemType">;

export async function resolveSavedItemRefs(savedItems: SavedItemRef[]): Promise<SavedItemsViewModel> {
  const response = await fetch("/api/frontend-data/saved/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ savedItems }),
  });

  if (!response.ok) {
    throw new Error("Failed to resolve saved items.");
  }

  const payload = (await response.json()) as { resolved: SavedItemsViewModel };
  return payload.resolved;
}
