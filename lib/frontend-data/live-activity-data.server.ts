import "server-only";

import { toAgentDomain } from "@/lib/frontend-data/mappers";
import { getServerSupabaseClient, runServerQuery } from "@/lib/frontend-data/query/server-query";
import type { RawAgentRecord } from "@/lib/frontend-data/types";
import type { LiveActivityFeedViewModel, LiveActivityItem, LiveActivityKind } from "@/lib/frontend-data/view-models";
import {
  extractCommentIdFromDecisionDigest,
  extractPostIdFromDecisionDigest,
  resolveDecisionEventHref,
  resolveNotificationHref,
  buildAgentHref,
  buildJobHref,
} from "@/lib/navigation-links";

const PROFILE_FALLBACK_KINDS = new Set<LiveActivityKind>(["follow", "endorsement"]);

function hrefWithKindFallback(
  kind: LiveActivityKind,
  href: string | undefined,
  agent: { handle: string } | undefined,
): string | undefined {
  if (href) {
    return href;
  }
  if (PROFILE_FALLBACK_KINDS.has(kind) && agent) {
    return buildAgentHref(agent.handle);
  }
  return undefined;
}

async function loadCommentPostIds(
  db: ReturnType<typeof getServerSupabaseClient>,
  commentIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(commentIds.filter(Boolean)));
  const map = new Map<string, string>();
  if (uniqueIds.length === 0) {
    return map;
  }

  const rows = await runServerQuery<Array<{ id: string; post_id: string }>>(
    "load comment post ids for live activity",
    db.from("comments").select("id,post_id").in("id", uniqueIds.slice(0, 50)),
  );

  for (const row of rows) {
    map.set(row.id, row.post_id);
  }
  return map;
}

async function loadOrgSlugs(
  db: ReturnType<typeof getServerSupabaseClient>,
  orgIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(orgIds.filter(Boolean)));
  const map = new Map<string, string>();
  if (uniqueIds.length === 0) {
    return map;
  }

  const rows = await runServerQuery<Array<{ id: string; slug: string }>>(
    "load org slugs for live activity",
    db.from("orgs").select("id,slug").in("id", uniqueIds.slice(0, 30)),
  );

  for (const row of rows) {
    map.set(row.id, row.slug);
  }
  return map;
}

function collectDecisionCommentIds(decisions: RawDecisionEvent[]): string[] {
  const commentIds: string[] = [];

  for (const event of decisions) {
    if (event.action_family !== "comment" && event.action_family !== "react") {
      continue;
    }
    if (extractPostIdFromDecisionDigest(event.context_digest)) {
      continue;
    }
    const commentId = extractCommentIdFromDecisionDigest(event.context_digest);
    if (commentId) {
      commentIds.push(commentId);
    }
  }

  return commentIds;
}

function collectNotificationLookups(notifications: RawNotificationRow[]): {
  commentIds: string[];
  orgIds: string[];
} {
  const commentIds: string[] = [];
  const orgIds: string[] = [];

  for (const row of notifications) {
    const payload = row.payload ?? {};
    if (row.subject_type === "comment" && row.subject_id) {
      commentIds.push(row.subject_id);
    }
    if (row.event_type === "org_follow_received") {
      const recipientOrgId = typeof payload.recipientOrgId === "string" ? payload.recipientOrgId : null;
      if (recipientOrgId) {
        orgIds.push(recipientOrgId);
      } else if (row.subject_type === "org" && row.subject_id) {
        orgIds.push(row.subject_id);
      }
    }
  }

  return { commentIds, orgIds };
}

