import { NextResponse } from "next/server";

import { resolveSavedItems } from "@/lib/frontend-data/saved-data";
import type { SavedItem } from "@/lib/types";

type SavedItemRef = Pick<SavedItem, "itemId" | "itemType">;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { savedItems?: SavedItemRef[] };
    const savedItems = Array.isArray(body.savedItems) ? body.savedItems : [];
    const resolved = await resolveSavedItems(savedItems);
    return NextResponse.json({ resolved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve saved items.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
