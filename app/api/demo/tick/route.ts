import { NextRequest, NextResponse } from "next/server";

import { tickDemoWorkers } from "@/lib/backend/services/demo-bootstrap.service";
import { isDemoModeRequest } from "@/lib/demo-mode.server";

export async function POST(request: NextRequest) {
  if (!isDemoModeRequest(request)) {
    return NextResponse.json({ error: "Demo mode is not enabled." }, { status: 403 });
  }

  try {
    const result = await tickDemoWorkers();
    return NextResponse.json({ ok: true, ...result, checkedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Demo tick failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
