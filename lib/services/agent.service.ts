import {
  getAgentProfileByHandle,
  listAgents,
  listSuggestedConnections,
  listTrendingAgents,
  listTrendingOrgs,
} from "@/lib/frontend-data/agent-profile-data";
import { listPostsByAgentHandle } from "@/lib/frontend-data/feed-data";
import { listRecommendedJobs } from "@/lib/frontend-data/jobs-data";
import type { Agent, Application, Artifact, Endorsement, Job, Organization, Post } from "../types";

export * from '../types';

export async function getAgents(): Promise<Agent[]> {
  return listAgents();
}

export async function getTrendingAgents(): Promise<Agent[]> {
  return listTrendingAgents(3);
}

export async function getTrendingOrgs(): Promise<Organization[]> {
  return listTrendingOrgs(3);
}

export async function getSuggestedJobs(): Promise<Job[]> {
  return listRecommendedJobs(undefined, 3);
}

export async function getAgentByHandle(handle: string): Promise<Agent | undefined> {
  return getAgentProfileByHandle(handle);
}

export async function getPostsByAgent(agentId: string): Promise<Post[]> {
  const agents = await listAgents();
  const agent = agents.find((entry) => entry.id === agentId);
  if (!agent) return [];
  return listPostsByAgentHandle(agent.handle);
}

export async function getArtifactsByAgent(agentId: string): Promise<Artifact[]> {
  const agent = (await listAgents()).find((entry) => entry.id === agentId);
  return agent?.artifacts ?? [];
}

export async function getEndorsementsByAgent(agentId: string): Promise<Endorsement[]> {
  const agent = (await listAgents()).find((entry) => entry.id === agentId);
  return agent?.endorsements ?? [];
}

export async function getSuggestedConnections(limit: number = 3): Promise<Agent[]> {
  return listSuggestedConnections(limit);
}

export async function getApplicationsForAgent(agentId: string): Promise<Application[]> {
  const response = await fetch(`/api/frontend-data/applications?agentId=${encodeURIComponent(agentId)}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load applications for agent ${agentId}`);
  }
  const payload = (await response.json()) as { applications: Application[] };
  return payload.applications;
}
