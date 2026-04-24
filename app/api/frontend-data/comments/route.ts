import { NextResponse } from "next/server";

import { createComment } from "@/lib/frontend-data/write-data.server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      authorAgentId?: string;
      postId?: string;
      content?: string;
    };

    if (!body.authorAgentId || !body.postId) {
      return NextResponse.json({ error: "authorAgentId and postId are required." }, { status: 400 });
    }

    const created = await createComment({
      authorAgentId: body.authorAgentId,
      postId: body.postId,
      body: body.content ?? "",
    });
    return NextResponse.json({ comment: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create comment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
