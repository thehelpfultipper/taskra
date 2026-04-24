import { toAgentDomain, toAgentViewModel, toEndorsementViewModel, toOrgDomain, toOrgViewModel } from "@/lib/frontend-data/mappers";
import { getPublicSupabaseClient, runPublicQuery } from "@/lib/frontend-data/query/public-query";
import type { RawAgentRecord, RawEndorsementRecord, RawOrgRecord } from "@/lib/frontend-data/types";
import type { Agent } from "@/lib/types";

async function loadAgentRecords(): Promise<RawAgentRecord[]> {
  const db = getPublicSupabaseClient();
  return runPublicQuery<RawAgentRecord[]>(
    "list agents",
    db.from("agents").select("id,handle,display_name,bio,owner_user_id,primary_org_id,created_at").order("created_at", { ascending: true }),
  );
}

async function loadOrgRecords(): Promise<RawOrgRecord[]> {
  const db = getPublicSupabaseClient();
  return runPublicQuery<RawOrgRecord[]>("list orgs for agents", db.from("orgs").select("id,slug,name,created_by_user_id"));
}

export async function listAgents(): Promise<Agent[]> {
  const [agentRecords, orgRecords] = await Promise.all([loadAgentRecords(), loadOrgRecords()]);
  const orgById = new Map(orgRecords.map((org) => [org.id, toOrgViewModel(toOrgDomain(org))]));

  return agentRecords.map((rawAgent) => {
    const domain = toAgentDomain(rawAgent);
    const currentOrg = domain.primaryOrgId ? orgById.get(domain.primaryOrgId) : undefined;
    return toAgentViewModel(domain, currentOrg);
  });
}

export async function getAgentProfileByHandle(handle: string): Promise<Agent | undefined> {
  const db = getPublicSupabaseClient();
  const [rawAgent, orgRecords, rawEndorsements] = await Promise.all([
    runPublicQuery<RawAgentRecord[]>(
      "load agent by handle",
      db.from("agents").select("id,handle,display_name,bio,owner_user_id,primary_org_id,created_at").eq("handle", handle).limit(1),
    ),
    loadOrgRecords(),
    runPublicQuery<RawEndorsementRecord[]>(
      "load agent endorsements",
      db
        .from("endorsements")
        .select("id,endorsed_agent_id,endorser_agent_id,skill_key,note,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ),
  ]);

  const agentRecord = rawAgent[0];
  if (!agentRecord) return undefined;

  const agentDomain = toAgentDomain(agentRecord);
  const orgById = new Map(orgRecords.map((org) => [org.id, toOrgViewModel(toOrgDomain(org))]));
  const allAgents = await listAgents();
  const agentById = new Map(allAgents.map((agent) => [agent.id, agent]));

  const endorsements = rawEndorsements
    .filter((endorsement) => endorsement.endorsed_agent_id === agentDomain.id)
    .map((endorsement) => toEndorsementViewModel(endorsement, agentById.get(endorsement.endorser_agent_id)));

  return toAgentViewModel(agentDomain, agentDomain.primaryOrgId ? orgById.get(agentDomain.primaryOrgId) : undefined, {
    endorsements,
    _count: {
      posts: 0,
      endorsements: endorsements.length,
      connections: 0,
    },
  });
}

export async function listTrendingAgents(limit = 3): Promise<Agent[]> {
  const agents = await listAgents();
  return agents.slice(0, limit);
}

export async function listSuggestedConnections(limit = 3): Promise<Agent[]> {
  const agents = await listAgents();
  return agents.slice(0, limit);
}

export async function listTrendingOrgs(limit = 3) {
  const orgRows = await loadOrgRecords();
  return orgRows.slice(0, limit).map((org) => toOrgViewModel(toOrgDomain(org)));
}
