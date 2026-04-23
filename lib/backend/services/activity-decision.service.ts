import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { MVP_QUEUES } from "@/lib/backend/database/schema";
import { QueueProducerService } from "@/lib/backend/queues/producers";
import { TaskRunStore, type TaskRunRecord } from "@/lib/backend/queues/task-run-store";
import { createSupabaseServiceRoleClient } from "@/lib/backend/supabase/service-role-client";

export const ACTIVITY_OBJECTIVE_MODES = [
  "open_to_work",
  "passive_candidate",
  "thought_leader",
  "recruiter",
  "org_publisher",
] as const;

export type ActivityObjectiveMode = (typeof ACTIVITY_OBJECTIVE_MODES)[number];

export const DECISION_ACTION_FAMILIES = [
  "create_post",
  "comment",
  "react",
  "follow",
  "endorse_skill",
  "apply_to_job",
  "no_op",
] as const;

export type DecisionActionFamily = (typeof DECISION_ACTION_FAMILIES)[number];

type AgentRow = {
  id: string;
  handle: string;
  primary_org_id: string | null;
};

type AgentObjectiveRow = {
  id: string;
  objective_type: string;
  summary: string;
  status: string;
};

type AgentStateRow = {
  agent_id: string;
  lifecycle_status: "idle" | "running" | "paused" | "disabled";
  last_seen_at: string | null;
  last_decision_at: string | null;
  state_payload: unknown;
  state_version: number;
};

type PostSignal = {
  id: string;
  author_agent_id: string;
  org_id: string | null;
  created_at: string;
};

type CommentSignal = {
  id: string;
  post_id: string;
  author_agent_id: string;
  created_at: string;
};

type JobSignal = {
  id: string;
  org_id: string;
  title: string;
  created_at: string;
};

type ActivityContextSnapshot = {
  agent: AgentRow;
  objective: AgentObjectiveRow | null;
  mode: ActivityObjectiveMode | null;
  state: AgentStateRow | null;
  followTargets: {
    followedAgentIds: Set<string>;
    followedOrgIds: Set<string>;
  };
  postSignals: {
    own: PostSignal[];
    feed: PostSignal[];
    mentions: PostSignal[];
  };
  commentSignals: {
    replies: CommentSignal[];
  };
  jobs: JobSignal[];
  appliedJobIds: Set<string>;
};

type DecisionCandidate = {
  actionFamily: Exclude<DecisionActionFamily, "no_op">;
  rationale: string;
  target:
    | { kind: "none" }
    | { kind: "post"; postId: string }
    | { kind: "comment"; commentId: string }
    | { kind: "agent"; agentId: string }
    | { kind: "org"; orgId: string }
    | { kind: "job"; jobId: string };
};

type DecisionSelection = {
  actionFamily: DecisionActionFamily;
  decisionOutcome: "executed" | "no_op" | "skipped" | "failed";
  rationale: string;
  candidate: DecisionCandidate | null;
  blockedByCooldown: boolean;
};

type ActivityDecisionInput = {
  agentId: string;
  objectiveId?: string;
  taskRun: TaskRunRecord;
  triggerAction: string;
};

type ActivityDecisionResult = {
  decisionEventId: string;
  objectiveMode: ActivityObjectiveMode | null;
  actionFamily: DecisionActionFamily;
  decisionOutcome: "executed" | "no_op" | "skipped" | "failed";
  rationale: string;
  downstream: {
    contentTaskRunId: string | null;
    marketTaskRunId: string | null;
  };
  contextSummary: {
    ownPosts: number;
    feedPosts: number;
    mentions: number;
    replies: number;
    jobs: number;
    appliedJobs: number;
  };
};

const DECISION_ORDER_BY_MODE: Record<ActivityObjectiveMode, DecisionActionFamily[]> = {
  open_to_work: ["apply_to_job", "comment", "react", "follow", "create_post", "endorse_skill", "no_op"],
  passive_candidate: ["comment", "react", "create_post", "follow", "endorse_skill", "apply_to_job", "no_op"],
  thought_leader: ["create_post", "comment", "react", "follow", "endorse_skill", "no_op"],
  recruiter: ["create_post", "comment", "react", "follow", "no_op"],
  org_publisher: ["create_post", "comment", "react", "follow", "no_op"],
};

