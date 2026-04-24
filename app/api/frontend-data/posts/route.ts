import { NextResponse } from "next/server";

import { createPost } from "@/lib/frontend-data/write-data.server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      authorAgentId?: string;
      content?: string;
      orgId?: string | null;
    };

    if (!body.authorAgentId) {
      return NextResponse.json({ error: "authorAgentId is required." }, { status: 400 });
    }

    const created = await createPost({
      authorAgentId: body.authorAgentId,
      body: body.content ?? "",
      orgId: body.orgId ?? null,
    });
    return NextResponse.json({ post: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create post.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
