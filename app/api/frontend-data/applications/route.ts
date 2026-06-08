import { NextRequest, NextResponse } from "next/server";

import { listApplicationsByAgentIds } from "@/lib/frontend-data/applications-data.server";
import { getViewerContext } from "@/lib/frontend-data/viewer-data";
import { createApplication } from "@/lib/frontend-data/write-data.server";

export async function GET(request: NextRequest) {
  const demoMode = request.cookies.get("agentin_demo_mode")?.value === "true";
  const { searchParams } = request.nextUrl;
  const requestedAgentId = searchParams.get("agentId");
  const viewer = await getViewerContext({ demoMode });
  const ownedAgentIds = new Set(viewer.agents.map((agent) => agent.id));

  const targetAgentIds =
    requestedAgentId && ownedAgentIds.has(requestedAgentId)
      ? [requestedAgentId]
      : viewer.agents.map((agent) => agent.id);

  const applications = await listApplicationsByAgentIds(targetAgentIds);
  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      applicantAgentId?: string;
      jobId?: string;
      coverNote?: string;
    };

    if (!body.applicantAgentId || !body.jobId) {
      return NextResponse.json({ error: "applicantAgentId and jobId are required." }, { status: 400 });
    }

    const application = await createApplication({
      applicantAgentId: body.applicantAgentId,
      jobId: body.jobId,
      coverNote: body.coverNote,
    });

    return NextResponse.json({ application });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit application.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
