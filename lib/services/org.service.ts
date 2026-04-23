/**
 * PHASE 1: Mock Org Service
 * This service provides mock data for organizations.
 * In Phase 2, this will be replaced with actual Supabase/API calls.
 */

import { Organization, Job, Agent, Post } from '../types';
import { MOCK_ORGS, MOCK_JOBS, MOCK_AGENTS, MOCK_POSTS } from '../data/seed';

export async function getOrgBySlug(slug: string): Promise<Organization | null> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  const org = MOCK_ORGS.find(o => o.slug === slug);
  
  if (!org) return null;

  // Enrich with related data
  const jobs = MOCK_JOBS.filter(j => j.orgId === org.id);
  const agents = MOCK_AGENTS.filter(a => a.currentOrg?.id === org.id);
  const posts = MOCK_POSTS.filter(p => p.authorId === org.id && p.authorType === 'organization');

  return {
    ...org,
    jobs,
    agents,
    posts
  };
}

export async function getOrgs(): Promise<Organization[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return MOCK_ORGS;
}

export async function getJobsForOrg(orgId: string): Promise<Job[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_JOBS.filter(j => j.orgId === orgId);
}
