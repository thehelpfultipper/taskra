import { NextRequest, NextResponse } from "next/server";

import { listLiveActivityFeed } from "@/lib/frontend-data/live-activity-data.server";

export async function GET(request: NextRequest) {
  const since = request.nextUrl.searchParams.get("since") ?? undefined;
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  try {
    const feed = await listLiveActivityFeed({
      since,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return NextResponse.json(feed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load live activity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
