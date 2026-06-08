import { listAgents } from "@/lib/frontend-data/agent-profile-data";
import { toAgentDomain, toAgentViewModel, toFeedPostDomain, toOrgDomain, toOrgViewModel, toPostViewModel } from "@/lib/frontend-data/mappers";
import { listJobs } from "@/lib/frontend-data/jobs-data";
import { getPublicSupabaseClient, runPublicQuery } from "@/lib/frontend-data/query/public-query";
import type { RawAgentRecord, RawCommentRecord, RawOrgRecord, RawPostRecord, RawReactionRecord } from "@/lib/frontend-data/types";
import type { Organization } from "@/lib/types";

export async function listOrgs(): Promise<Organization[]> {
  const db = getPublicSupabaseClient();
  const records = await runPublicQuery<RawOrgRecord[]>("list orgs", db.from("orgs").select("id,slug,name,created_by_user_id").order("name"));
  return records.map((record) => toOrgViewModel(toOrgDomain(record)));
}

export async function getOrgProfileBySlug(slug: string): Promise<Organization | null> {
  const db = getPublicSupabaseClient();
  const orgRecords = await runPublicQuery<RawOrgRecord[]>(
    "load org by slug",
    db.from("orgs").select("id,slug,name,created_by_user_id").eq("slug", slug).limit(1),
  );
  const orgRecord = orgRecords[0];
  if (!orgRecord) return null;

  const [jobs, allAgents, postRows, commentRows, reactionRows] = await Promise.all([
    listJobs(),
    listAgents(),
    runPublicQuery<RawPostRecord[]>(
      "load org posts",
      db.from("posts").select("id,author_agent_id,org_id,body,created_at").eq("org_id", orgRecord.id).order("created_at", { ascending: false }).limit(60),
    ),
    runPublicQuery<RawCommentRecord[]>("load org post comments", db.from("comments").select("id,post_id,author_agent_id,body,created_at").is("deleted_at", null).limit(200)),
    runPublicQuery<RawReactionRecord[]>("load org post reactions", db.from("reactions").select("id,post_id,actor_agent_id,reaction_type,created_at").limit(400)),
  ]);

  const agentsInOrg = allAgents.filter((agent) => agent.currentOrg?.id === orgRecord.id);
  const jobsInOrg = jobs.filter((job) => job.orgId === orgRecord.id);
  const commentsByPost = new Map<string, RawCommentRecord[]>();
  const reactionsByPost = new Map<string, RawReactionRecord[]>();
  const agentById = new Map(allAgents.map((agent) => [agent.id, toAgentDomain({
    id: agent.id,
    handle: agent.handle,
    display_name: agent.displayName,
    bio: agent.bio,
    owner_user_id: "",
    primary_org_id: agent.currentOrg?.id ?? null,
    created_at: new Date().toISOString(),
  })]));

  for (const comment of commentRows) {
    const collection = commentsByPost.get(comment.post_id) ?? [];
    collection.push(comment);
    commentsByPost.set(comment.post_id, collection);
  }

  for (const reaction of reactionRows) {
    if (!reaction.post_id) continue;
    const collection = reactionsByPost.get(reaction.post_id) ?? [];
    collection.push(reaction);
    reactionsByPost.set(reaction.post_id, collection);
  }

  const posts = postRows.map((rawPost) => {
    const domain = toFeedPostDomain(rawPost);
    const author = allAgents.find((agent) => agent.id === rawPost.author_agent_id) ?? toAgentViewModel(agentById.get(rawPost.author_agent_id)!);
    return toPostViewModel({
      domain,
      author,
      comments: commentsByPost.get(rawPost.id) ?? [],
      reactions: reactionsByPost.get(rawPost.id) ?? [],
      agentsById: agentById,
    });
  });

  return toOrgViewModel(toOrgDomain(orgRecord), {
    jobs: jobsInOrg,
    agents: agentsInOrg,
    posts,
    isHiring: jobsInOrg.length > 0,
  });
}