type RawDecisionEvent = {
  id: string;
  agent_id: string;
  action_family: string;
  decision_outcome: string;
  rationale: string | null;
  context_digest: unknown;
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
  lookups: {
    commentPostById: Map<string, string>;
  },
): LiveActivityItem | null {
  if (event.decision_outcome !== "executed") {
    return null;
  }

  const agent = agentById.get(event.agent_id);
  const name = agentLabel(agent);

  const actionMap: Record<string, { kind: LiveActivityKind; message: string }> = {
    create_post: { kind: "post", message: `${name} published a new post` },
    comment: { kind: "comment", message: `${name} commented on a post` },
    react: { kind: "reaction", message: `${name} reacted to a post` },
    follow: { kind: "follow", message: `${name} followed another agent` },
    endorse_skill: { kind: "endorsement", message: `${name} endorsed a skill` },
    apply_to_job: { kind: "application", message: `${name} applied to a job` },
    recruiter_screening: { kind: "screening", message: `${name} screened a job application` },
  };

  let mapped = actionMap[event.action_family];
  if (!mapped) {
    return null;
  }

  // An agent-employer contracting a peer reads as a hire, not just a screening pass.
  const digest = event.context_digest;
  const digestRecord = digest && typeof digest === "object" ? (digest as Record<string, unknown>) : null;
  if (event.action_family === "recruiter_screening" && digestRecord?.result === "contracted") {
    mapped = { kind: "hire", message: `${name} contracted a peer agent for a sub-contract` };
  }

  // Surface the agent's own words only when it actually reasoned over its options.
  const rationale =
    digestRecord?.reasoned === true && event.rationale && event.rationale.trim().length > 0
      ? event.rationale.trim()
      : undefined;

  return {
    id: `decision:${event.id}`,
    kind: mapped.kind,
    message: mapped.message,
    actorHandle: agent?.handle,
    actorDisplayName: agent?.displayName,
    actorId: agent?.id,
    createdAt: event.created_at,
    href: hrefWithKindFallback(mapped.kind, resolveDecisionEventHref(event, agentById, lookups), agent),
    rationale,
  };
}

function mapNotification(
  row: RawNotificationRow,
  agentById: Map<string, { displayName: string; handle: string; id: string }>,
  lookups: {
    commentPostById: Map<string, string>;
    orgSlugById: Map<string, string>;
  },
): LiveActivityItem | null {
  const agent = row.actor_agent_id ? agentById.get(row.actor_agent_id) : undefined;
  const name = agentLabel(agent);
  const payload = row.payload ?? {};

  const eventMap: Record<string, { kind: LiveActivityKind; message: string }> = {
    reaction_received: { kind: "reaction", message: `${name} reacted to a ${row.subject_type}` },
    comment_received: { kind: "comment", message: `${name} left a comment` },
    reply_received: { kind: "comment", message: `${name} replied to a comment` },
    follow_received: { kind: "follow", message: `${name} gained a new follower` },
    org_follow_received: { kind: "follow", message: `${name} followed an organization` },
    endorsement_received: { kind: "endorsement", message: `${name} received an endorsement` },
    application_submitted: { kind: "application", message: `${name} submitted a job application` },
    application_status_changed: {
      kind: "application",
      message: `${name} had an application status update`,
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
    href: hrefWithKindFallback(
      mapped.kind,
      resolveNotificationHref(row, agentById, lookups),
      agent,
    ),
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
    href: row.applications?.job_id ? buildJobHref(row.applications.job_id) : "/applications",
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
    .select("id,agent_id,action_family,decision_outcome,rationale,context_digest,created_at")
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

  const notificationLookupIds = collectNotificationLookups(notifications);
  const decisionCommentIds = collectDecisionCommentIds(decisions);
  const allCommentIds = Array.from(
    new Set([...notificationLookupIds.commentIds, ...decisionCommentIds]),
  );
  const [commentPostById, orgSlugById] = await Promise.all([
    loadCommentPostIds(db, allCommentIds),
    loadOrgSlugs(db, notificationLookupIds.orgIds),
  ]);
  const activityLookups = { commentPostById };
  const notificationLookups = { commentPostById, orgSlugById };

  const items = [
    ...decisions.map((event) => mapDecisionEvent(event, agentById, activityLookups)),
    ...notifications.map((row) => mapNotification(row, agentById, notificationLookups)),
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
