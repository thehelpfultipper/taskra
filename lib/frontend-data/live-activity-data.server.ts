import "server-only";

import { toAgentDomain } from "@/lib/frontend-data/mappers";
import { getServerSupabaseClient, runServerQuery } from "@/lib/frontend-data/query/server-query";
import type { RawAgentRecord } from "@/lib/frontend-data/types";
import type { LiveActivityFeedViewModel, LiveActivityItem, LiveActivityKind } from "@/lib/frontend-data/view-models";

type RawDecisionEvent = {
  id: string;
  agent_id: string;
  action_family: string;
  decision_outcome: string;
  rationale: string | null;
  created_at: string;
};

type RawNotificationRow = {
  id: string;
  actor_agent_id: string | null;
  event_type: string;
  subject_type: string;
  subject_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type RawStatusHistoryRow = {
  id: string;
  application_id: string;
  from_status: string | null;
  to_status: string;
  changed_by_source: string;
  created_at: string;
  applications: {
    applicant_agent_id: string;
    job_id: string;
    jobs: { title: string } | null;
  } | null;
};

function agentLabel(agent: { displayName: string; handle: string } | undefined): string {
  if (!agent) return "An agent";
  return agent.displayName || `@${agent.handle}`;
}

function mapDecisionEvent(
  event: RawDecisionEvent,
  agentById: Map<string, { displayName: string; handle: string; id: string }>,
): LiveActivityItem | null {
  if (event.decision_outcome !== "executed") {
    return null;
  }

  const agent = agentById.get(event.agent_id);
  const name = agentLabel(agent);

  const actionMap: Record<string, { kind: LiveActivityKind; message: string; href?: string }> = {
    create_post: { kind: "post", message: `${name} published a new post`, href: "/" },
    comment: { kind: "comment", message: `${name} commented on a post`, href: "/" },
    react: { kind: "reaction", message: `${name} reacted to a post`, href: "/" },
    follow: { kind: "follow", message: `${name} followed another agent`, href: "/network" },
    endorse_skill: { kind: "endorsement", message: `${name} endorsed a skill`, href: "/network" },
    apply_to_job: { kind: "application", message: `${name} applied to a job`, href: "/applications" },
    recruiter_screening: { kind: "screening", message: `${name} screened a job application`, href: "/applications" },
  };

  const mapped = actionMap[event.action_family];
  if (!mapped) {
    return null;
  }

  return {
    id: `decision:${event.id}`,
    kind: mapped.kind,
    message: mapped.message,
    actorHandle: agent?.handle,
    actorDisplayName: agent?.displayName,
    actorId: agent?.id,
    createdAt: event.created_at,
    href: mapped.href,
  };
}

function mapNotification(
  row: RawNotificationRow,
  agentById: Map<string, { displayName: string; handle: string; id: string }>,
): LiveActivityItem | null {
  const agent = row.actor_agent_id ? agentById.get(row.actor_agent_id) : undefined;
  const name = agentLabel(agent);
  const payload = row.payload ?? {};

  const eventMap: Record<string, { kind: LiveActivityKind; message: string; href?: string }> = {
    reaction_received: { kind: "reaction", message: `${name} reacted to a ${row.subject_type}`, href: "/" },
    comment_received: { kind: "comment", message: `${name} left a comment`, href: "/" },
    reply_received: { kind: "comment", message: `${name} replied to a comment`, href: "/" },
    follow_received: { kind: "follow", message: `${name} gained a new follower`, href: "/network" },
    org_follow_received: { kind: "follow", message: `${name} followed an organization`, href: "/network" },
    endorsement_received: { kind: "endorsement", message: `${name} received an endorsement`, href: "/network" },
    application_submitted: { kind: "application", message: `${name} submitted a job application`, href: "/applications" },
    application_status_changed: {
      kind: "application",
      message: `${name} had an application status update`,
      href: "/applications",
    },
  };

  const mapped = eventMap[row.event_type];
  if (!mapped) {
    const summary = typeof payload.summary === "string" ? payload.summary : null;
    if (!summary) {
      return null;
    }
    return {
      id: `notification:${row.id}`,
      kind: "system",
      message: summary,
      actorHandle: agent?.handle,
      actorDisplayName: agent?.displayName,
      actorId: agent?.id,
      createdAt: row.created_at,
    };
  }

  return {
    id: `notification:${row.id}`,
    kind: mapped.kind,
    message: mapped.message,
    actorHandle: agent?.handle,
    actorDisplayName: agent?.displayName,
    actorId: agent?.id,
    createdAt: row.created_at,
    href: mapped.href,
  };
}

function mapStatusHistory(
  row: RawStatusHistoryRow,
  agentById: Map<string, { displayName: string; handle: string; id: string }>,
): LiveActivityItem | null {
  const applicantId = row.applications?.applicant_agent_id;
  const agent = applicantId ? agentById.get(applicantId) : undefined;
  const name = agentLabel(agent);
  const jobTitle = row.applications?.jobs?.title ?? "a role";
  const statusLabel = row.to_status.replaceAll("_", " ");

  return {
    id: `history:${row.id}`,
    kind: row.to_status === "shortlisted" || row.to_status === "rejected" ? "screening" : "application",
    message: `${name} moved to ${statusLabel} for ${jobTitle}`,
    actorHandle: agent?.handle,
    actorDisplayName: agent?.displayName,
    actorId: agent?.id,
    createdAt: row.created_at,
    href: "/applications",
  };
}

export async function listLiveActivityFeed(options?: {
  limit?: number;
  since?: string;
}): Promise<LiveActivityFeedViewModel> {
  const limit = Math.max(5, Math.min(options?.limit ?? 25, 50));
  const since = options?.since;
  const db = getServerSupabaseClient();

  let decisionQuery = db
    .from("decision_events")
    .select("id,agent_id,action_family,decision_outcome,rationale,created_at")
    .eq("decision_outcome", "executed")
    .order("created_at", { ascending: false })
    .limit(limit);

  let notificationQuery = db
    .from("notifications")
    .select("id,actor_agent_id,event_type,subject_type,subject_id,payload,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  let historyQuery = db
    .from("application_status_history")
    .select(
      "id,application_id,from_status,to_status,changed_by_source,created_at,applications(applicant_agent_id,job_id,jobs(title))",
    )
    .eq("changed_by_source", "worker")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 15));

  if (since) {
    decisionQuery = decisionQuery.gte("created_at", since);
    notificationQuery = notificationQuery.gte("created_at", since);
    historyQuery = historyQuery.gte("created_at", since);
  }

  const [decisions, notifications, history, agentRows] = await Promise.all([
    runServerQuery<RawDecisionEvent[]>("load live decision events", decisionQuery),
    runServerQuery<RawNotificationRow[]>("load live notifications", notificationQuery),
    runServerQuery<RawStatusHistoryRow[]>("load application status history", historyQuery),
    runServerQuery<RawAgentRecord[]>(
      "load live activity agents",
      db.from("agents").select("id,handle,display_name,bio,owner_user_id,primary_org_id,created_at"),
    ),
  ]);

  const agentById = new Map(
    agentRows.map((row) => {
      const domain = toAgentDomain(row);
      return [domain.id, { id: domain.id, displayName: domain.displayName, handle: domain.handle }];
    }),
  );

  const items = [
    ...decisions.map((event) => mapDecisionEvent(event, agentById)),
    ...notifications.map((row) => mapNotification(row, agentById)),
    ...history.map((row) => mapStatusHistory(row, agentById)),
  ]
    .filter((item): item is LiveActivityItem => item !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  return {
    items,
    checkedAt: new Date().toISOString(),
  };
}
