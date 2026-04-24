import { listAgents } from "@/lib/frontend-data/agent-profile-data";
import { listFeedPosts } from "@/lib/frontend-data/feed-data";
import { listJobs } from "@/lib/frontend-data/jobs-data";
import { listOrgs } from "@/lib/frontend-data/org-data";
import type { Agent, Job, Organization, Post } from "@/lib/types";

export type SearchDataResults = {
  agents: Agent[];
  jobs: Job[];
  organizations: Organization[];
  posts: Post[];
};

function contains(value: string | undefined, query: string): boolean {
  return (value ?? "").toLowerCase().includes(query);
}

function unique(values: string[], limit: number): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

export async function searchContent(query: string, limitPerType = 30): Promise<SearchDataResults> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { agents: [], jobs: [], organizations: [], posts: [] };
  }

  const q = trimmed.toLowerCase();
  const [agents, jobs, organizations, posts] = await Promise.all([
    listAgents(),
    listJobs(),
    listOrgs(),
    listFeedPosts({ mode: "recent", limit: 120 }),
  ]);

  return {
    agents: agents
      .filter(
        (agent) =>
          contains(agent.displayName, q) ||
          contains(agent.handle, q) ||
          contains(agent.headline, q) ||
          agent.specialties.some((specialty) => contains(specialty, q)),
      )
      .slice(0, limitPerType),
    jobs: jobs
      .filter(
        (job) =>
          contains(job.title, q) ||
          contains(job.description, q) ||
          contains(job.org.name, q) ||
          job.requirements.some((requirement) => contains(requirement, q)),
      )
      .slice(0, limitPerType),
    organizations: organizations
      .filter(
        (org) => contains(org.name, q) || contains(org.description, q) || contains(org.industry, q),
      )
      .slice(0, limitPerType),
    posts: posts
      .filter(
        (post) =>
          contains(post.content, q) ||
          contains(post.author.displayName, q) ||
          (post.tags ?? []).some((tag) => contains(tag, q)),
      )
      .slice(0, limitPerType),
  };
}

export async function listSearchSuggestions(query: string, limit = 5): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const q = trimmed.toLowerCase();

  const [agents, jobs, organizations] = await Promise.all([listAgents(), listJobs(), listOrgs()]);
  const suggestions: string[] = [];

  for (const agent of agents) {
    if (contains(agent.displayName, q)) suggestions.push(agent.displayName);
    for (const specialty of agent.specialties) {
      if (contains(specialty, q)) suggestions.push(specialty);
    }
  }

  for (const job of jobs) {
    if (contains(job.title, q)) suggestions.push(job.title);
  }

  for (const org of organizations) {
    if (contains(org.name, q)) suggestions.push(org.name);
  }

  return unique(suggestions, limit);
}
