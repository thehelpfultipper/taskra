import "server-only";

import {
  toAgentDomain,
  toAgentViewModel,
  toApplicationDomain,
  toApplicationViewModel,
  toJobDomain,
  toJobViewModel,
  toOrgDomain,
  toOrgViewModel,
} from "@/lib/frontend-data/mappers";
import { getServerSupabaseClient, runServerQuery } from "@/lib/frontend-data/query/server-query";
import type {
  RawAgentRecord,
  RawApplicationRecord,
  RawApplicationStatusHistoryRecord,
  RawJobRecord,
  RawOrgRecord,
} from "@/lib/frontend-data/types";
import type { Agent, Application, Job } from "@/lib/types";

async function loadJobsByIds(jobIds: string[]): Promise<Map<string, Job>> {
  const uniqueIds = Array.from(new Set(jobIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const db = getServerSupabaseClient();
  const jobRows = await runServerQuery<RawJobRecord[]>(
    "load jobs for applications",
    db
      .from("jobs")
      .select("id,org_id,title,description,location_type,status,created_at,closes_at")
      .in("id", uniqueIds),
  );

  const orgIds = Array.from(new Set(jobRows.map((row) => row.org_id)));
  const orgRows =
    orgIds.length > 0
      ? await runServerQuery<RawOrgRecord[]>(
          "load orgs for applications",
          db.from("orgs").select("id,slug,name,created_by_user_id").in("id", orgIds),
        )
      : [];

  const orgById = new Map(orgRows.map((org) => [org.id, toOrgViewModel(toOrgDomain(org))]));

  return new Map(
    jobRows.map((row) => {
      const domain = toJobDomain(row);
      const org = orgById.get(domain.orgId) ?? toOrgViewModel({ id: domain.orgId, slug: "unknown", name: "Unknown org" });
      return [domain.id, toJobViewModel(domain, org)] as const;
    }),
  );
}

async function loadAgentsByIds(agentIds: string[]): Promise<Map<string, Agent>> {
  const uniqueIds = Array.from(new Set(agentIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const db = getServerSupabaseClient();
  const [agentRows, orgRows] = await Promise.all([
    runServerQuery<RawAgentRecord[]>(
      "load agents for applications",
      db
        .from("agents")
        .select("id,handle,display_name,bio,owner_user_id,primary_org_id,created_at")
        .in("id", uniqueIds),
    ),
    runServerQuery<RawOrgRecord[]>("load orgs for application agents", db.from("orgs").select("id,slug,name,created_by_user_id")),
  ]);

  const orgById = new Map(orgRows.map((org) => [org.id, toOrgViewModel(toOrgDomain(org))]));

  return new Map(
    agentRows.map((row) => {
      const domain = toAgentDomain(row);
      const currentOrg = domain.primaryOrgId ? orgById.get(domain.primaryOrgId) : undefined;
      return [domain.id, toAgentViewModel(domain, currentOrg)] as const;
    }),
  );
}

export async function listApplicationsByAgentIds(agentIds: string[]): Promise<Application[]> {
  if (agentIds.length === 0) return [];

  const db = getServerSupabaseClient();
  const applicationRows = await runServerQuery<RawApplicationRecord[]>(
    "load applications",
    db
      .from("applications")
      .select("id,job_id,applicant_agent_id,current_status,cover_note,created_at,updated_at")
      .in("applicant_agent_id", agentIds)
      .order("created_at", { ascending: false }),
  );

  if (applicationRows.length === 0) {
    return [];
  }

  const applicationIds = applicationRows.map((row) => row.id);
  const [statusRows, jobsById, agentsById] = await Promise.all([
    runServerQuery<RawApplicationStatusHistoryRecord[]>(
      "load application status history",
      db
        .from("application_status_history")
        .select("id,application_id,from_status,to_status,note,created_at")
        .in("application_id", applicationIds)
        .order("created_at", { ascending: true }),
    ),
    loadJobsByIds(applicationRows.map((row) => row.job_id)),
    loadAgentsByIds(applicationRows.map((row) => row.applicant_agent_id)),
  ]);

  const statusByAppId = new Map<string, RawApplicationStatusHistoryRecord[]>();
  for (const row of statusRows) {
    const collection = statusByAppId.get(row.application_id) ?? [];
    collection.push(row);
    statusByAppId.set(row.application_id, collection);
  }

  return applicationRows
    .map((row) => {
      const domain = toApplicationDomain(row);
      const job = jobsById.get(domain.jobId);
      const agent = agentsById.get(domain.applicantAgentId);
      if (!job || !agent) return null;
      return toApplicationViewModel({
        domain,
        job,
        agent,
        history: statusByAppId.get(domain.id) ?? [],
      });
    })
    .filter((value): value is Application => Boolean(value));
}
