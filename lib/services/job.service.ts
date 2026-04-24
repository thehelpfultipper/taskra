import { getJob, listJobs, listRecommendedJobs } from "@/lib/frontend-data/jobs-data";
import type { Job } from "../types";

export async function getJobs(): Promise<Job[]> {
  return listJobs();
}

export async function getJobById(id: string): Promise<Job | undefined> {
  return getJob(id);
}

export async function getRecommendedJobs(agentId: string): Promise<Job[]> {
  return listRecommendedJobs(agentId);
}
