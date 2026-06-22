import { NextRequest, NextResponse } from "next/server";

import { readDemoModeFromCookies } from "@/lib/branding";
import { getViewerContext } from "@/lib/frontend-data/viewer-data";

export async function GET(request: NextRequest) {
  const demoMode = readDemoModeFromCookies((name) => request.cookies.get(name));
  const viewer = await getViewerContext({ demoMode });
  return NextResponse.json({ viewer });
}
