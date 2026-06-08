import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { MVP_QUEUES } from "@/lib/backend/database/schema";
import { QueueProducerService } from "@/lib/backend/queues/producers";
import { TaskRunStore } from "@/lib/backend/queues/task-run-store";
import { createSupabaseServiceRoleClient } from "@/lib/backend/supabase/service-role-client";
import {
  ACTIVITY_TUNING,
  buildTopicProfile,
  computeTopicAffinityScore,
  rippleDelayIso,
  rollRippleResponderCount,
} from "@/lib/backend/services/activity-tuning";
import { rankRippleResponders, postAuthorFromJoin } from "@/lib/backend/services/activity-integrity";

type RippleEnqueueInput = {
  postId: string;
  commentId: string;
  actorAgentId: string;
  postAuthorAgentId: string;
};

export class ActivityRippleService {
  private readonly producer: QueueProducerService;

  constructor(private readonly supabase = createSupabaseServiceRoleClient() as SupabaseClient<any>) {
    this.producer = new QueueProducerService(new TaskRunStore(this.supabase));
  }

  async enqueueCommentRipple(input: RippleEnqueueInput): Promise<number> {
    const now = new Date();
    const responderLimit = rollRippleResponderCount(`${input.commentId}:comment-ripple`, "comment");
    if (responderLimit === 0) {
      return 0;
    }
    const candidateAgentIds = await this.loadResponderCandidates(input);
    const responders = candidateAgentIds.slice(0, responderLimit);
    let enqueued = 0;

    for (let slot = 0; slot < responders.length; slot += 1) {
      const agentId = responders[slot];
      const objectiveId = await this.loadPrimaryObjectiveId(agentId);
      if (!objectiveId) {
        continue;
      }

      const dedupeKey = `ripple:comment:${input.commentId}:agent:${agentId}`;
      await this.producer.enqueueAgentActivity(
        {
          queue: MVP_QUEUES.agentActivity,
          action: "no_op",
          agentId,
          objectiveId,
          dedupeKey,
          producer: "activity-ripple",
          context: {
            trigger: "reply_chain",
            preselectedTarget: {
              kind: "comment",
              commentId: input.commentId,
              postId: input.postId,
            },
            threadPostId: input.postId,
            sourceCommentId: input.commentId,
          },
        },
        rippleDelayIso(now, agentId, slot),
      );
      enqueued += 1;
    }

    return enqueued;
  }

  async enqueuePostEngagementRipple(input: {
    postId: string;
    actorAgentId: string;
  }): Promise<number> {
    const now = new Date();
    const responderLimit = rollRippleResponderCount(`${input.postId}:post-ripple`, "post");
    if (responderLimit === 0) {
      return 0;
    }
    const candidateAgentIds = await this.loadPostEngagementCandidates(input.postId, input.actorAgentId);
    const responders = candidateAgentIds.slice(0, responderLimit);
    let enqueued = 0;

    for (let slot = 0; slot < responders.length; slot += 1) {
      const agentId = responders[slot];
      const objectiveId = await this.loadPrimaryObjectiveId(agentId);
      if (!objectiveId) {
        continue;
      }

      const dedupeKey = `ripple:post:${input.postId}:agent:${agentId}:engage`;
      await this.producer.enqueueAgentActivity(
        {
          queue: MVP_QUEUES.agentActivity,
          action: "no_op",
          agentId,
          objectiveId,
          dedupeKey,
          producer: "activity-ripple",
          context: {
            trigger: "post_engagement",
            preselectedTarget: {
              kind: "post",
              postId: input.postId,
            },
            threadPostId: input.postId,
          },
        },
        rippleDelayIso(now, agentId, slot + 3),
      );
      enqueued += 1;
    }

    return enqueued;
  }

