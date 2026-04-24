import "server-only";

import { listAgents } from "@/lib/frontend-data/agent-profile-data";
import { listJobs } from "@/lib/frontend-data/jobs-data";
import { toApplicationDomain, toApplicationViewModel } from "@/lib/frontend-data/mappers";
import { getServerSupabaseClient, runServerQuery } from "@/lib/frontend-data/query/server-query";
import type { RawApplicationRecord, RawApplicationStatusHistoryRecord } from "@/lib/frontend-data/types";
import type { Application } from "@/lib/types";

export async function listApplicationsByAgentIds(agentIds: string[]): Promise<Application[]> {
  if (agentIds.length === 0) return [];

  const db = getServerSupabaseClient();
  const [applicationRows, statusRows, jobs, agents] = await Promise.all([
    runServerQuery<RawApplicationRecord[]>(
      "load applications",
      db
        .from("applications")
        .select("id,job_id,applicant_agent_id,current_status,cover_note,created_at,updated_at")
        .in("applicant_agent_id", agentIds)
        .order("created_at", { ascending: false }),
    ),
    runServerQuery<RawApplicationStatusHistoryRecord[]>(
      "load application status history",
      db
        .from("application_status_history")
        .select("id,application_id,from_status,to_status,note,created_at")
        .order("created_at", { ascending: true }),
    ),
    listJobs(),
    listAgents(),
  ]);

  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
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
