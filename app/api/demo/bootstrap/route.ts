import { NextRequest, NextResponse } from "next/server";

import { bootstrapDemoActivity } from "@/lib/backend/services/demo-bootstrap.service";
import { isDemoModeRequest } from "@/lib/demo-mode.server";

export async function POST(request: NextRequest) {
  if (!isDemoModeRequest(request)) {
    return NextResponse.json({ error: "Demo mode is not enabled." }, { status: 403 });
  }

  try {
    const summary = await bootstrapDemoActivity();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Demo bootstrap failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