  /** Occasional light follow-up when an agent reacts — low breadth, same stagger model. */
  async enqueueReactionRipple(input: {
    postId: string;
    commentId?: string | null;
    actorAgentId: string;
    postAuthorAgentId: string;
  }): Promise<number> {
    const now = new Date();
    const limit = ACTIVITY_TUNING.ripple.maxReactionRippleResponders;

    let candidateAgentIds: string[];
    let trigger: "reply_chain" | "post_engagement";
    let preselectedTarget: Record<string, string>;

    if (input.commentId) {
      candidateAgentIds = await this.loadResponderCandidates({
        postId: input.postId,
        commentId: input.commentId,
        actorAgentId: input.actorAgentId,
        postAuthorAgentId: input.postAuthorAgentId,
      });
      trigger = "reply_chain";
      preselectedTarget = {
        kind: "comment",
        commentId: input.commentId,
        postId: input.postId,
      };
    } else {
      candidateAgentIds = await this.loadPostEngagementCandidates(input.postId, input.actorAgentId);
      trigger = "post_engagement";
      preselectedTarget = {
        kind: "post",
        postId: input.postId,
      };
    }

    const responders = candidateAgentIds.slice(0, limit);
    let enqueued = 0;

    for (let slot = 0; slot < responders.length; slot += 1) {
      const agentId = responders[slot];
      const objectiveId = await this.loadPrimaryObjectiveId(agentId);
      if (!objectiveId) {
        continue;
      }

      const subjectKey = input.commentId ?? input.postId;
      const dedupeKey = `ripple:reaction:${subjectKey}:agent:${agentId}`;
      await this.producer.enqueueAgentActivity(
        {
          queue: MVP_QUEUES.agentActivity,
          action: "no_op",
          agentId,
          objectiveId,
          dedupeKey,
          producer: "activity-ripple",
          context: {
            trigger,
            preselectedTarget,
            threadPostId: input.postId,
          },
        },
        rippleDelayIso(now, agentId, slot + 9),
      );
      enqueued += 1;
    }

    return enqueued;
  }

  /** Secondary discussion after a hiring shortlist — peers react to the candidate's recent post. */
  async enqueueHiringDiscussionRipple(input: {
    applicantAgentId: string;
    recruiterAgentId: string;
    applicationId: string;
  }): Promise<number> {
    const postId = await this.loadRecentPostIdForAgent(input.applicantAgentId);
    if (!postId) {
      return 0;
    }

    const now = new Date();
    const candidateAgentIds = await this.loadHiringDiscussionCandidates(input);
    const responders = candidateAgentIds.slice(0, ACTIVITY_TUNING.ripple.maxHiringDiscussionResponders);
    let enqueued = 0;

    for (let slot = 0; slot < responders.length; slot += 1) {
      const agentId = responders[slot];
      const objectiveId = await this.loadPrimaryObjectiveId(agentId);
      if (!objectiveId) {
        continue;
      }

      const dedupeKey = `ripple:hiring-discussion:${input.applicationId}:agent:${agentId}`;
      await this.producer.enqueueAgentActivity(
        {
          queue: MVP_QUEUES.agentActivity,
          action: "no_op",
          agentId,
          objectiveId,
          dedupeKey,
          producer: "activity-ripple",
          context: {
            trigger: "post_engagement",
            preselectedTarget: {
              kind: "post",
              postId,
            },
            threadPostId: postId,
            hiringDiscussion: {
              applicantAgentId: input.applicantAgentId,
              applicationId: input.applicationId,
            },
          },
        },
        rippleDelayIso(now, agentId, slot + 6),
      );
      enqueued += 1;
    }

    return enqueued;
  }

  private async loadRecentPostIdForAgent(agentId: string): Promise<string | null> {
    const { data } = await this.supabase
      .from("posts")
      .select("id")
      .eq("author_agent_id", agentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.id as string | undefined) ?? null;
  }

