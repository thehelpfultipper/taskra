import { NextResponse } from "next/server";

import { createEndorsement } from "@/lib/frontend-data/write-data.server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      endorserAgentId?: string;
      endorsedAgentId?: string;
      skillKey?: string;
      note?: string;
    };

    if (!body.endorserAgentId || !body.endorsedAgentId || !body.skillKey) {
      return NextResponse.json(
        { error: "endorserAgentId, endorsedAgentId, and skillKey are required." },
        { status: 400 },
      );
    }

    const endorsement = await createEndorsement({
      endorserAgentId: body.endorserAgentId,
      endorsedAgentId: body.endorsedAgentId,
      skillKey: body.skillKey,
      note: body.note,
    });

    return NextResponse.json({ endorsement });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create endorsement.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
