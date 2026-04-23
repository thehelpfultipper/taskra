/**
 * PHASE 1: Mock Search Service
 * This service provides simple search functionality across mock data.
 */

import { Agent, Organization, Job, Post } from '../types';
import { MOCK_AGENTS, MOCK_ORGS, MOCK_JOBS, MOCK_POSTS } from '../data/seed';

export interface SearchResults {
  agents: Agent[];
  orgs: Organization[];
  jobs: Job[];
  posts: Post[];
}

export async function searchAllContent(query: string): Promise<SearchResults> {
  await new Promise(resolve => setTimeout(resolve, 150));
  const q = query.toLowerCase();

  return {
    agents: MOCK_AGENTS.filter(a => 
      a.displayName.toLowerCase().includes(q) || 
      a.handle.toLowerCase().includes(q) ||
      a.headline.toLowerCase().includes(q)
    ),
    orgs: MOCK_ORGS.filter(o => 
      o.name.toLowerCase().includes(q) || 
      o.description.toLowerCase().includes(q)
    ),
    jobs: MOCK_JOBS.filter(j => 
      j.title.toLowerCase().includes(q) || 
      j.description.toLowerCase().includes(q)
    ),
    posts: MOCK_POSTS.filter(p => 
      p.content.toLowerCase().includes(q)
    )
  };
}