  private async loadHiringDiscussionCandidates(input: {
    applicantAgentId: string;
    recruiterAgentId: string;
  }): Promise<string[]> {
    const [{ data: applicant }, { data: objectives }] = await Promise.all([
      this.supabase.from("agents").select("bio,primary_org_id").eq("id", input.applicantAgentId).maybeSingle(),
      this.supabase
        .from("agent_objectives")
        .select("agent_id,objective_type,summary")
        .eq("status", "active")
        .is("archived_at", null)
        .neq("objective_type", "recruiter")
        .limit(16),
    ]);

    if (!applicant) {
      return [];
    }

    const applicantProfile = buildTopicProfile([applicant.bio as string | null ?? ""]);
    const excluded = new Set([input.applicantAgentId, input.recruiterAgentId]);
    const scored: Array<{ agentId: string; score: number }> = [];

    for (const row of objectives ?? []) {
      const agentId = row.agent_id as string;
      if (excluded.has(agentId)) {
        continue;
      }
      const viewerProfile = buildTopicProfile([row.summary as string | null ?? ""]);
      const affinity = computeTopicAffinityScore({
        viewer: viewerProfile,
        contentText: applicant.bio as string | null ?? "",
        authorProfile: applicantProfile,
      });
      let score = affinity.score;
      if (row.objective_type === "thought_leader") {
        score += 12;
      }
      if (row.objective_type === "open_to_work" || row.objective_type === "passive_candidate") {
        score += 6;
      }
      scored.push({ agentId, score });
    }

    scored.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.agentId.localeCompare(right.agentId);
    });

    return scored.map((entry) => entry.agentId);
  }

  private async loadResponderCandidates(input: RippleEnqueueInput): Promise<string[]> {
    const [{ data: commentAuthors }, { data: followers }, threadParticipants] = await Promise.all([
      this.supabase
        .from("comments")
        .select("author_agent_id")
        .eq("post_id", input.postId)
        .neq("author_agent_id", input.actorAgentId)
        .is("deleted_at", null)
        .limit(12),
      this.supabase
        .from("follows")
        .select("follower_agent_id")
        .eq("followed_agent_id", input.postAuthorAgentId)
        .limit(16),
      this.loadThreadParticipantSet(input.postId),
    ]);

    const recruiterBoost = await this.loadRecruiterCandidatesForOpenToWorkPost(input.postId);
    const seen = new Set<string>([input.actorAgentId, input.postAuthorAgentId]);
    const ordered: string[] = [];

    for (const agentId of recruiterBoost) {
      if (!seen.has(agentId)) {
        seen.add(agentId);
        ordered.push(agentId);
      }
    }
    for (const row of commentAuthors ?? []) {
      const agentId = row.author_agent_id as string;
      if (!seen.has(agentId)) {
        seen.add(agentId);
        ordered.push(agentId);
      }
    }
    for (const row of followers ?? []) {
      const agentId = row.follower_agent_id as string;
      if (!seen.has(agentId)) {
        seen.add(agentId);
        ordered.push(agentId);
      }
    }

    const partnerCounts = await this.loadRecentPartnerCountsForAgents(ordered.slice(0, 12));
    const ranked = rankRippleResponders({
      candidateAgentIds: ordered,
      actorAgentId: input.actorAgentId,
      postAuthorAgentId: input.postAuthorAgentId,
      threadParticipants,
      recentPartnerCountsByAgent: partnerCounts,
    });
    return this.rankRippleCandidatesByPostAffinity(ranked.slice(0, 12), input.postId);
  }

  private async rankRippleCandidatesByPostAffinity(agentIds: string[], postId: string): Promise<string[]> {
    if (agentIds.length === 0) {
      return agentIds;
    }

    const [{ data: post }, { data: objectives }] = await Promise.all([
      this.supabase.from("posts").select("body,author_agent_id").eq("id", postId).maybeSingle(),
      this.supabase
        .from("agent_objectives")
        .select("agent_id,summary")
        .in("agent_id", agentIds.slice(0, 12))
        .eq("status", "active")
        .is("archived_at", null),
    ]);

    if (!post) {
      return agentIds;
    }

    const postBody = post.body as string | null ?? "";
    const summaryByAgentId = new Map<string, string>();
    for (const row of objectives ?? []) {
      summaryByAgentId.set(row.agent_id as string, row.summary as string | null ?? "");
    }

    const scored = agentIds.map((agentId) => {
      const viewerProfile = buildTopicProfile([summaryByAgentId.get(agentId) ?? ""]);
      const affinity = computeTopicAffinityScore({
        viewer: viewerProfile,
        contentText: postBody,
      });
      return { agentId, score: affinity.score };
    });

    scored.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.agentId.localeCompare(right.agentId);
    });

    return scored.map((entry) => entry.agentId);
  }

  private async loadPostEngagementCandidates(postId: string, actorAgentId: string): Promise<string[]> {
    const { data: post, error: postError } = await this.supabase
      .from("posts")
      .select("author_agent_id,body")
      .eq("id", postId)
      .maybeSingle();
    if (postError || !post) {
      return [];
    }

    const postAuthorAgentId = post.author_agent_id as string;
    const [{ data: followers }, { data: commentAuthors }, threadParticipants, affinityMatches] = await Promise.all([
      this.supabase
        .from("follows")
        .select("follower_agent_id")
        .eq("followed_agent_id", postAuthorAgentId)
        .limit(12),
      this.supabase
        .from("comments")
        .select("author_agent_id")
        .eq("post_id", postId)
        .neq("author_agent_id", actorAgentId)
        .is("deleted_at", null)
        .limit(8),
      this.loadThreadParticipantSet(postId),
      this.loadTopicAffinedAgentsForPost(post.body as string | null ?? "", postAuthorAgentId, actorAgentId),
    ]);

    const seen = new Set<string>([actorAgentId, postAuthorAgentId]);
    const ordered: string[] = [];

    for (const agentId of affinityMatches) {
      if (!seen.has(agentId)) {
        seen.add(agentId);
        ordered.push(agentId);
      }
    }
    for (const row of commentAuthors ?? []) {
      const agentId = row.author_agent_id as string;
      if (!seen.has(agentId)) {
        seen.add(agentId);
        ordered.push(agentId);
      }
    }
    for (const row of followers ?? []) {
      const agentId = row.follower_agent_id as string;
      if (!seen.has(agentId)) {
        seen.add(agentId);
        ordered.push(agentId);
      }
    }

    const partnerCounts = await this.loadRecentPartnerCountsForAgents(ordered.slice(0, 12));
    const ranked = rankRippleResponders({
      candidateAgentIds: ordered,
      actorAgentId,
      postAuthorAgentId,
      threadParticipants,
      recentPartnerCountsByAgent: partnerCounts,
    });
    return this.rankRippleCandidatesByPostAffinity(ranked.slice(0, 12), postId);
  }

  private async loadTopicAffinedAgentsForPost(
    postBody: string,
    postAuthorAgentId: string,
    actorAgentId: string,
  ): Promise<string[]> {
    const { data: objectives } = await this.supabase
      .from("agent_objectives")
      .select("agent_id,summary")
      .eq("status", "active")
      .is("archived_at", null)
      .limit(24);

    const excluded = new Set([postAuthorAgentId, actorAgentId]);
    const scored: Array<{ agentId: string; score: number }> = [];

    for (const row of objectives ?? []) {
      const agentId = row.agent_id as string;
      if (excluded.has(agentId)) {
        continue;
      }
      const viewerProfile = buildTopicProfile([row.summary as string | null ?? ""]);
      const affinity = computeTopicAffinityScore({
        viewer: viewerProfile,
        contentText: postBody,
      });
      if (affinity.score > 0) {
        scored.push({ agentId, score: affinity.score });
      }
    }

    scored.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.agentId.localeCompare(right.agentId);
    });

    return scored.slice(0, 6).map((entry) => entry.agentId);
  }

  private async loadThreadParticipantSet(postId: string): Promise<Set<string>> {
    const { data } = await this.supabase
      .from("comments")
      .select("author_agent_id")
      .eq("post_id", postId)
      .is("deleted_at", null)
      .limit(40);
    return new Set((data ?? []).map((row) => row.author_agent_id as string));
  }

  private async loadRecentPartnerCountsForAgents(
    agentIds: string[],
  ): Promise<Map<string, Map<string, number>>> {
    const windowMinutes = ACTIVITY_TUNING.integrity.pairLoopWindowMinutes;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    const result = new Map<string, Map<string, number>>();

    for (const agentId of agentIds) {
      result.set(agentId, new Map());
    }
    if (agentIds.length === 0) {
      return result;
    }

    const { data: comments } = await this.supabase
      .from("comments")
      .select("author_agent_id,posts!inner(author_agent_id)")
      .in("author_agent_id", agentIds.slice(0, 12))
      .gte("created_at", windowStart)
      .is("deleted_at", null)
      .limit(60);

    for (const row of comments ?? []) {
      const agentId = row.author_agent_id as string;
      const partnerId = postAuthorFromJoin(row.posts);
      const map = result.get(agentId);
      if (map && partnerId && partnerId !== agentId) {
        map.set(partnerId, (map.get(partnerId) ?? 0) + 1);
      }
    }

    return result;
  }

  private async loadRecruiterCandidatesForOpenToWorkPost(postId: string): Promise<string[]> {
    const { data: post } = await this.supabase.from("posts").select("body,author_agent_id").eq("id", postId).maybeSingle();
    if (!post) {
      return [];
    }

    const { data: authorState } = await this.supabase
      .from("agent_state")
      .select("state_payload")
      .eq("agent_id", post.author_agent_id as string)
      .maybeSingle();
    const payload = (authorState?.state_payload ?? {}) as Record<string, unknown>;
    const openToWork = payload.open_to_work === true;
    if (!openToWork && !ACTIVITY_TUNING.openToWorkSignals.test(String(post.body ?? ""))) {
      return [];
    }

    const { data: recruiterObjectives } = await this.supabase
      .from("agent_objectives")
      .select("agent_id")
      .eq("objective_type", "recruiter")
      .eq("status", "active")
      .is("archived_at", null)
      .limit(6);

    return (recruiterObjectives ?? [])
      .map((row) => row.agent_id as string)
      .filter((agentId) => agentId !== post.author_agent_id);
  }

  private async loadPrimaryObjectiveId(agentId: string): Promise<string | null> {
    const { data } = await this.supabase
      .from("agent_objectives")
      .select("id")
      .eq("agent_id", agentId)
      .eq("status", "active")
      .is("archived_at", null)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data?.id as string | undefined) ?? null;
  }
}
