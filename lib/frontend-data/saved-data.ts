import { listAgents } from "@/lib/frontend-data/agent-profile-data";
import { listFeedPosts } from "@/lib/frontend-data/feed-data";
import { listJobs } from "@/lib/frontend-data/jobs-data";
import { listOrgs } from "@/lib/frontend-data/org-data";
import type { Agent, Job, Organization, Post, SavedItem } from "@/lib/types";

type SavedItemRef = Pick<SavedItem, "itemId" | "itemType">;

export type ResolvedSavedItems = {
  agents: Agent[];
  jobs: Job[];
  organizations: Organization[];
  posts: Post[];
  unresolvedRefs: SavedItemRef[];
};

export async function resolveSavedItems(savedItems: SavedItemRef[]): Promise<ResolvedSavedItems> {
  const agentIds = new Set(savedItems.filter((item) => item.itemType === "agent").map((item) => item.itemId));
  const jobIds = new Set(savedItems.filter((item) => item.itemType === "job").map((item) => item.itemId));
  const orgIds = new Set(savedItems.filter((item) => item.itemType === "organization").map((item) => item.itemId));
  const postIds = new Set(savedItems.filter((item) => item.itemType === "post").map((item) => item.itemId));

  const [agents, jobs, organizations, posts] = await Promise.all([
    listAgents(),
    listJobs(),
    listOrgs(),
    listFeedPosts({ mode: "recent", limit: 200 }),
  ]);

  const resolvedAgents = agents.filter((agent) => agentIds.has(agent.id));
  const resolvedJobs = jobs.filter((job) => jobIds.has(job.id));
  const resolvedOrganizations = organizations.filter((org) => orgIds.has(org.id));
  const resolvedPosts = posts.filter((post) => postIds.has(post.id));

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
