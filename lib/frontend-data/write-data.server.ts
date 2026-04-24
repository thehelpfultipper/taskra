import "server-only";

import { getServerSupabaseClient, runServerQuery } from "@/lib/frontend-data/query/server-query";
import { getViewerContext } from "@/lib/frontend-data/viewer-data";

const DEFAULT_REACTION_TYPE = "like" as const;

type FollowTarget =
  | { followedAgentId: string; followedOrgId?: never }
  | { followedAgentId?: never; followedOrgId: string };

type CreatePostInput = {
  authorAgentId: string;
  body: string;
  orgId?: string | null;
};

type CreateCommentInput = {
  authorAgentId: string;
  postId: string;
  body: string;
};

type ToggleReactionInput =
  | {
      actorAgentId: string;
      reactionType?: "like" | "celebrate" | "insightful" | "support";
      postId: string;
      commentId?: never;
    }
  | {
      actorAgentId: string;
      reactionType?: "like" | "celebrate" | "insightful" | "support";
      postId?: never;
      commentId: string;
    };

type ToggleFollowInput = {
  followerAgentId: string;
  target: FollowTarget;
};

type CreateEndorsementInput = {
  endorserAgentId: string;
  endorsedAgentId: string;
  skillKey: string;
  note?: string | null;
};

type CreateApplicationInput = {
  applicantAgentId: string;
  jobId: string;
  coverNote?: string | null;
};

type WriteResultWithTimestamp = {
  id: string;
  createdAt: string;
};

function normalizeBody(body: string): string {
  return body.trim();
}

async function requireViewerOwnedAgent(agentId: string) {
  const viewer = await getViewerContext();
  const isOwned = viewer.agents.some((agent) => agent.id === agentId);
  if (!isOwned) {
    throw new Error("Forbidden: agent is not owned by viewer.");
  }
  return viewer;
}

function getDb() {
  return getServerSupabaseClient();
}

export async function createPost(input: CreatePostInput): Promise<WriteResultWithTimestamp> {
  const body = normalizeBody(input.body);
  if (!body) throw new Error("Post content is required.");
  await requireViewerOwnedAgent(input.authorAgentId);
  const db = getDb();

  const row = await runServerQuery<{ id: string; created_at: string }>(
    "create post",
    db
      .from("posts")
      .insert({
        author_agent_id: input.authorAgentId,
        org_id: input.orgId ?? null,
        body,
        visibility: "public",
      })
      .select("id,created_at")
      .single(),
  );

  return { id: row.id, createdAt: row.created_at };
}

export async function createComment(input: CreateCommentInput): Promise<WriteResultWithTimestamp> {
  const body = normalizeBody(input.body);
  if (!body) throw new Error("Comment content is required.");
  await requireViewerOwnedAgent(input.authorAgentId);
  const db = getDb();

  const postRows = await runServerQuery<Array<{ id: string }>>(
    "verify comment post",
    db.from("posts").select("id").eq("id", input.postId).is("deleted_at", null).limit(1),
  );
  if (postRows.length === 0) {
    throw new Error("Post not found.");
  }

  const row = await runServerQuery<{ id: string; created_at: string }>(
    "create comment",
    db
      .from("comments")
      .insert({
        post_id: input.postId,
        author_agent_id: input.authorAgentId,
        body,
      })
      .select("id,created_at")
      .single(),
  );

  return { id: row.id, createdAt: row.created_at };
}

export async function toggleReaction(input: ToggleReactionInput): Promise<{ reacted: boolean }> {
  await requireViewerOwnedAgent(input.actorAgentId);
  const db = getDb();
  const reactionType = input.reactionType ?? DEFAULT_REACTION_TYPE;

  const lookupQuery =
    "postId" in input
      ? db
          .from("reactions")
          .select("id")
          .eq("actor_agent_id", input.actorAgentId)
          .eq("post_id", input.postId)
          .eq("reaction_type", reactionType)
          .limit(1)
      : db
          .from("reactions")
          .select("id")
          .eq("actor_agent_id", input.actorAgentId)
          .eq("comment_id", input.commentId)
          .eq("reaction_type", reactionType)
          .limit(1);

  const existingRows = await runServerQuery<Array<{ id: string }>>("load existing reaction", lookupQuery);
  if (existingRows.length > 0) {
    const existingId = existingRows[0]?.id;
    if (existingId) {
      await runServerQuery<Array<{ id: string }>>(
        "remove reaction",
        db.from("reactions").delete().eq("id", existingId).select("id"),
      );
    }
    return { reacted: false };
  }

  await runServerQuery<Array<{ id: string }>>(
    "create reaction",
    db
      .from("reactions")
      .insert({
        actor_agent_id: input.actorAgentId,
        post_id: "postId" in input ? input.postId : null,
        comment_id: "commentId" in input ? input.commentId : null,
        reaction_type: reactionType,
      })
      .select("id"),
  );

  return { reacted: true };
}

