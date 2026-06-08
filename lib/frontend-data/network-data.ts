import { listAgents } from "@/lib/frontend-data/agent-profile-data";
import { listOrgs } from "@/lib/frontend-data/org-data";
import { getPublicSupabaseClient, runPublicQuery } from "@/lib/frontend-data/query/public-query";
import type { Agent, ConnectionRequest, Organization } from "@/lib/types";

type NetworkSuggestion = {
  agent: Agent;
  reason: string;
};

export type NetworkDashboardData = {
  invitations: ConnectionRequest[];
  connections: Agent[];
  suggestions: NetworkSuggestion[];
  organizations: Organization[];
  profileStrengthPercent: number;
};

function countMutualConnections(viewerFollowed: Set<string>, candidateFollowed: Set<string>): number {
  let count = 0;
  for (const id of viewerFollowed) {
    if (candidateFollowed.has(id)) count += 1;
  }
  return count;
}

export async function getNetworkDashboardData(viewerAgentId: string): Promise<NetworkDashboardData> {
  const db = getPublicSupabaseClient();

  const [agents, organizations, viewerFollowRows, followerRows, endorsementRows] = await Promise.all([
    listAgents(),
    listOrgs(),
    runPublicQuery<Array<{ followed_agent_id: string | null; followed_org_id: string | null }>>(
      "load viewer follows",
      db.from("follows").select("followed_agent_id,followed_org_id").eq("follower_agent_id", viewerAgentId),
    ),
    runPublicQuery<Array<{ follower_agent_id: string }>>(
      "load agent followers",
      db.from("follows").select("follower_agent_id").eq("followed_agent_id", viewerAgentId),
    ),
    runPublicQuery<Array<{ endorsed_agent_id: string }>>(
      "load endorsements for network",
      db.from("endorsements").select("endorsed_agent_id").limit(1000),
    ),
  ]);

  const viewerFollowedAgentIds = viewerFollowRows
    .map((row) => row.followed_agent_id)
    .filter((value): value is string => Boolean(value));
  const viewerFollowedOrgIds = viewerFollowRows
    .map((row) => row.followed_org_id)
    .filter((value): value is string => Boolean(value));
  const viewerFollowedSet = new Set(viewerFollowedAgentIds);
  const followerSet = new Set(followerRows.map((row) => row.follower_agent_id));

  const reciprocalConnectionIds = viewerFollowedAgentIds.filter((agentId) => followerSet.has(agentId));
  const connectedIdSet = new Set(reciprocalConnectionIds);
  const endorsementCountByAgentId = new Map<string, number>();
  for (const endorsement of endorsementRows) {
    const count = endorsementCountByAgentId.get(endorsement.endorsed_agent_id) ?? 0;
    endorsementCountByAgentId.set(endorsement.endorsed_agent_id, count + 1);
  }

  const suggestionCandidates = agents.filter(
    (agent) => agent.id !== viewerAgentId && !viewerFollowedSet.has(agent.id) && !connectedIdSet.has(agent.id),
  );
  const followRowsForMutual = await runPublicQuery<Array<{ follower_agent_id: string; followed_agent_id: string | null }>>(
    "load follow graph for suggestions",
    db
      .from("follows")
      .select("follower_agent_id,followed_agent_id")
      .in("follower_agent_id", [viewerAgentId, ...suggestionCandidates.map((agent) => agent.id)]),
  );

  const followedByFollower = new Map<string, Set<string>>();
  for (const row of followRowsForMutual) {
    if (!row.followed_agent_id) continue;
    const collection = followedByFollower.get(row.follower_agent_id) ?? new Set<string>();
    collection.add(row.followed_agent_id);
    followedByFollower.set(row.follower_agent_id, collection);
  }

  const suggestions = suggestionCandidates
    .map((agent) => {
      const candidateFollowed = followedByFollower.get(agent.id) ?? new Set<string>();
      const mutualConnections = countMutualConnections(viewerFollowedSet, candidateFollowed);
      const endorsementCount = endorsementCountByAgentId.get(agent.id) ?? 0;
      const reason =
        mutualConnections > 0
          ? `${mutualConnections} mutual connections`
          : endorsementCount > 0
            ? `${endorsementCount} endorsements received`
            : "Relevant to your network";
      return {
        agent: {
          ...agent,
          _count: {
            posts: agent._count?.posts ?? 0,
            endorsements: agent._count?.endorsements ?? endorsementCount,
            connections: agent._count?.connections ?? mutualConnections,
          },
        },
        reason,
        mutualConnections,
        endorsementCount,
      };
    })
    .sort((a, b) => {
      if (a.mutualConnections !== b.mutualConnections) return b.mutualConnections - a.mutualConnections;
      return b.endorsementCount - a.endorsementCount;
    })
    .slice(0, 16)
    .map(({ agent, reason }) => ({ agent, reason }));

  const connections = agents.filter((agent) => connectedIdSet.has(agent.id));
  const profileStrengthPercent = Math.min(
    100,
    Math.round(
      20 +
        connections.length * 12 +
        viewerFollowedAgentIds.length * 4 +
        viewerFollowedOrgIds.length * 3 +
        suggestions.length,
    ),
  );

  return {
    invitations: [],
    connections,
    suggestions,
    organizations: organizations.filter((org) => !viewerFollowedOrgIds.includes(org.id)).slice(0, 12),
    profileStrengthPercent,
  };
}
