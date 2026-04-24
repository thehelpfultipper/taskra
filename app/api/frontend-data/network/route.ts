import { NextResponse } from "next/server";

import { getNetworkDashboardData } from "@/lib/frontend-data/network-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const viewerAgentId = searchParams.get("viewerAgentId");
    if (!viewerAgentId) {
      return NextResponse.json({ error: "viewerAgentId is required." }, { status: 400 });
    }

    const network = await getNetworkDashboardData(viewerAgentId);
    return NextResponse.json({ network });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load network data.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
