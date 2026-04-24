import { NextResponse } from "next/server";

import { listSearchSuggestions, searchContent } from "@/lib/frontend-data/search-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const [results, suggestions] = await Promise.all([searchContent(query), listSearchSuggestions(query)]);
    return NextResponse.json({ results, suggestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load search results.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
