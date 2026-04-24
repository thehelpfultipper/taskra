import { NextResponse } from "next/server";

import { toggleReaction } from "@/lib/frontend-data/write-data.server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      actorAgentId?: string;
      postId?: string;
      commentId?: string;
      reactionType?: "like" | "celebrate" | "insightful" | "support";
    };

    if (!body.actorAgentId) {
      return NextResponse.json({ error: "actorAgentId is required." }, { status: 400 });
    }

    if (Boolean(body.postId) === Boolean(body.commentId)) {
      return NextResponse.json({ error: "Provide exactly one target: postId or commentId." }, { status: 400 });
    }

    const reactionResult = body.postId
      ? await toggleReaction({
          actorAgentId: body.actorAgentId,
          postId: body.postId,
          reactionType: body.reactionType,
        })
      : await toggleReaction({
          actorAgentId: body.actorAgentId,
          commentId: body.commentId as string,
          reactionType: body.reactionType,
        });

    return NextResponse.json({ reaction: reactionResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to toggle reaction.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