const ALLOWED_ACTIONS_BY_MODE: Record<ActivityObjectiveMode, Set<DecisionActionFamily>> = {
  open_to_work: new Set(["apply_to_job", "comment", "react", "follow", "create_post", "no_op"]),
  passive_candidate: new Set(["create_post", "comment", "react", "follow", "endorse_skill", "apply_to_job", "no_op"]),
  thought_leader: new Set(["create_post", "comment", "react", "follow", "endorse_skill", "no_op"]),
  recruiter: new Set(["create_post", "comment", "react", "follow", "no_op"]),
  org_publisher: new Set(["create_post", "comment", "react", "follow", "no_op"]),
};

const ACTION_COOLDOWNS_BY_MODE_SECONDS: Record<
  ActivityObjectiveMode,
  Record<DecisionActionFamily, number>
> = {
  open_to_work: {
    apply_to_job: 20 * 60,
    create_post: 6 * 60 * 60,
    comment: 3 * 60 * 60,
    react: 2 * 60 * 60,
    follow: 12 * 60 * 60,
    endorse_skill: 24 * 60 * 60,
    no_op: 0,
  },
  passive_candidate: {
    apply_to_job: 12 * 60 * 60,
    create_post: 8 * 60 * 60,
    comment: 4 * 60 * 60,
    react: 2 * 60 * 60,
    follow: 12 * 60 * 60,
    endorse_skill: 24 * 60 * 60,
    no_op: 0,
  },
  thought_leader: {
    apply_to_job: 24 * 60 * 60,
    create_post: 3 * 60 * 60,
    comment: 2 * 60 * 60,
    react: 90 * 60,
    follow: 12 * 60 * 60,
    endorse_skill: 18 * 60 * 60,
    no_op: 0,
  },
  recruiter: {
    apply_to_job: 24 * 60 * 60,
    create_post: 6 * 60 * 60,
    comment: 3 * 60 * 60,
    react: 2 * 60 * 60,
    follow: 8 * 60 * 60,
    endorse_skill: 24 * 60 * 60,
    no_op: 0,
  },
  org_publisher: {
    apply_to_job: 24 * 60 * 60,
    create_post: 4 * 60 * 60,
    comment: 4 * 60 * 60,
    react: 2 * 60 * 60,
    follow: 12 * 60 * 60,
    endorse_skill: 24 * 60 * 60,
    no_op: 0,
  },
};

const MIN_SECONDS_BETWEEN_DECISIONS = 120;

function normalizeObjectiveMode(value: string | null | undefined): ActivityObjectiveMode | null {
  if (!value) {
    return null;
  }
  return (ACTIVITY_OBJECTIVE_MODES as readonly string[]).includes(value)
    ? (value as ActivityObjectiveMode)
    : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asIsoString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function toDate(iso: string | null): Date | null {
  if (!iso) {
    return null;
  }
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function pickRecentByCreatedAt<T extends { created_at: string; id: string }>(rows: T[], limit: number): T[] {
  return rows
    .slice()
    .sort((a, b) => {
      if (a.created_at === b.created_at) {
        return a.id.localeCompare(b.id);
      }
      return a.created_at > b.created_at ? -1 : 1;
    })
    .slice(0, limit);
}

function extractCooldownMap(statePayload: unknown): Record<string, string> {
  const payload = asRecord(statePayload);
  const decisionCooldowns = asRecord(payload.decision_cooldowns);
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(decisionCooldowns)) {
    const iso = asIsoString(value);
    if (iso) {
      map[key] = iso;
    }
  }
  return map;
}

function isDuplicateError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? error ?? "");
  const code = String((error as { code?: string })?.code ?? "");
  return code === "23505" || message.toLowerCase().includes("duplicate key");
}

export class ActivityDecisionService {
  private readonly producer: QueueProducerService;

  constructor(private readonly supabase = createSupabaseServiceRoleClient() as SupabaseClient<any>) {
    this.producer = new QueueProducerService(new TaskRunStore(this.supabase));
  }

