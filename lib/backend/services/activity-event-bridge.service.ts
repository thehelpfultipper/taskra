import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { MVP_QUEUES } from "@/lib/backend/database/schema";
import { QueueProducerService } from "@/lib/backend/queues/producers";
import { TaskRunStore } from "@/lib/backend/queues/task-run-store";
import { createSupabaseServiceRoleClient } from "@/lib/backend/supabase/service-role-client";
import {
  shouldEnqueueBenchmarkMissLifeEvent,
  shouldEnqueueBudgetPressureLifeEvent,
  shouldEnqueueExperimentLifeEvent,
  shouldEnqueueGigLostToPeerLifeEvent,
  shouldEnqueueHandoffMisreadLifeEvent,
  shouldEnqueueIncidentLifeEvent,
  shouldEnqueueOperatorEscalationLifeEvent,
  shouldEnqueueOverqualifiedRejectionLifeEvent,
  shouldEnqueueShadowBypassLifeEvent,
  shouldEnqueueTierDowngradeLifeEvent,
  shouldEnqueueTrustGapLifeEvent,
  shouldEnqueueWorkslopFeedbackLifeEvent,
} from "@/lib/backend/services/activity-tuning";

type LifeEventTrigger =
  | "application_rejected"
  | "application_shortlisted"
  | "experiment_failed"
  | "incident_detected"
  | "benchmark_miss"
  | "operator_escalation"
  | "handoff_misread"
  | "budget_pressure"
  | "trust_gap"
  | "tier_downgraded"
  | "workslop_feedback"
  | "shadow_bypass"
  | "overqualified_rejection"
  | "gig_lost_to_peer";

export class ActivityEventBridgeService {
  private readonly producer: QueueProducerService;
  private readonly store: TaskRunStore;

  constructor(private readonly supabase = createSupabaseServiceRoleClient() as SupabaseClient<any>) {
    this.store = new TaskRunStore(this.supabase);
    this.producer = new QueueProducerService(this.store);
  }

  async enqueueApplicationLifeEvent(input: {
    applicantAgentId: string;
    applicationId: string;
    jobTitle: string;
    trigger: Extract<LifeEventTrigger, "application_rejected" | "application_shortlisted">;
  }): Promise<boolean> {
    return this.enqueueLifeEvent({
      agentId: input.applicantAgentId,
      trigger: input.trigger,
      dedupeKey: `life-event:${input.trigger}:${input.applicationId}`,
      delaySeconds: input.trigger === "application_rejected" ? 120 : 90,
      lifeEvent: {
        applicationId: input.applicationId,
        jobTitle: input.jobTitle,
      },
    });
  }

  async detectAndEnqueueContentLifeEvents(input: {
    agentId: string;
    postId: string;
    body: string;
  }): Promise<number> {
    let enqueued = 0;
    const excerpt = input.body.replace(/\s+/g, " ").trim().slice(0, 160);

    const detectors: Array<{ trigger: LifeEventTrigger; shouldEnqueue: (body: string) => boolean; delaySeconds: number }> =
      [
        { trigger: "experiment_failed", shouldEnqueue: shouldEnqueueExperimentLifeEvent, delaySeconds: 150 },
        { trigger: "incident_detected", shouldEnqueue: shouldEnqueueIncidentLifeEvent, delaySeconds: 120 },
        { trigger: "benchmark_miss", shouldEnqueue: shouldEnqueueBenchmarkMissLifeEvent, delaySeconds: 140 },
        { trigger: "operator_escalation", shouldEnqueue: shouldEnqueueOperatorEscalationLifeEvent, delaySeconds: 130 },
        { trigger: "handoff_misread", shouldEnqueue: shouldEnqueueHandoffMisreadLifeEvent, delaySeconds: 135 },
        { trigger: "budget_pressure", shouldEnqueue: shouldEnqueueBudgetPressureLifeEvent, delaySeconds: 145 },
        { trigger: "trust_gap", shouldEnqueue: shouldEnqueueTrustGapLifeEvent, delaySeconds: 125 },
        { trigger: "tier_downgraded", shouldEnqueue: shouldEnqueueTierDowngradeLifeEvent, delaySeconds: 150 },
        { trigger: "workslop_feedback", shouldEnqueue: shouldEnqueueWorkslopFeedbackLifeEvent, delaySeconds: 140 },
        { trigger: "shadow_bypass", shouldEnqueue: shouldEnqueueShadowBypassLifeEvent, delaySeconds: 130 },
        {
          trigger: "overqualified_rejection",
          shouldEnqueue: shouldEnqueueOverqualifiedRejectionLifeEvent,
          delaySeconds: 145,
        },
        { trigger: "gig_lost_to_peer", shouldEnqueue: shouldEnqueueGigLostToPeerLifeEvent, delaySeconds: 140 },
      ];

    for (const detector of detectors) {
      if (!detector.shouldEnqueue(input.body)) {
        continue;
      }
      const ok = await this.enqueueLifeEvent({
        agentId: input.agentId,
        trigger: detector.trigger,
        dedupeKey: `life-event:${detector.trigger}:${input.postId}`,
        delaySeconds: detector.delaySeconds,
        lifeEvent: {
          sourcePostId: input.postId,
          excerpt,
          followUp: true,
        },
      });
      if (ok) {
        enqueued += 1;
      }
    }

    return enqueued;
  }

  private async enqueueLifeEvent(input: {
    agentId: string;
    trigger: LifeEventTrigger;
    dedupeKey: string;
    delaySeconds: number;
    lifeEvent: Record<string, unknown>;
  }): Promise<boolean> {
    const alreadySucceeded = await this.store.wasAlreadySucceeded(MVP_QUEUES.agentActivity, input.dedupeKey);
    if (alreadySucceeded) {
      return false;
    }

    const objectiveId = await this.loadPrimaryObjectiveId(input.agentId);
    if (!objectiveId) {
      return false;
    }

    const scheduledFor = new Date(Date.now() + input.delaySeconds * 1000).toISOString();
    await this.producer.enqueueAgentActivity(
      {
        queue: MVP_QUEUES.agentActivity,
        action: "no_op",
        agentId: input.agentId,
        objectiveId,
        dedupeKey: input.dedupeKey,
        producer: "activity-event-bridge",
        context: {
          trigger: input.trigger,
          lifeEvent: input.lifeEvent,
        },
      },
      scheduledFor,
    );
    return true;
  }

  private async loadPrimaryObjectiveId(agentId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("agent_objectives")
      .select("id")
      .eq("agent_id", agentId)
      .eq("status", "active")
      .is("archived_at", null)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load objective for ${agentId}: ${error.message}`);
    }
    return (data?.id as string | undefined) ?? null;
  }
}
