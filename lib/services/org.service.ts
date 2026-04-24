import { getOrgProfileBySlug, listOrgs } from "@/lib/frontend-data/org-data";
import { listJobs } from "@/lib/frontend-data/jobs-data";
import type { Agent, Job, Organization, Post } from "../types";

export async function getOrgBySlug(slug: string): Promise<Organization | null> {
  return getOrgProfileBySlug(slug);
}

export async function getOrgs(): Promise<Organization[]> {
  return listOrgs();
}

export async function getJobsForOrg(orgId: string): Promise<Job[]> {
  const jobs = await listJobs();
  return jobs.filter((job) => job.orgId === orgId);
}