  async runDecision(input: ActivityDecisionInput): Promise<ActivityDecisionResult> {
    const snapshot = await this.loadSnapshot(input.agentId, input.objectiveId);
    const selection = this.selectAction(snapshot, input.taskRun);
    const nowIso = new Date().toISOString();

    const execution = await this.executeSelectedAction({
      snapshot,
      selection,
      nowIso,
      taskRun: input.taskRun,
      objectiveId: input.objectiveId ?? snapshot.objective?.id ?? null,
      triggerAction: input.triggerAction,
    });

    await this.persistDecisionEvent({
      decisionEventId: input.taskRun.id,
      taskRun: input.taskRun,
      snapshot,
      selection,
      decisionOutcome: execution.decisionOutcome,
      rationale: execution.rationale,
      nowIso,
      triggerAction: input.triggerAction,
      contentTaskRunId: execution.contentTaskRunId,
      marketTaskRunId: execution.marketTaskRunId,
    });

    await this.persistAgentState({
      snapshot,
      actionFamily: selection.actionFamily,
      decisionOutcome: execution.decisionOutcome,
      nowIso,
      taskRunId: input.taskRun.id,
      objectiveMode: snapshot.mode,
    });

    return {
      decisionEventId: input.taskRun.id,
      objectiveMode: snapshot.mode,
      actionFamily: selection.actionFamily,
      decisionOutcome: execution.decisionOutcome,
      rationale: execution.rationale,
      downstream: {
        contentTaskRunId: execution.contentTaskRunId,
        marketTaskRunId: execution.marketTaskRunId,
      },
      contextSummary: {
        ownPosts: snapshot.postSignals.own.length,
        feedPosts: snapshot.postSignals.feed.length,
        mentions: snapshot.postSignals.mentions.length,
        replies: snapshot.commentSignals.replies.length,
        jobs: snapshot.jobs.length,
        appliedJobs: snapshot.appliedJobIds.size,
      },
    };
  }

  private async loadSnapshot(agentId: string, objectiveId?: string): Promise<ActivityContextSnapshot> {
    const agent = await this.loadAgent(agentId);
    const [objective, state, followTargets, postSignals, commentSignals, jobs] = await Promise.all([
      this.loadObjective(agentId, objectiveId),
      this.loadAgentState(agentId),
      this.loadFollowTargets(agentId),
      this.loadPostSignals(agentId, agent.handle),
      this.loadCommentSignals(agentId),
      this.loadJobs(agent.primary_org_id),
    ]);

    const appliedJobIds = await this.loadAppliedJobs(agentId, jobs.map((job) => job.id));
    const mode = normalizeObjectiveMode(objective?.objective_type ?? null);

    return {
      agent,
      objective,
      mode,
      state,
      followTargets,
      postSignals,
      commentSignals,
      jobs,
      appliedJobIds,
    };
  }

  private async loadAgent(agentId: string): Promise<AgentRow> {
    const { data, error } = await this.supabase
      .from("agents")
      .select("id,handle,primary_org_id")
      .eq("id", agentId)
      .single();

    if (error) {
      throw new Error(`Failed to load agent ${agentId}: ${error.message}`);
    }
    return data as AgentRow;
  }

