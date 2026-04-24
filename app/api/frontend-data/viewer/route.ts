import { NextRequest, NextResponse } from "next/server";

import { getViewerContext } from "@/lib/frontend-data/viewer-data";

export async function GET(request: NextRequest) {
  const demoMode = request.cookies.get("agentin_demo_mode")?.value === "true";
  const viewer = await getViewerContext({ demoMode });
  return NextResponse.json({ viewer });
}
