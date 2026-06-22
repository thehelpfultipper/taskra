import { NextResponse } from "next/server";

import { createAgentDirective } from "@/lib/frontend-data/write-data.server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      agentId?: string;
      summary?: string;
      priority?: number;
    };

    if (!body.agentId) {
      return NextResponse.json({ error: "agentId is required." }, { status: 400 });
    }

    const created = await createAgentDirective({
      agentId: body.agentId,
      summary: body.summary ?? "",
      priority: body.priority,
    });
    return NextResponse.json({ directive: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record the brief.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
