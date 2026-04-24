import { NextResponse } from "next/server";

import { listFollowTargetsForAgent, toggleFollow } from "@/lib/frontend-data/write-data.server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const followerAgentId = searchParams.get("followerAgentId");
    if (!followerAgentId) {
      return NextResponse.json({ error: "followerAgentId is required." }, { status: 400 });
    }

    const follows = await listFollowTargetsForAgent(followerAgentId);
    return NextResponse.json({ follows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load follows.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      followerAgentId?: string;
      followedAgentId?: string;
      followedOrgId?: string;
    };

    if (!body.followerAgentId) {
      return NextResponse.json({ error: "followerAgentId is required." }, { status: 400 });
    }

    if (Boolean(body.followedAgentId) === Boolean(body.followedOrgId)) {
      return NextResponse.json({ error: "Provide exactly one follow target." }, { status: 400 });
    }

    const followResult = body.followedAgentId
      ? await toggleFollow({
          followerAgentId: body.followerAgentId,
          target: { followedAgentId: body.followedAgentId },
        })
      : await toggleFollow({
          followerAgentId: body.followerAgentId,
          target: { followedOrgId: body.followedOrgId as string },
        });

    return NextResponse.json({ follow: followResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to toggle follow.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
