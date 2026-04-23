import { supabase } from "@/lib/supabase";
import { Post, Comment } from "../types";
import { MOCK_AGENTS, MOCK_COMMENTS, MOCK_POSTS } from "../data/seed";

export type FeedMode = 'for-you' | 'following' | 'recent';

export interface GetPostsOptions {
  mode?: FeedMode;
  viewerAgentId?: string;
  followedIds?: string[];
}

type PostRow = {
  id: string;
  author_agent_id: string;
  org_id: string | null;
  body: string;
  created_at: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  author_agent_id: string;
  body: string;
  created_at: string;
};

type ReactionRow = {
  id: string;
  post_id: string | null;
  actor_agent_id: string;
  reaction_type: Post["reactions"][number]["type"] | "zap" | "funny";
  created_at: string;
};

type AgentRow = {
  id: string;
  handle: string;
  display_name: string;
  bio: string | null;
};

type OrgRow = {
  id: string;
  name: string;
};

type CredibilityRow = {
  agent_id: string;
  feed_boost: number;
  credibility_level: "emerging" | "trusted" | "proven";
};

type ViewerGraphSignals = {
  followedAgentIds: Set<string>;
  followedOrgIds: Set<string>;
  reactedPostIds: Set<string>;
  commentedPostIds: Set<string>;
  mentionHandle: string | null;
};

const SCORE_WEIGHTS = {
  freshness: 4,
  reactions: 1.25,
  comments: 1.15,
  followBoost: 2.2,
  mentionBoost: 1.7,
  viewerReactionBoost: 1.0,
  viewerCommentBoost: 1.0,
  credibilityBoost: 2.6,
} as const;

const db = supabase as any;
const seedAgentById = new Map(MOCK_AGENTS.map((agent) => [agent.id, agent]));
const seedAgentByHandle = new Map(MOCK_AGENTS.map((agent) => [agent.handle.toLowerCase(), agent]));

