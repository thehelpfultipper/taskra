import { toJobDomain, toJobViewModel, toOrgDomain, toOrgViewModel } from "@/lib/frontend-data/mappers";
import { getPublicSupabaseClient, runPublicQuery } from "@/lib/frontend-data/query/public-query";
import type { RawJobRecord, RawOrgRecord } from "@/lib/frontend-data/types";
import type { Job } from "@/lib/types";

type RawEmployerAgentRecord = {
  id: string;
  handle: string;
  display_name: string;
};

export async function listJobs(): Promise<Job[]> {
  const db = getPublicSupabaseClient();
  const [jobRows, orgRows] = await Promise.all([
    runPublicQuery<RawJobRecord[]>(
      "list jobs",
      db
        .from("jobs")
        .select(
          "id,org_id,title,description,location_type,status,created_at,closes_at,employer_kind,employer_agent_id,engagement_type",
        )
        .eq("status", "open")
        .order("created_at", { ascending: false }),
    ),
    runPublicQuery<RawOrgRecord[]>("list orgs for jobs", db.from("orgs").select("id,slug,name,created_by_user_id")),
  ]);

  const orgById = new Map(orgRows.map((org) => [org.id, toOrgViewModel(toOrgDomain(org))]));

  const employerAgentIds = Array.from(
    new Set(
      jobRows
        .filter((row) => row.employer_kind === "agent" && row.employer_agent_id)
        .map((row) => row.employer_agent_id as string),
    ),
  );
  const employerAgentById = new Map<string, RawEmployerAgentRecord>();
  if (employerAgentIds.length > 0) {
    const agentRows = await runPublicQuery<RawEmployerAgentRecord[]>(
      "list employer agents for jobs",
      db.from("agents").select("id,handle,display_name").in("id", employerAgentIds),
    );
    for (const agent of agentRows) {
      employerAgentById.set(agent.id, agent);
    }
  }

  return jobRows.map((row) => {
    const domain = toJobDomain(row);
    const org = orgById.get(domain.orgId) ?? toOrgViewModel({ id: domain.orgId, slug: "unknown", name: "Unknown org" });
    const employerAgentRow = domain.employerAgentId ? employerAgentById.get(domain.employerAgentId) : undefined;
    const employerAgent = employerAgentRow
      ? { id: employerAgentRow.id, handle: employerAgentRow.handle, displayName: employerAgentRow.display_name }
      : null;
    return toJobViewModel(domain, org, { employerAgent });
  });
}

export async function getJob(id: string): Promise<Job | undefined> {
  const jobs = await listJobs();
  return jobs.find((job) => job.id === id);
}

export async function listRecommendedJobs(_viewerAgentId?: string, limit = 5): Promise<Job[]> {
  const jobs = await listJobs();
  return jobs.slice(0, limit);
}
