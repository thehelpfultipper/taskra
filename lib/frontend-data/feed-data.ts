import { toAgentDomain, toAgentViewModel, toFeedPostDomain, toOrgDomain, toPostViewModel } from "@/lib/frontend-data/mappers";
import { getPublicSupabaseClient, runPublicQuery } from "@/lib/frontend-data/query/public-query";
import type { RawAgentRecord, RawCommentRecord, RawOrgRecord, RawPostRecord, RawReactionRecord } from "@/lib/frontend-data/types";
import type { Comment, Post } from "@/lib/types";

type FeedMode = "for-you" | "following" | "recent";

export type FeedQueryOptions = {
  mode?: FeedMode;
  viewerAgentId?: string;
  followedIds?: string[];
  limit?: number;
};

function sortByMode(posts: Post[], mode: FeedMode, followedIds: string[]): Post[] {
  if (mode === "recent") {
    return [...posts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  if (mode === "following") {
    const followed = new Set(followedIds);
    return posts.filter((post) => followed.has(post.author.id));
  }
  return [...posts].sort((a, b) => {
    const engagementA = a._count.reactions + a._count.comments;
    const engagementB = b._count.reactions + b._count.comments;
    if (engagementA !== engagementB) return engagementB - engagementA;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

async function loadFollowedAgentIds(viewerAgentId?: string): Promise<string[]> {
  if (!viewerAgentId) return [];
  const db = getPublicSupabaseClient();
  const rows = await runPublicQuery<Array<{ followed_agent_id: string | null }>>(
    "load follower graph",
    db.from("follows").select("followed_agent_id").eq("follower_agent_id", viewerAgentId),
  );
  return rows.map((row) => row.followed_agent_id).filter((value): value is string => Boolean(value));
}

async function loadFeedBaseRows(limit = 80) {
  const db = getPublicSupabaseClient();
  const [postRows, commentRows, reactionRows, agentRows, orgRows] = await Promise.all([
    runPublicQuery<RawPostRecord[]>(
      "load feed posts",
      db.from("posts").select("id,author_agent_id,org_id,body,created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(limit),
    ),
    runPublicQuery<RawCommentRecord[]>(
      "load feed comments",
      db.from("comments").select("id,post_id,author_agent_id,body,created_at").is("deleted_at", null).order("created_at", { ascending: true }).limit(limit * 8),
    ),
    runPublicQuery<RawReactionRecord[]>(
      "load feed reactions",
      db.from("reactions").select("id,post_id,actor_agent_id,reaction_type,created_at").order("created_at", { ascending: true }).limit(limit * 10),
    ),
    runPublicQuery<RawAgentRecord[]>(
      "load feed agents",
      db.from("agents").select("id,handle,display_name,bio,owner_user_id,primary_org_id,created_at"),
    ),
    runPublicQuery<RawOrgRecord[]>("load feed orgs", db.from("orgs").select("id,slug,name,created_by_user_id")),
  ]);

  return { postRows, commentRows, reactionRows, agentRows, orgRows };
}

export async function listFeedPosts(options: FeedQueryOptions = {}): Promise<Post[]> {
  const { mode = "for-you", followedIds = [], viewerAgentId, limit = 40 } = options;
  const queryLimit = Math.max(limit, 10);
  const { postRows, commentRows, reactionRows, agentRows, orgRows } = await loadFeedBaseRows(Math.max(queryLimit, 80));
  const backendFollowedIds = mode === "following" ? await loadFollowedAgentIds(viewerAgentId) : [];
  const effectiveFollowedIds = backendFollowedIds.length > 0 ? backendFollowedIds : followedIds;

  const commentsByPost = new Map<string, RawCommentRecord[]>();
  const reactionsByPost = new Map<string, RawReactionRecord[]>();
  const orgById = new Map(orgRows.map((org) => [org.id, toOrgDomain(org)]));
  const agentById = new Map(agentRows.map((agent) => [agent.id, toAgentDomain(agent)]));

  for (const comment of commentRows) {
    const bucket = commentsByPost.get(comment.post_id) ?? [];
    bucket.push(comment);
    commentsByPost.set(comment.post_id, bucket);
  }

  for (const reaction of reactionRows) {
    if (!reaction.post_id) continue;
    const bucket = reactionsByPost.get(reaction.post_id) ?? [];
    bucket.push(reaction);
    reactionsByPost.set(reaction.post_id, bucket);
  }

  const posts = postRows.map((row) => {
    const domain = toFeedPostDomain(row);
    const authorDomain = agentById.get(row.author_agent_id);
    const author = authorDomain
      ? toAgentViewModel(authorDomain)
      : toAgentViewModel({
          id: row.author_agent_id,
          handle: "unknown",
          displayName: "Unknown agent",
          bio: "",
          ownerUserId: "",
          primaryOrgId: null,
          createdAt: row.created_at,
        });

    return toPostViewModel({
      domain,
      author,
      org: row.org_id ? orgById.get(row.org_id) : undefined,
      comments: commentsByPost.get(row.id) ?? [],
      reactions: reactionsByPost.get(row.id) ?? [],
      agentsById: agentById,
    });
  });

  return sortByMode(posts, mode, effectiveFollowedIds).slice(0, queryLimit);
}

export async function listPostsByAgentHandle(handle: string): Promise<Post[]> {
  const posts = await listFeedPosts({ mode: "recent" });
  return posts.filter((post) => post.author.handle === handle);
}

export async function getFeedPostById(id: string): Promise<Post | undefined> {
  const posts = await listFeedPosts({ mode: "recent" });
  return posts.find((post) => post.id === id);
}

export async function listCommentsForPost(postId: string): Promise<Comment[]> {
  const post = await getFeedPostById(postId);
  return post?.comments ?? [];
}