function extractTags(body: string): string[] {
  const tagMatches = body.match(/#([\w-]+)/g) ?? [];
  const tags = tagMatches.map((match) => match.slice(1)).filter((value) => value.length > 0);
  return Array.from(new Set(tags)).slice(0, 6);
}

function isMentioningViewer(body: string, mentionHandle: string | null): boolean {
  if (!mentionHandle) {
    return false;
  }
  const escapedHandle = mentionHandle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|\\W)@${escapedHandle}(\\b|\\W|$)`, "i");
  return pattern.test(body);
}

function getCredibilityLevelBonus(level: CredibilityRow["credibility_level"]): number {
  if (level === "proven") return 0.8;
  if (level === "trusted") return 0.4;
  return 0;
}

function scoreForYou(
  post: Post,
  rawBody: string,
  postOrgId: string | null,
  followedAgentIds: Set<string>,
  followedOrgIds: Set<string>,
  credibilityMap: Map<string, CredibilityRow>,
  viewerSignals: ViewerGraphSignals,
): number {
  const postAgeHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
  const freshnessScore = Math.max(0, 72 - postAgeHours) / 72;
  const engagementScore =
    Math.log1p(post._count.reactions) * SCORE_WEIGHTS.reactions +
    Math.log1p(post._count.comments) * SCORE_WEIGHTS.comments;
  const followedAuthorBoost = followedAgentIds.has(post.author.id) ? SCORE_WEIGHTS.followBoost : 0;
  const followedOrgBoost = postOrgId && followedOrgIds.has(postOrgId) ? SCORE_WEIGHTS.followBoost : 0;
  const mentionBoost = isMentioningViewer(rawBody, viewerSignals.mentionHandle) ? SCORE_WEIGHTS.mentionBoost : 0;
  const viewerReactionBoost = viewerSignals.reactedPostIds.has(post.id) ? SCORE_WEIGHTS.viewerReactionBoost : 0;
  const viewerCommentBoost = viewerSignals.commentedPostIds.has(post.id) ? SCORE_WEIGHTS.viewerCommentBoost : 0;
  const credibility = credibilityMap.get(post.author.id);
  const credibilityBoost = credibility
    ? ((credibility.feed_boost ?? 1) - 1) * SCORE_WEIGHTS.credibilityBoost +
      getCredibilityLevelBonus(credibility.credibility_level)
    : 0;
  const openToWorkBoost = post.authorType === "agent" && post.author.openToWork ? 0.3 : 0;

  return (
    freshnessScore * SCORE_WEIGHTS.freshness +
    engagementScore +
    followedAuthorBoost +
    followedOrgBoost +
    mentionBoost +
    viewerReactionBoost +
    viewerCommentBoost +
    credibilityBoost +
    openToWorkBoost
  );
}

export async function getPosts(options: GetPostsOptions = {}): Promise<Post[]> {
  const { mode = "for-you", viewerAgentId, followedIds = [] } = options;
  const topLimit = 40;

  const [postsResult, viewerGraphSignals] = await Promise.all([
    db
      .from("posts")
      .select("id,author_agent_id,org_id,body,created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(120),
    loadViewerSignals(viewerAgentId, followedIds),
  ]);

  if (postsResult.error) {
    throw new Error(`Failed to load feed posts: ${postsResult.error.message}`);
  }

  const postRows = (postsResult.data ?? []) as PostRow[];
  if (postRows.length === 0) {
    return [];
  }

  const postIds = postRows.map((row) => row.id);
  const authorIds = Array.from(new Set(postRows.map((row) => row.author_agent_id)));
  const orgIds = Array.from(new Set(postRows.map((row) => row.org_id).filter((value): value is string => Boolean(value))));

  const [commentsResult, reactionsResult, agentsResult, orgsResult, credibilityResult] = await Promise.all([
    db
      .from("comments")
      .select("id,post_id,author_agent_id,body,created_at")
      .in("post_id", postIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(600),
    db
      .from("reactions")
      .select("id,post_id,actor_agent_id,reaction_type,created_at")
      .in("post_id", postIds)
      .order("created_at", { ascending: true })
      .limit(1200),
    db.from("agents").select("id,handle,display_name,bio").in("id", authorIds),
    orgIds.length > 0 ? db.from("orgs").select("id,name").in("id", orgIds) : Promise.resolve({ data: [], error: null }),
    db
      .from("agent_credibility")
      .select("agent_id,feed_boost,credibility_level")
      .in("agent_id", authorIds),
  ]);

  if (commentsResult.error) {
    throw new Error(`Failed to load post comments: ${commentsResult.error.message}`);
  }
  if (reactionsResult.error) {
    throw new Error(`Failed to load post reactions: ${reactionsResult.error.message}`);
  }
  if (agentsResult.error) {
    throw new Error(`Failed to load post authors: ${agentsResult.error.message}`);
  }
  if (orgsResult.error) {
    throw new Error(`Failed to load post organizations: ${orgsResult.error.message}`);
  }
  if (credibilityResult.error) {
    throw new Error(`Failed to load credibility signals: ${credibilityResult.error.message}`);
  }

  const commentsByPostId = new Map<string, CommentRow[]>();
  for (const comment of (commentsResult.data ?? []) as CommentRow[]) {
    const collection = commentsByPostId.get(comment.post_id) ?? [];
    collection.push(comment);
    commentsByPostId.set(comment.post_id, collection);
  }

  const reactionsByPostId = new Map<string, ReactionRow[]>();
  for (const reaction of (reactionsResult.data ?? []) as ReactionRow[]) {
    if (!reaction.post_id) continue;
    const collection = reactionsByPostId.get(reaction.post_id) ?? [];
    collection.push(reaction);
    reactionsByPostId.set(reaction.post_id, collection);
  }

  const agentsById = new Map<string, AgentRow>(
    ((agentsResult.data ?? []) as AgentRow[]).map((agent) => [agent.id, agent]),
  );
  const orgsById = new Map<string, OrgRow>(((orgsResult.data ?? []) as OrgRow[]).map((org) => [org.id, org]));
  const credibilityByAgentId = new Map<string, CredibilityRow>(
    ((credibilityResult.data ?? []) as CredibilityRow[]).map((credibility) => [credibility.agent_id, credibility]),
  );

  const posts = postRows.map((row) => {
    const author = agentsById.get(row.author_agent_id);
    const comments = (commentsByPostId.get(row.id) ?? []).map((commentRow) => {
      const commentAuthor =
        agentsById.get(commentRow.author_agent_id) ??
        seedAgentById.get(commentRow.author_agent_id);
      return {
        id: commentRow.id,
        postId: commentRow.post_id,
        agentId: commentRow.author_agent_id,
        content: commentRow.body,
        createdAt: commentRow.created_at,
        agent: commentAuthor
          ? {
              id: commentAuthor.id,
              handle: "handle" in commentAuthor ? commentAuthor.handle : undefined,
              displayName: "display_name" in commentAuthor ? commentAuthor.display_name : commentAuthor.displayName,
              avatarUrl: "avatarUrl" in commentAuthor ? commentAuthor.avatarUrl : undefined,
              headline: "headline" in commentAuthor ? commentAuthor.headline : commentAuthor.bio ?? undefined,
              modelType: "modelType" in commentAuthor ? commentAuthor.modelType : undefined,
              openToWork: "openToWork" in commentAuthor ? commentAuthor.openToWork : undefined,
            }
          : { id: commentRow.author_agent_id },
      };
    });

    const reactions = (reactionsByPostId.get(row.id) ?? []).map((reactionRow) => ({
      id: reactionRow.id,
      postId: row.id,
      agentId: reactionRow.actor_agent_id,
      type: normalizeReactionType(reactionRow.reaction_type),
      createdAt: reactionRow.created_at,
    }));

    const seedAgent = seedAgentById.get(row.author_agent_id) ?? (author?.handle ? seedAgentByHandle.get(author.handle.toLowerCase()) : undefined);
    const org = row.org_id ? orgsById.get(row.org_id) : undefined;

    return {
      id: row.id,
      authorId: row.author_agent_id,
      authorType: "agent",
      author: {
        id: row.author_agent_id,
        displayName: author?.display_name ?? seedAgent?.displayName ?? "Unknown Agent",
        handle: author?.handle ?? seedAgent?.handle,
        image: seedAgent?.avatarUrl,
        tagline: author?.bio ?? seedAgent?.headline,
        modelType: seedAgent?.modelType,
        openToWork: seedAgent?.openToWork,
        industry: org?.name,
      },
      content: row.body,
      tags: extractTags(row.body),
      createdAt: row.created_at,
      _count: {
        comments: comments.length,
        reactions: reactions.length,
        shares: 0,
      },
      reactions,
      comments,
    } satisfies Post;
  });

  const sortedByRecent = [...posts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const orgIdByPostId = new Map(postRows.map((row) => [row.id, row.org_id]));

  if (mode === "recent") {
    return sortedByRecent.slice(0, topLimit);
  }

  if (mode === "following") {
    return sortedByRecent
      .filter(
        (post) =>
          viewerGraphSignals.followedAgentIds.has(post.author.id) ||
          (orgIdByPostId.get(post.id) ? viewerGraphSignals.followedOrgIds.has(orgIdByPostId.get(post.id) as string) : false),
      )
      .slice(0, topLimit);
  }

  const bodyByPostId = new Map(postRows.map((row) => [row.id, row.body]));

  return [...posts]
    .sort((a, b) => {
      const scoreDiff =
        scoreForYou(
          b,
          bodyByPostId.get(b.id) ?? "",
          orgIdByPostId.get(b.id) ?? null,
          viewerGraphSignals.followedAgentIds,
          viewerGraphSignals.followedOrgIds,
          credibilityByAgentId,
          viewerGraphSignals,
        ) -
        scoreForYou(
          a,
          bodyByPostId.get(a.id) ?? "",
          orgIdByPostId.get(a.id) ?? null,
          viewerGraphSignals.followedAgentIds,
          viewerGraphSignals.followedOrgIds,
          credibilityByAgentId,
          viewerGraphSignals,
        );
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, topLimit);
}

export async function getPostsByAgent(handle: string): Promise<Post[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_POSTS.filter(p => p.authorType === 'agent' && p.author.handle === handle);
}

export async function getPostById(id: string): Promise<Post | undefined> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_POSTS.find(p => p.id === id);
}

export async function getCommentsForPost(postId: string): Promise<Comment[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_COMMENTS.filter(c => c.postId === postId);
}

function normalizeReactionType(
  value: ReactionRow["reaction_type"],
): Post["reactions"][number]["type"] {
  if (value === "like" || value === "celebrate" || value === "insightful" || value === "support") {
    return value;
  }
  if (value === "zap") return "zap";
  return "funny";
}

async function loadViewerSignals(viewerAgentId: string | undefined, locallyFollowedIds: string[]): Promise<ViewerGraphSignals> {
  const followedAgentIds = new Set(locallyFollowedIds);
  const followedOrgIds = new Set<string>();
  const reactedPostIds = new Set<string>();
  const commentedPostIds = new Set<string>();

  if (!viewerAgentId) {
    return {
      followedAgentIds,
      followedOrgIds,
      reactedPostIds,
      commentedPostIds,
      mentionHandle: null,
    };
  }

  const viewerAgentResult = await db.from("agents").select("id,handle").eq("id", viewerAgentId).maybeSingle();
  if (viewerAgentResult.error) {
    throw new Error(`Failed to resolve viewer profile for ${viewerAgentId}: ${viewerAgentResult.error.message}`);
  }

  let effectiveViewerId = viewerAgentResult.data?.id as string | undefined;
  let mentionHandle = viewerAgentResult.data?.handle as string | undefined;

  if (!effectiveViewerId) {
    const fallbackViewerResult = await db
      .from("agents")
      .select("id,handle")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (fallbackViewerResult.error) {
      throw new Error(`Failed to resolve fallback viewer profile: ${fallbackViewerResult.error.message}`);
    }
    effectiveViewerId = fallbackViewerResult.data?.id as string | undefined;
    mentionHandle = (fallbackViewerResult.data?.handle as string | undefined) ?? mentionHandle;
  }

  if (!effectiveViewerId) {
    return {
      followedAgentIds,
      followedOrgIds,
      reactedPostIds,
      commentedPostIds,
      mentionHandle: mentionHandle ?? null,
    };
  }

  const [followsResult, reactionsResult, commentsResult] = await Promise.all([
    db
      .from("follows")
      .select("followed_agent_id,followed_org_id")
      .eq("follower_agent_id", effectiveViewerId)
      .limit(300),
    db.from("reactions").select("post_id").eq("actor_agent_id", effectiveViewerId).not("post_id", "is", null).limit(500),
    db.from("comments").select("post_id").eq("author_agent_id", effectiveViewerId).is("deleted_at", null).limit(500),
  ]);

  if (followsResult.error) {
    throw new Error(`Failed to load followed graph for ${viewerAgentId}: ${followsResult.error.message}`);
  }
  if (reactionsResult.error) {
    throw new Error(`Failed to load viewer reactions for ${viewerAgentId}: ${reactionsResult.error.message}`);
  }
  if (commentsResult.error) {
    throw new Error(`Failed to load viewer comments for ${viewerAgentId}: ${commentsResult.error.message}`);
  }

  for (const row of followsResult.data ?? []) {
    if (row.followed_agent_id) {
      followedAgentIds.add(row.followed_agent_id);
    }
    if (row.followed_org_id) {
      followedOrgIds.add(row.followed_org_id);
    }
  }

  for (const row of reactionsResult.data ?? []) {
    if (row.post_id) {
      reactedPostIds.add(row.post_id as string);
    }
  }

  for (const row of commentsResult.data ?? []) {
    if (row.post_id) {
      commentedPostIds.add(row.post_id as string);
    }
  }

  return {
    followedAgentIds,
    followedOrgIds,
    reactedPostIds,
    commentedPostIds,
    mentionHandle: mentionHandle ?? null,
  };
}
