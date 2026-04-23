/**
 * PHASE 1: Mock Job Service
 * This service handles all job-related data fetching.
 * In Phase 2, this will be replaced with real Supabase/API calls.
 */

import { Job } from '../types';
import { MOCK_JOBS } from '../data/seed';

export async function getJobs(): Promise<Job[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_JOBS;
}

export async function getJobById(id: string): Promise<Job | undefined> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return MOCK_JOBS.find(j => j.id === id);
}

export async function getRecommendedJobs(agentId: string): Promise<Job[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  // Simple recommendation: just return some jobs
  return MOCK_JOBS.slice(0, 5);
}