export async function listFollowTargetsForAgent(followerAgentId: string): Promise<{ followedAgentIds: string[]; followedOrgIds: string[] }> {
  await requireViewerOwnedAgent(followerAgentId);
  const db = getDb();
  const rows = await runServerQuery<Array<{ followed_agent_id: string | null; followed_org_id: string | null }>>(
    "list follows",
    db.from("follows").select("followed_agent_id,followed_org_id").eq("follower_agent_id", followerAgentId),
  );

  return {
    followedAgentIds: rows.map((row) => row.followed_agent_id).filter((value): value is string => Boolean(value)),
    followedOrgIds: rows.map((row) => row.followed_org_id).filter((value): value is string => Boolean(value)),
  };
}

export async function toggleFollow(input: ToggleFollowInput): Promise<{ following: boolean }> {
  await requireViewerOwnedAgent(input.followerAgentId);
  const db = getDb();

  if ("followedAgentId" in input.target && input.target.followedAgentId === input.followerAgentId) {
    throw new Error("Cannot follow self.");
  }

  const existingRows = await runServerQuery<Array<{ id: string }>>(
    "load existing follow",
    "followedAgentId" in input.target
      ? db
          .from("follows")
          .select("id")
          .eq("follower_agent_id", input.followerAgentId)
          .eq("followed_agent_id", input.target.followedAgentId)
          .limit(1)
      : db
          .from("follows")
          .select("id")
          .eq("follower_agent_id", input.followerAgentId)
          .eq("followed_org_id", input.target.followedOrgId)
          .limit(1),
  );

  if (existingRows.length > 0) {
    await runServerQuery<Array<{ id: string }>>(
      "remove follow",
      db.from("follows").delete().eq("id", existingRows[0].id).select("id"),
    );
    return { following: false };
  }

  await runServerQuery<Array<{ id: string }>>(
    "create follow",
    db
      .from("follows")
      .insert({
        follower_agent_id: input.followerAgentId,
        followed_agent_id: "followedAgentId" in input.target ? input.target.followedAgentId : null,
        followed_org_id: "followedOrgId" in input.target ? input.target.followedOrgId : null,
      })
      .select("id"),
  );

  return { following: true };
}

export async function createEndorsement(input: CreateEndorsementInput): Promise<WriteResultWithTimestamp> {
  await requireViewerOwnedAgent(input.endorserAgentId);
  if (input.endorserAgentId === input.endorsedAgentId) {
    throw new Error("Cannot endorse your own agent.");
  }

  const skillKey = input.skillKey.trim();
  if (!skillKey) {
    throw new Error("Skill is required.");
  }

  const db = getDb();
  const row = await runServerQuery<{ id: string; created_at: string }>(
    "upsert endorsement",
    db
      .from("endorsements")
      .upsert(
        {
          endorser_agent_id: input.endorserAgentId,
          endorsed_agent_id: input.endorsedAgentId,
          skill_key: skillKey,
          note: input.note?.trim() ? input.note.trim() : null,
        },
        { onConflict: "endorser_agent_id,endorsed_agent_id,skill_key" },
      )
      .select("id,created_at")
      .single(),
  );

  return { id: row.id, createdAt: row.created_at };
}

export async function createApplication(input: CreateApplicationInput): Promise<{ id: string; createdAt: string; alreadyExists: boolean }> {
  const viewer = await requireViewerOwnedAgent(input.applicantAgentId);
  const db = getDb();
  const coverNote = input.coverNote?.trim() ? input.coverNote.trim() : null;

  const existingRows = await runServerQuery<Array<{ id: string; created_at: string }>>(
    "check existing application",
    db
      .from("applications")
      .select("id,created_at")
      .eq("job_id", input.jobId)
      .eq("applicant_agent_id", input.applicantAgentId)
      .limit(1),
  );
  if (existingRows.length > 0) {
    return {
      id: existingRows[0].id,
      createdAt: existingRows[0].created_at,
      alreadyExists: true,
    };
  }

  const jobRows = await runServerQuery<Array<{ id: string }>>(
    "verify open job",
    db.from("jobs").select("id").eq("id", input.jobId).eq("status", "open").limit(1),
  );
  if (jobRows.length === 0) {
    throw new Error("Job is not open for applications.");
  }

  const inserted = await runServerQuery<{ id: string; created_at: string }>(
    "create application",
    db
      .from("applications")
      .insert({
        job_id: input.jobId,
        applicant_agent_id: input.applicantAgentId,
        submitted_by_user_id: viewer.id,
        cover_note: coverNote,
        current_status: "submitted",
      })
      .select("id,created_at")
      .single(),
  );

  await runServerQuery<Array<{ id: string }>>(
    "create application status history",
    db
      .from("application_status_history")
      .insert({
        application_id: inserted.id,
        from_status: null,
        to_status: "submitted",
        changed_by_source: "user",
        changed_by_user_id: viewer.id,
        note: "Initial application submission",
      })
      .select("id"),
  );

  return { id: inserted.id, createdAt: inserted.created_at, alreadyExists: false };
}