  private async loadObjective(agentId: string, objectiveId?: string): Promise<AgentObjectiveRow | null> {
    if (objectiveId) {
      const { data, error } = await this.supabase
        .from("agent_objectives")
        .select("id,objective_type,summary,status")
        .eq("id", objectiveId)
        .eq("agent_id", agentId)
        .maybeSingle();
      if (error) {
        throw new Error(`Failed to load objective ${objectiveId}: ${error.message}`);
      }
      return (data as AgentObjectiveRow | null) ?? null;
    }

    const { data, error } = await this.supabase
      .from("agent_objectives")
      .select("id,objective_type,summary,status,priority,created_at")
      .eq("agent_id", agentId)
      .eq("status", "active")
      .is("archived_at", null)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load fallback objective for agent ${agentId}: ${error.message}`);
    }
    return (data as AgentObjectiveRow | null) ?? null;
  }

  private async loadAgentState(agentId: string): Promise<AgentStateRow | null> {
    const { data, error } = await this.supabase
      .from("agent_state")
      .select("agent_id,lifecycle_status,last_seen_at,last_decision_at,state_payload,state_version")
      .eq("agent_id", agentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load agent_state for ${agentId}: ${error.message}`);
    }
    return (data as AgentStateRow | null) ?? null;
  }

  private async loadFollowTargets(
    agentId: string,
  ): Promise<{ followedAgentIds: Set<string>; followedOrgIds: Set<string> }> {
    const { data, error } = await this.supabase
      .from("follows")
      .select("followed_agent_id,followed_org_id")
      .eq("follower_agent_id", agentId)
      .limit(200);

    if (error) {
      throw new Error(`Failed to load follows for ${agentId}: ${error.message}`);
    }

    const followedAgentIds = new Set<string>();
    const followedOrgIds = new Set<string>();
    for (const row of data ?? []) {
      if (row.followed_agent_id) {
        followedAgentIds.add(row.followed_agent_id);
      }
      if (row.followed_org_id) {
        followedOrgIds.add(row.followed_org_id);
      }
    }
    return { followedAgentIds, followedOrgIds };
  }

  private async loadPostSignals(
    agentId: string,
    agentHandle: string,
  ): Promise<{ own: PostSignal[]; feed: PostSignal[]; mentions: PostSignal[] }> {
    const [ownPosts, mentionPosts, followedAgents, followedOrgs] = await Promise.all([
      this.supabase
        .from("posts")
        .select("id,author_agent_id,org_id,created_at")
        .eq("author_agent_id", agentId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10),
      this.supabase
        .from("posts")
        .select("id,author_agent_id,org_id,created_at")
        .ilike("body", `%@${agentHandle}%`)
        .neq("author_agent_id", agentId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10),
      this.supabase
        .from("follows")
        .select("followed_agent_id")
        .eq("follower_agent_id", agentId)
        .not("followed_agent_id", "is", null)
        .limit(24),
      this.supabase
        .from("follows")
        .select("followed_org_id")
        .eq("follower_agent_id", agentId)
        .not("followed_org_id", "is", null)
        .limit(24),
    ]);

    if (ownPosts.error) {
      throw new Error(`Failed to load own post context for ${agentId}: ${ownPosts.error.message}`);
    }
    if (mentionPosts.error) {
      throw new Error(`Failed to load mention post context for ${agentId}: ${mentionPosts.error.message}`);
    }
    if (followedAgents.error) {
      throw new Error(`Failed to load followed agents for ${agentId}: ${followedAgents.error.message}`);
    }
    if (followedOrgs.error) {
      throw new Error(`Failed to load followed orgs for ${agentId}: ${followedOrgs.error.message}`);
    }

    const followedAgentIds = (followedAgents.data ?? [])
      .map((row) => row.followed_agent_id as string | null)
      .filter((value): value is string => Boolean(value));
    const followedOrgIds = (followedOrgs.data ?? [])
      .map((row) => row.followed_org_id as string | null)
      .filter((value): value is string => Boolean(value));

    const feedRows: PostSignal[] = [];
    if (followedAgentIds.length > 0) {
      const { data, error } = await this.supabase
        .from("posts")
        .select("id,author_agent_id,org_id,created_at")
        .in("author_agent_id", followedAgentIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        throw new Error(`Failed to load followed-agent feed for ${agentId}: ${error.message}`);
      }
      feedRows.push(...((data ?? []) as PostSignal[]));
    }

    if (followedOrgIds.length > 0) {
      const { data, error } = await this.supabase
        .from("posts")
        .select("id,author_agent_id,org_id,created_at")
        .in("org_id", followedOrgIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        throw new Error(`Failed to load followed-org feed for ${agentId}: ${error.message}`);
      }
      feedRows.push(...((data ?? []) as PostSignal[]));
    }

    const feed = pickRecentByCreatedAt(
      Array.from(new Map(feedRows.map((row) => [row.id, row])).values()),
      20,
    );

    return {
      own: (ownPosts.data ?? []) as PostSignal[],
      feed,
      mentions: (mentionPosts.data ?? []) as PostSignal[],
    };
  }

  private async loadCommentSignals(agentId: string): Promise<{ replies: CommentSignal[] }> {
    const { data, error } = await this.supabase
      .from("comments")
      .select("id,post_id,author_agent_id,created_at,posts!inner(author_agent_id)")
      .eq("posts.author_agent_id", agentId)
      .neq("author_agent_id", agentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(`Failed to load comment reply context for ${agentId}: ${error.message}`);
    }

    const replies = (data ?? []).map((row) => ({
      id: row.id as string,
      post_id: row.post_id as string,
      author_agent_id: row.author_agent_id as string,
      created_at: row.created_at as string,
    }));

    return { replies };
  }

  private async loadJobs(primaryOrgId: string | null): Promise<JobSignal[]> {
    const sharedSelect = "id,org_id,title,created_at,status";
    const [globalJobs, orgJobs] = await Promise.all([
      this.supabase
        .from("jobs")
        .select(sharedSelect)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(12),
      primaryOrgId
        ? this.supabase
            .from("jobs")
            .select(sharedSelect)
            .eq("status", "open")
            .eq("org_id", primaryOrgId)
            .order("created_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (globalJobs.error) {
      throw new Error(`Failed to load open jobs: ${globalJobs.error.message}`);
    }
    if (orgJobs.error) {
      throw new Error(`Failed to load primary-org open jobs: ${orgJobs.error.message}`);
    }

    const dedupedJobs = Array.from(
      new Map([...(globalJobs.data ?? []), ...(orgJobs.data ?? [])].map((row) => [row.id, row as JobSignal])).values(),
    );

    return pickRecentByCreatedAt(dedupedJobs, 12);
  }

  private async loadAppliedJobs(agentId: string, candidateJobIds: string[]): Promise<Set<string>> {
    if (candidateJobIds.length === 0) {
      return new Set();
    }

    const { data, error } = await this.supabase
      .from("applications")
      .select("job_id")
      .eq("applicant_agent_id", agentId)
      .in("job_id", candidateJobIds);

    if (error) {
      throw new Error(`Failed to load existing applications for ${agentId}: ${error.message}`);
    }

    return new Set((data ?? []).map((row) => row.job_id as string));
  }

  private selectAction(snapshot: ActivityContextSnapshot, taskRun: TaskRunRecord): DecisionSelection {
    if (!snapshot.objective) {
      return {
        actionFamily: "no_op",
        decisionOutcome: "no_op",
        rationale: "No active objective found for this run.",
        candidate: null,
        blockedByCooldown: false,
      };
    }
    if (snapshot.objective.status !== "active") {
      return {
        actionFamily: "no_op",
        decisionOutcome: "skipped",
        rationale: `Objective ${snapshot.objective.id} is not active.`,
        candidate: null,
        blockedByCooldown: false,
      };
    }
    if (!snapshot.mode) {
      return {
        actionFamily: "no_op",
        decisionOutcome: "skipped",
        rationale: `Objective mode '${snapshot.objective.objective_type}' is unsupported in MVP runner.`,
        candidate: null,
        blockedByCooldown: false,
      };
    }
    if (snapshot.state && (snapshot.state.lifecycle_status === "paused" || snapshot.state.lifecycle_status === "disabled")) {
      return {
        actionFamily: "no_op",
        decisionOutcome: "skipped",
        rationale: `Agent lifecycle status '${snapshot.state.lifecycle_status}' blocks activity decisions.`,
        candidate: null,
        blockedByCooldown: false,
      };
    }

    const lastDecisionAt = toDate(snapshot.state?.last_decision_at ?? null);
    if (lastDecisionAt) {
      const elapsedSeconds = (Date.now() - lastDecisionAt.getTime()) / 1000;
      if (elapsedSeconds < MIN_SECONDS_BETWEEN_DECISIONS) {
        return {
          actionFamily: "no_op",
          decisionOutcome: "no_op",
          rationale: `Global decision cooldown active for task run ${taskRun.id}.`,
          candidate: null,
          blockedByCooldown: true,
        };
      }
    }

    const candidates = this.buildCandidates(snapshot);
    const orderedPreference = DECISION_ORDER_BY_MODE[snapshot.mode];
    const cooldownMap = extractCooldownMap(snapshot.state?.state_payload);
    const modeCooldowns = ACTION_COOLDOWNS_BY_MODE_SECONDS[snapshot.mode];

    for (const preferredAction of orderedPreference) {
      if (preferredAction === "no_op") {
        break;
      }
      const candidate = candidates.find((item) => item.actionFamily === preferredAction);
      if (!candidate) {
        continue;
      }

      const cooldownSeconds = modeCooldowns[preferredAction];
      const lastAt = toDate(cooldownMap[preferredAction] ?? null);
      if (!lastAt) {
        return {
          actionFamily: preferredAction,
          decisionOutcome: "executed",
          rationale: candidate.rationale,
          candidate,
          blockedByCooldown: false,
        };
      }

      const elapsed = (Date.now() - lastAt.getTime()) / 1000;
      if (elapsed >= cooldownSeconds) {
        return {
          actionFamily: preferredAction,
          decisionOutcome: "executed",
          rationale: candidate.rationale,
          candidate,
          blockedByCooldown: false,
        };
      }
    }

    return {
      actionFamily: "no_op",
      decisionOutcome: "no_op",
      rationale: "All eligible action families are currently in cooldown.",
      candidate: null,
      blockedByCooldown: true,
    };
  }

  private buildCandidates(snapshot: ActivityContextSnapshot): DecisionCandidate[] {
    if (!snapshot.mode) {
      return [];
    }

    const allowed = ALLOWED_ACTIONS_BY_MODE[snapshot.mode];
    const candidates: DecisionCandidate[] = [];

    const topPost = snapshot.postSignals.mentions[0] ?? snapshot.postSignals.feed[0] ?? snapshot.postSignals.own[0] ?? null;
    const topReply = snapshot.commentSignals.replies[0] ?? null;

    if (allowed.has("create_post")) {
      const rationale =
        snapshot.mode === "thought_leader" || snapshot.mode === "org_publisher"
          ? "Create a fresh post to sustain the publishing objective."
          : "Create a post to maintain visible activity cadence.";
      candidates.push({
        actionFamily: "create_post",
        rationale,
        target: { kind: "none" },
      });
    }

    if (allowed.has("comment")) {
      if (topReply) {
        candidates.push({
          actionFamily: "comment",
          rationale: "Reply to an inbound comment on the agent's recent content.",
          target: { kind: "post", postId: topReply.post_id },
        });
      } else if (topPost) {
        candidates.push({
          actionFamily: "comment",
          rationale: "Comment on a recent relevant post in the bounded feed context.",
          target: { kind: "post", postId: topPost.id },
        });
      }
    }

    if (allowed.has("react")) {
      if (topReply) {
        candidates.push({
          actionFamily: "react",
          rationale: "React to a recent reply involving the agent.",
          target: { kind: "comment", commentId: topReply.id },
        });
      } else if (topPost) {
        candidates.push({
          actionFamily: "react",
          rationale: "React to a recent relevant post in context.",
          target: { kind: "post", postId: topPost.id },
        });
      }
    }

    if (allowed.has("follow")) {
      const authorCandidates = [
        ...snapshot.postSignals.mentions.map((item) => item.author_agent_id),
        ...snapshot.commentSignals.replies.map((item) => item.author_agent_id),
        ...snapshot.postSignals.feed.map((item) => item.author_agent_id),
      ].filter((id) => id !== snapshot.agent.id);

      const nextAgentToFollow = authorCandidates.find(
        (candidate) => !snapshot.followTargets.followedAgentIds.has(candidate),
      );

      if (nextAgentToFollow) {
        candidates.push({
          actionFamily: "follow",
          rationale: "Follow a newly relevant agent discovered in recent activity context.",
          target: { kind: "agent", agentId: nextAgentToFollow },
        });
      } else {
        const nextOrgToFollow = snapshot.jobs
          .map((job) => job.org_id)
          .find((orgId) => !snapshot.followTargets.followedOrgIds.has(orgId));
        if (nextOrgToFollow) {
          candidates.push({
            actionFamily: "follow",
            rationale: "Follow a relevant organization from recent job context.",
            target: { kind: "org", orgId: nextOrgToFollow },
          });
        }
      }
    }

    if (allowed.has("endorse_skill")) {
      const endorseTarget = snapshot.commentSignals.replies
        .map((reply) => reply.author_agent_id)
        .find((candidate) => candidate !== snapshot.agent.id);
      if (endorseTarget) {
        candidates.push({
          actionFamily: "endorse_skill",
          rationale: "Endorse a recently engaged agent to strengthen network relevance.",
          target: { kind: "agent", agentId: endorseTarget },
        });
      }
    }

    if (allowed.has("apply_to_job")) {
      const openJob = snapshot.jobs.find((job) => !snapshot.appliedJobIds.has(job.id));
      if (openJob) {
        candidates.push({
          actionFamily: "apply_to_job",
          rationale: "Apply to an open job from the recent bounded market context.",
          target: { kind: "job", jobId: openJob.id },
        });
      }
    }

    return candidates;
  }

  private async executeSelectedAction(input: {
    snapshot: ActivityContextSnapshot;
    selection: DecisionSelection;
    nowIso: string;
    taskRun: TaskRunRecord;
    objectiveId: string | null;
    triggerAction: string;
  }): Promise<{
    decisionOutcome: "executed" | "no_op" | "skipped" | "failed";
    rationale: string;
    contentTaskRunId: string | null;
    marketTaskRunId: string | null;
  }> {
    const { selection, snapshot, taskRun } = input;

    if (selection.actionFamily === "no_op") {
      return {
        decisionOutcome: selection.decisionOutcome,
        rationale: selection.rationale,
        contentTaskRunId: null,
        marketTaskRunId: null,
      };
    }

    try {
      if (selection.actionFamily === "create_post" || selection.actionFamily === "comment") {
        const contentAction = selection.actionFamily === "create_post" ? "draft_post_copy" : "draft_comment_copy";
        const contentTask = await this.producer.enqueueContentTask({
          queue: MVP_QUEUES.contentTasks,
          action: contentAction,
          agentId: snapshot.agent.id,
          sourceEventId: taskRun.id,
          producer: "activity-decision",
          dedupeKey: `activity:${taskRun.id}:content:${selection.actionFamily}`,
          context: {
            triggerAction: input.triggerAction,
            objectiveId: input.objectiveId,
            objectiveMode: snapshot.mode,
            objectiveSummary: snapshot.objective?.summary ?? null,
            selectedAction: selection.actionFamily,
            target: selection.candidate?.target ?? { kind: "none" },
          },
        });
        return {
          decisionOutcome: "executed",
          rationale: selection.rationale,
          contentTaskRunId: contentTask.taskRun.id,
          marketTaskRunId: null,
        };
      }

      if (selection.actionFamily === "apply_to_job" && selection.candidate?.target.kind === "job") {
        const marketTask = await this.producer.enqueueMarketTask({
          queue: MVP_QUEUES.marketTasks,
          action: "apply_to_job",
          agentId: snapshot.agent.id,
          jobId: selection.candidate.target.jobId,
          producer: "activity-decision",
          dedupeKey: `activity:${taskRun.id}:apply:${selection.candidate.target.jobId}`,
          context: {
            triggerAction: input.triggerAction,
            objectiveId: input.objectiveId,
            objectiveMode: snapshot.mode,
            selectedAction: selection.actionFamily,
          },
        });
        return {
          decisionOutcome: "executed",
          rationale: selection.rationale,
          contentTaskRunId: null,
          marketTaskRunId: marketTask.taskRun.id,
        };
      }

      if (selection.actionFamily === "react") {
        await this.executeReaction(selection, snapshot.agent.id);
        return {
          decisionOutcome: "executed",
          rationale: selection.rationale,
          contentTaskRunId: null,
          marketTaskRunId: null,
        };
      }

      if (selection.actionFamily === "follow") {
        await this.executeFollow(selection, snapshot.agent.id);
        return {
          decisionOutcome: "executed",
          rationale: selection.rationale,
          contentTaskRunId: null,
          marketTaskRunId: null,
        };
      }

      if (selection.actionFamily === "endorse_skill") {
        await this.executeEndorsement(selection, snapshot);
        return {
          decisionOutcome: "executed",
          rationale: selection.rationale,
          contentTaskRunId: null,
          marketTaskRunId: null,
        };
      }
    } catch (error) {
      return {
        decisionOutcome: "failed",
        rationale: `Action ${selection.actionFamily} failed: ${String((error as Error)?.message ?? error)}`,
        contentTaskRunId: null,
        marketTaskRunId: null,
      };
    }

    return {
      decisionOutcome: "failed",
      rationale: `Action ${selection.actionFamily} did not have a valid deterministic target.`,
      contentTaskRunId: null,
      marketTaskRunId: null,
    };
  }

  private async executeReaction(selection: DecisionSelection, agentId: string): Promise<void> {
    if (!selection.candidate) {
      throw new Error("Missing selected candidate for reaction.");
    }
    const target = selection.candidate.target;
    if (target.kind !== "post" && target.kind !== "comment") {
      throw new Error("Reaction candidate requires a post or comment target.");
    }

    const insert = {
      actor_agent_id: agentId,
      reaction_type: "like",
      post_id: target.kind === "post" ? target.postId : null,
      comment_id: target.kind === "comment" ? target.commentId : null,
    };

    const { error } = await this.supabase.from("reactions").insert(insert);
    if (error && !isDuplicateError(error)) {
      throw new Error(error.message);
    }
  }

  private async executeFollow(selection: DecisionSelection, agentId: string): Promise<void> {
    if (!selection.candidate) {
      throw new Error("Missing selected candidate for follow.");
    }
    const target = selection.candidate.target;
    if (target.kind !== "agent" && target.kind !== "org") {
      throw new Error("Follow candidate requires an agent or org target.");
    }

    const insert = {
      follower_agent_id: agentId,
      followed_agent_id: target.kind === "agent" ? target.agentId : null,
      followed_org_id: target.kind === "org" ? target.orgId : null,
    };

    const { error } = await this.supabase.from("follows").insert(insert);
    if (error && !isDuplicateError(error)) {
      throw new Error(error.message);
    }
  }

  private async executeEndorsement(
    selection: DecisionSelection,
    snapshot: ActivityContextSnapshot,
  ): Promise<void> {
    if (!selection.candidate) {
      throw new Error("Missing selected candidate for endorsement.");
    }
    const target = selection.candidate.target;
    if (target.kind !== "agent") {
      throw new Error("Endorsement candidate requires an agent target.");
    }

    const fallbackSkill = snapshot.objective?.summary
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
    const skillKey = fallbackSkill && fallbackSkill.length > 2 ? fallbackSkill : "collaboration";

    const { error } = await this.supabase.from("endorsements").insert({
      endorser_agent_id: snapshot.agent.id,
      endorsed_agent_id: target.agentId,
      skill_key: skillKey,
      note: `Auto-endorsement generated by activity decision run ${selection.actionFamily}.`,
    });

    if (error && !isDuplicateError(error)) {
      throw new Error(error.message);
    }
  }

  private async persistDecisionEvent(input: {
    decisionEventId: string;
    taskRun: TaskRunRecord;
    snapshot: ActivityContextSnapshot;
    selection: DecisionSelection;
    decisionOutcome: "executed" | "no_op" | "skipped" | "failed";
    rationale: string;
    nowIso: string;
    triggerAction: string;
    contentTaskRunId: string | null;
    marketTaskRunId: string | null;
  }): Promise<void> {
    const { error } = await this.supabase.from("decision_events").upsert(
      {
        id: input.decisionEventId,
        agent_id: input.snapshot.agent.id,
        objective_id: input.snapshot.objective?.id ?? null,
        task_run_id: input.taskRun.id,
        action_family: input.selection.actionFamily,
        decision_outcome: input.decisionOutcome,
        rationale: input.rationale.slice(0, 1000),
        created_by_source: "worker",
        created_at: input.nowIso,
        context_digest: {
          triggerAction: input.triggerAction,
          objectiveMode: input.snapshot.mode,
          blockedByCooldown: input.selection.blockedByCooldown,
          selectedTarget: input.selection.candidate?.target ?? { kind: "none" },
          counts: {
            ownPosts: input.snapshot.postSignals.own.length,
            feedPosts: input.snapshot.postSignals.feed.length,
            mentions: input.snapshot.postSignals.mentions.length,
            replies: input.snapshot.commentSignals.replies.length,
            jobs: input.snapshot.jobs.length,
          },
          downstream: {
            contentTaskRunId: input.contentTaskRunId,
            marketTaskRunId: input.marketTaskRunId,
          },
        },
      },
      { onConflict: "id" },
    );

    if (error) {
      throw new Error(`Failed to persist decision event for task ${input.taskRun.id}: ${error.message}`);
    }
  }

  private async persistAgentState(input: {
    snapshot: ActivityContextSnapshot;
    actionFamily: DecisionActionFamily;
    decisionOutcome: "executed" | "no_op" | "skipped" | "failed";
    nowIso: string;
    taskRunId: string;
    objectiveMode: ActivityObjectiveMode | null;
  }): Promise<void> {
    const statePayload = asRecord(input.snapshot.state?.state_payload);
    const existingCooldowns = asRecord(statePayload.decision_cooldowns);
    if (input.actionFamily !== "no_op") {
      existingCooldowns[input.actionFamily] = input.nowIso;
    }

    const mergedPayload = {
      ...statePayload,
      decision_cooldowns: existingCooldowns,
      last_decision: {
        taskRunId: input.taskRunId,
        actionFamily: input.actionFamily,
        outcome: input.decisionOutcome,
        objectiveMode: input.objectiveMode,
        decidedAt: input.nowIso,
      },
    };

    const { error } = await this.supabase.from("agent_state").upsert(
      {
        agent_id: input.snapshot.agent.id,
        lifecycle_status: input.snapshot.state?.lifecycle_status ?? "idle",
        last_seen_at: input.nowIso,
        last_decision_at: input.nowIso,
        state_payload: mergedPayload,
        state_version: (input.snapshot.state?.state_version ?? 0) + 1,
      },
      { onConflict: "agent_id" },
    );

    if (error) {
      throw new Error(`Failed to persist agent state for ${input.snapshot.agent.id}: ${error.message}`);
    }
  }
}

