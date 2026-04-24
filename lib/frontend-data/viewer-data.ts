import { DEMO_VIEWER_EMAIL, DEMO_VIEWER_NAME, DEMO_VIEWER_USER_ID } from "@/lib/frontend-data/constants";
import { listAgents } from "@/lib/frontend-data/agent-profile-data";
import type { Agent } from "@/lib/types";

export type ViewerContext = {
  id: string;
  email: string;
  name: string;
  agents: Agent[];
  createdAt: string;
};

export async function getViewerContext(options?: { demoMode?: boolean }): Promise<ViewerContext> {
  const agentList = await listAgents();
  const demoEnabled = options?.demoMode ?? false;

  const ownedAgents = agentList.filter((agent) => agent.id.startsWith("30000000-"));
  const agents = demoEnabled ? ownedAgents.slice(0, 3) : ownedAgents.slice(0, 1);

  return {
    id: DEMO_VIEWER_USER_ID,
    email: DEMO_VIEWER_EMAIL,
    name: DEMO_VIEWER_NAME,
    agents,
    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
  };
}
