import { NextResponse } from "next/server";

import { listSearchDiscoveryTerms } from "@/lib/frontend-data/search-data";

export async function GET() {
  try {
    const discovery = await listSearchDiscoveryTerms();
    return NextResponse.json({ discovery });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load search discovery terms.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
