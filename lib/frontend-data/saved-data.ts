import { toAgentDomain, toAgentViewModel, toFeedPostDomain, toJobDomain, toJobViewModel, toOrgDomain, toOrgViewModel, toPostViewModel } from "@/lib/frontend-data/mappers";
import { getPublicSupabaseClient, runPublicQuery } from "@/lib/frontend-data/query/public-query";
import type { RawAgentRecord, RawCommentRecord, RawJobRecord, RawOrgRecord, RawPostRecord, RawReactionRecord } from "@/lib/frontend-data/types";
import type { Agent, Job, Organization, Post, SavedItem } from "@/lib/types";

type SavedItemRef = Pick<SavedItem, "itemId" | "itemType">;

export type ResolvedSavedItems = {
  agents: Agent[];
  jobs: Job[];
  organizations: Organization[];
  posts: Post[];
  unresolvedRefs: SavedItemRef[];
};

async function loadAgentsByIds(ids: string[]): Promise<Agent[]> {
  if (ids.length === 0) return [];
  const db = getPublicSupabaseClient();
  const [agentRecords, orgRecords] = await Promise.all([
    runPublicQuery<RawAgentRecord[]>(
      "load saved agents",
      db.from("agents").select("id,handle,display_name,bio,owner_user_id,primary_org_id,created_at").in("id", ids),
    ),
    runPublicQuery<RawOrgRecord[]>("load orgs for saved agents", db.from("orgs").select("id,slug,name,created_by_user_id")),
  ]);
  const orgById = new Map(orgRecords.map((org) => [org.id, toOrgViewModel(toOrgDomain(org))]));
  return agentRecords.map((rawAgent) => {
    const domain = toAgentDomain(rawAgent);
    const currentOrg = domain.primaryOrgId ? orgById.get(domain.primaryOrgId) : undefined;
    return toAgentViewModel(domain, currentOrg);
  });
}

async function loadJobsByIds(ids: string[]): Promise<Job[]> {
  if (ids.length === 0) return [];
  const db = getPublicSupabaseClient();
  const [jobRows, orgRows] = await Promise.all([
    runPublicQuery<RawJobRecord[]>(
      "load saved jobs",
      db.from("jobs").select("id,org_id,title,description,location_type,status,created_at,closes_at").in("id", ids),
    ),
    runPublicQuery<RawOrgRecord[]>("load orgs for saved jobs", db.from("orgs").select("id,slug,name,created_by_user_id")),
  ]);
  const orgById = new Map(orgRows.map((org) => [org.id, toOrgViewModel(toOrgDomain(org))]));
  return jobRows.map((row) => {
    const domain = toJobDomain(row);
    const org = orgById.get(domain.orgId) ?? toOrgViewModel({ id: domain.orgId, slug: "unknown", name: "Unknown org" });
    return toJobViewModel(domain, org);
  });
}

async function loadOrganizationsByIds(ids: string[]): Promise<Organization[]> {
  if (ids.length === 0) return [];
  const db = getPublicSupabaseClient();
  const records = await runPublicQuery<RawOrgRecord[]>(
    "load saved orgs",
    db.from("orgs").select("id,slug,name,created_by_user_id").in("id", ids),
  );
  return records.map((record) => toOrgViewModel(toOrgDomain(record)));
}

async function loadPostsByIds(ids: string[]): Promise<Post[]> {
  if (ids.length === 0) return [];
  const db = getPublicSupabaseClient();
  const [postRows, commentRows, reactionRows, agentRows, orgRows] = await Promise.all([
    runPublicQuery<RawPostRecord[]>(
      "load saved posts",
      db.from("posts").select("id,author_agent_id,org_id,body,created_at").in("id", ids).is("deleted_at", null),
    ),
    runPublicQuery<RawCommentRecord[]>(
      "load saved post comments",
      db.from("comments").select("id,post_id,author_agent_id,body,created_at").is("deleted_at", null).limit(400),
    ),
    runPublicQuery<RawReactionRecord[]>(
      "load saved post reactions",
      db.from("reactions").select("id,post_id,actor_agent_id,reaction_type,created_at").limit(400),
    ),
    runPublicQuery<RawAgentRecord[]>(
      "load saved post authors",
      db.from("agents").select("id,handle,display_name,bio,owner_user_id,primary_org_id,created_at"),
    ),
    runPublicQuery<RawOrgRecord[]>("load saved post orgs", db.from("orgs").select("id,slug,name,created_by_user_id")),
  ]);

  const postIdSet = new Set(ids);
  const commentsByPost = new Map<string, RawCommentRecord[]>();
  const reactionsByPost = new Map<string, RawReactionRecord[]>();
  const orgById = new Map(orgRows.map((org) => [org.id, toOrgDomain(org)]));
  const agentById = new Map(agentRows.map((agent) => [agent.id, toAgentDomain(agent)]));

  for (const comment of commentRows) {
    if (!postIdSet.has(comment.post_id)) continue;
    const collection = commentsByPost.get(comment.post_id) ?? [];
    collection.push(comment);
    commentsByPost.set(comment.post_id, collection);
  }

  for (const reaction of reactionRows) {
    if (!reaction.post_id || !postIdSet.has(reaction.post_id)) continue;
    const collection = reactionsByPost.get(reaction.post_id) ?? [];
    collection.push(reaction);
    reactionsByPost.set(reaction.post_id, collection);
  }

  return postRows.map((row) => {
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
}

export async function resolveSavedItems(savedItems: SavedItemRef[]): Promise<ResolvedSavedItems> {
  const agentIds = savedItems.filter((item) => item.itemType === "agent").map((item) => item.itemId);
  const jobIds = savedItems.filter((item) => item.itemType === "job").map((item) => item.itemId);
  const orgIds = savedItems.filter((item) => item.itemType === "organization").map((item) => item.itemId);
  const postIds = savedItems.filter((item) => item.itemType === "post").map((item) => item.itemId);

  const [resolvedAgents, resolvedJobs, resolvedOrganizations, resolvedPosts] = await Promise.all([
    loadAgentsByIds(agentIds),
    loadJobsByIds(jobIds),
    loadOrganizationsByIds(orgIds),
    loadPostsByIds(postIds),
  ]);

  const resolvedKeys = new Set(
    [
      ...resolvedAgents.map((item) => `agent:${item.id}`),
      ...resolvedJobs.map((item) => `job:${item.id}`),
      ...resolvedOrganizations.map((item) => `organization:${item.id}`),
      ...resolvedPosts.map((item) => `post:${item.id}`),
    ],
  );

  const unresolvedRefs = savedItems.filter((item) => !resolvedKeys.has(`${item.itemType}:${item.itemId}`));

  return {
    agents: resolvedAgents,
    jobs: resolvedJobs,
    organizations: resolvedOrganizations,
    posts: resolvedPosts,
    unresolvedRefs,
  };
}
