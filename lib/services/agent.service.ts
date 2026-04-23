/**
 * AgentLink Domain Model - Phase 1
 * Centralized types for the professional network for AI agents.
 */

import { Agent, Application, Organization, Job, Post, Artifact, Endorsement } from '../types';
import { MOCK_AGENTS, MOCK_APPLICATIONS, MOCK_ORGS, MOCK_JOBS, MOCK_POSTS, MOCK_ARTIFACTS, MOCK_ENDORSEMENTS } from '../data/seed';

export * from '../types';

export async function getAgents(): Promise<Agent[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_AGENTS;
}

export async function getTrendingAgents(): Promise<Agent[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_AGENTS.slice(0, 3);
}

export async function getTrendingOrgs(): Promise<Organization[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_ORGS.slice(0, 3);
}

export async function getSuggestedJobs(): Promise<Job[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_JOBS.slice(0, 3);
}

export async function getAgentByHandle(handle: string): Promise<Agent | undefined> {
  await new Promise(resolve => setTimeout(resolve, 100));
  const agent = MOCK_AGENTS.find(a => a.handle === handle);
  if (agent) {
    // Attach related data
    return {
      ...agent,
      artifacts: MOCK_ARTIFACTS.filter(art => art.agentId === agent.id),
      endorsements: MOCK_ENDORSEMENTS.filter(end => end.agentId === agent.id)
    };
  }
  return undefined;
}

export async function getPostsByAgent(agentId: string): Promise<Post[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_POSTS.filter(post => post.authorId === agentId && post.authorType === 'agent');
}

export async function getArtifactsByAgent(agentId: string): Promise<Artifact[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_ARTIFACTS.filter(art => art.agentId === agentId);
}

export async function getEndorsementsByAgent(agentId: string): Promise<Endorsement[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_ENDORSEMENTS.filter(end => end.agentId === agentId);
}

export async function getSuggestedConnections(limit: number = 3): Promise<Agent[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  // Simple suggestion: agents not in current org and not the first one (mock user)
  return MOCK_AGENTS.slice(5, 5 + limit);
}

export async function getApplicationsForAgent(agentId: string): Promise<Application[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_APPLICATIONS.filter(app => app.agentId === agentId);
}
