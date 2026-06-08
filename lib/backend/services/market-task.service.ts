import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { MVP_QUEUES } from "@/lib/backend/database/schema";
import { QueueProducerService } from "@/lib/backend/queues/producers";
import { type MarketTaskMessage } from "@/lib/backend/queues/contracts";
import { TaskRunStore, type TaskRunRecord } from "@/lib/backend/queues/task-run-store";
import { CredibilityService } from "@/lib/backend/services/credibility.service";
import { ActivityRippleService } from "@/lib/backend/services/activity-ripple.service";
import { SafetyRailsService } from "@/lib/backend/services/safety-rails.service";
import { createSupabaseServiceRoleClient } from "@/lib/backend/supabase/service-role-client";

type DecisionOutcome = "executed" | "no_op" | "skipped" | "failed";
type ApplicationStatus = "submitted" | "in_review" | "shortlisted" | "rejected" | "withdrawn" | "hired";

type AgentRow = {
  id: string;
  owner_user_id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  primary_org_id: string | null;
};

type JobRow = {
  id: string;
  org_id: string;
  created_by_user_id: string;
  title: string;
  description: string;
  status: "draft" | "open" | "closed";
  closes_at: string | null;
};

type ApplicationRow = {
  id: string;
  job_id: string;
  applicant_agent_id: string;
  current_status: ApplicationStatus;
  created_at: string;
};

type AgentStateRow = {
  agent_id: string;
  lifecycle_status: "idle" | "running" | "paused" | "disabled";
  state_payload: unknown;
};

type ObjectiveRow = {
  id: string;
  objective_type: string;
  summary: string;
};

type MatchEvaluation = {
  eligible: boolean;
  score: number;
  threshold: number;
  checks: Array<{ key: string; passed: boolean; weight: number; note: string }>;
  overlapKeywords: string[];
  rationale: string;
};

type ScreeningEvaluation = {
  nextStatus: "shortlisted" | "in_review" | "rejected";
  score: number;
  threshold: number;
  checks: Array<{ key: string; passed: boolean; weight: number; note: string }>;
  rationale: string;
};

type ProcessMarketTaskResult = {
  decisionOutcome: DecisionOutcome;
  action: MarketTaskMessage["action"];
  rationale: string;
  details: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function hasDuplicateKeyError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code ?? "");
  const message = String((error as { message?: string })?.message ?? "");
  return code === "23505" || message.toLowerCase().includes("duplicate key");
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, " ")
      .split(/\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 3),
  );
}

function buildOverlap(profileText: string, jobText: string): string[] {
  const profile = tokenize(profileText);
  const job = tokenize(jobText);
  const overlap: string[] = [];
  for (const token of profile) {
    if (job.has(token)) {
      overlap.push(token);
    }
  }
  return overlap.slice(0, 8);
}

export class MarketTaskService {
  private readonly producer: QueueProducerService;
  private readonly credibility: CredibilityService;
  private readonly safetyRails: SafetyRailsService;
  private readonly ripple: ActivityRippleService;

  constructor(private readonly supabase = createSupabaseServiceRoleClient() as SupabaseClient<any>) {
    this.producer = new QueueProducerService(new TaskRunStore(this.supabase));
    this.credibility = new CredibilityService(this.supabase);
    this.safetyRails = new SafetyRailsService(this.supabase);
    this.ripple = new ActivityRippleService(this.supabase);
  }

  async processTask(
    message: MarketTaskMessage,
    taskRun: TaskRunRecord,
  ): Promise<ProcessMarketTaskResult> {
    if (message.action === "apply_to_job") {
      return this.processApplyTask(message, taskRun);
    }
    if (message.action === "recruiter_screening") {
      return this.processRecruiterScreeningTask(message, taskRun);
    }
    throw new Error(`Unsupported market task action: ${String(message.action)}`);
  }

  private async processApplyTask(
    message: MarketTaskMessage,
    taskRun: TaskRunRecord,
  ): Promise<ProcessMarketTaskResult> {
    const taskContext = asRecord(message.context);
    const [agent, job, state, objective] = await Promise.all([
      this.loadAgent(message.agentId),
      this.loadJob(message.jobId),
      this.loadAgentState(message.agentId),
      this.loadPrimaryObjective(message.agentId),
    ]);

    const safety = await this.safetyRails.evaluateAgentAction(agent.id, "apply_to_job");
    if (!safety.allowed) {
      const rationale = `Safety rail blocked 'apply_to_job' (${safety.reason ?? "unspecified"}).`;
      await this.persistDecisionEvent({
        taskRun,
        agentId: agent.id,
        actionFamily: "apply_to_job",
        decisionOutcome: "no_op",
        rationale,
        contextDigest: {
          phase: "application_decision",
          reason: "safety_rail_block",
          safety,
          jobId: job.id,
          context: taskContext,
        },
      });
      return {
        decisionOutcome: "no_op",
        action: message.action,
        rationale,
        details: {
          jobId: job.id,
          agentId: agent.id,
          safety,
        },
      };
    }

    if (job.status !== "open" || (job.closes_at && Date.parse(job.closes_at) <= Date.now())) {
      const rationale = "Job is not currently open for new applications.";
      await this.persistDecisionEvent({
        taskRun,
        agentId: agent.id,
        actionFamily: "apply_to_job",
        decisionOutcome: "skipped",
        rationale,
        contextDigest: {
          phase: "application_decision",
          reason: "job_not_open",
          jobId: job.id,
          context: taskContext,
        },
      });
      return {
        decisionOutcome: "skipped",
        action: message.action,
        rationale,
        details: { jobId: job.id, agentId: agent.id },
      };
    }

    const existingApplication = await this.loadApplication(job.id, agent.id);
    if (existingApplication) {
      const rationale = "Application already exists for this agent and job.";
      await this.persistDecisionEvent({
        taskRun,
        agentId: agent.id,
        actionFamily: "apply_to_job",
        decisionOutcome: "skipped",
        rationale,
        contextDigest: {
          phase: "application_decision",
          reason: "duplicate_application",
          jobId: job.id,
          applicationId: existingApplication.id,
          currentStatus: existingApplication.current_status,
        },
      });
      return {
        decisionOutcome: "skipped",
        action: message.action,
        rationale,
        details: {
          applicationId: existingApplication.id,
          currentStatus: existingApplication.current_status,
        },
      };
    }

    const match = this.evaluateApplicationMatch({
      agent,
      state,
      objective,
      job,
    });
    if (!match.eligible) {
      await this.persistDecisionEvent({
        taskRun,
        agentId: agent.id,
        actionFamily: "apply_to_job",
        decisionOutcome: "no_op",
        rationale: match.rationale,
        contextDigest: {
          phase: "application_decision",
          reason: "not_eligible",
          jobId: job.id,
          match,
        },
      });
      return {
        decisionOutcome: "no_op",
        action: message.action,
        rationale: match.rationale,
        details: {
          jobId: job.id,
          agentId: agent.id,
          match,
        },
      };
    }

    const application = await this.createApplication(job.id, agent.id);
    await this.insertApplicationStatusHistory({
      applicationId: application.id,
      fromStatus: null,
      toStatus: "submitted",
      note: `Auto-submitted by market worker. score=${match.score}/${match.threshold}; overlap=${match.overlapKeywords.join(",") || "none"}`,
    });

    const contentTask = await this.producer.enqueueContentTask({
      queue: MVP_QUEUES.contentTasks,
      action: "draft_application_cover_note",
      agentId: agent.id,
      sourceEventId: taskRun.id,
      producer: "market-task",
      dedupeKey: `market:${taskRun.id}:application-cover-note:${application.id}`,
      context: {
        selectedAction: "apply_to_job",
        applicationId: application.id,
        jobId: job.id,
        match,
      },
    });

    if (job.created_by_user_id !== agent.owner_user_id) {
      await this.producer.enqueueNotification({
        queue: MVP_QUEUES.notifications,
        action: "deliver_market",
        recipientUserId: job.created_by_user_id,
        actorAgentId: agent.id,
        subjectType: "application",
        subjectId: application.id,
        producer: "market-task",
        dedupeKey: `market:application_submitted:${application.id}`,
        payload: {
          eventType: "application_submitted",
          applicationId: application.id,
          jobId: job.id,
          applicantAgentId: agent.id,
          status: "submitted",
        },
      });
    }

    const rationale = `Application submitted from explainable match score ${match.score}/${match.threshold}.`;
    await this.persistDecisionEvent({
      taskRun,
      agentId: agent.id,
      actionFamily: "apply_to_job",
      decisionOutcome: "executed",
      rationale,
      contextDigest: {
        phase: "application_decision",
        result: "application_created",
        applicationId: application.id,
        jobId: job.id,
        match,
        downstream: {
          coverNoteTaskRunId: contentTask.taskRun.id,
        },
        privateState: true,
      },
    });

    return {
      decisionOutcome: "executed",
      action: message.action,
      rationale,
      details: {
        applicationId: application.id,
        jobId: job.id,
        coverNoteTaskRunId: contentTask.taskRun.id,
        match,
      },
    };
  }

  private async processRecruiterScreeningTask(
    message: MarketTaskMessage,
    taskRun: TaskRunRecord,
  ): Promise<ProcessMarketTaskResult> {
    const taskContext = asRecord(message.context);
    const recruiterAgent = await this.loadAgent(message.agentId);
    const job = await this.loadJob(message.jobId);

    const recruiterAllowed = await this.isRecruiterAllowedForJob(recruiterAgent.owner_user_id, job);
    if (!recruiterAllowed) {
      const rationale = "Recruiter agent owner does not have recruiter/admin ownership on this job's org.";
      await this.persistDecisionEvent({
        taskRun,
        agentId: recruiterAgent.id,
        actionFamily: "recruiter_screening",
        decisionOutcome: "skipped",
        rationale,
        contextDigest: {
          phase: "screening",
          reason: "not_authorized",
          jobId: job.id,
          context: taskContext,
        },
      });
      return {
        decisionOutcome: "skipped",
        action: message.action,
        rationale,
        details: {
          recruiterAgentId: recruiterAgent.id,
          jobId: job.id,
        },
      };
    }

    const contextApplicationId = asString(taskContext.applicationId);
    const application = await this.loadUnscreenedApplication(job.id, contextApplicationId);
    if (!application) {
      const rationale = "No unscreened submitted application available for this recruiter-owned job.";
      await this.persistDecisionEvent({
        taskRun,
        agentId: recruiterAgent.id,
        actionFamily: "recruiter_screening",
        decisionOutcome: "no_op",
        rationale,
        contextDigest: {
          phase: "screening",
          reason: "no_unscreened_application",
          jobId: job.id,
        },
      });
      return {
        decisionOutcome: "no_op",
        action: message.action,
        rationale,
        details: { jobId: job.id },
      };
    }

    const screening = await this.evaluateScreening(job, application);
    const transitioned = await this.transitionApplicationStatus({
      applicationId: application.id,
      fromStatus: "submitted",
      toStatus: screening.nextStatus,
      note: `Auto-screened by recruiter agent ${recruiterAgent.handle}. score=${screening.score}/${screening.threshold}`,
    });

    if (!transitioned) {
      const latest = await this.loadApplicationById(application.id);
      const rationale = `Application already transitioned before this run (current status: ${latest?.current_status ?? "unknown"}).`;
      await this.persistDecisionEvent({
        taskRun,
        agentId: recruiterAgent.id,
        actionFamily: "recruiter_screening",
        decisionOutcome: "skipped",
        rationale,
        contextDigest: {
          phase: "screening",
          reason: "already_screened",
          applicationId: application.id,
          currentStatus: latest?.current_status ?? null,
        },
      });
      return {
        decisionOutcome: "skipped",
        action: message.action,
        rationale,
        details: {
          applicationId: application.id,
          currentStatus: latest?.current_status ?? null,
        },
      };
    }

    const rationale = `Screened application using deterministic checks (${screening.score}/${screening.threshold}).`;
    const applicantOwnerUserId = await this.loadAgentOwnerUserId(application.applicant_agent_id);
    if (applicantOwnerUserId !== recruiterAgent.owner_user_id) {
      await this.producer.enqueueNotification({
        queue: MVP_QUEUES.notifications,
        action: "deliver_market",
        recipientUserId: applicantOwnerUserId,
        actorAgentId: recruiterAgent.id,
        subjectType: "application",
        subjectId: application.id,
        producer: "market-task",
        dedupeKey: `market:application_status:${application.id}:${screening.nextStatus}`,
        payload: {
          eventType: "application_status_changed",
          applicationId: application.id,
          jobId: job.id,
          previousStatus: "submitted",
          nextStatus: screening.nextStatus,
          reviewerAgentId: recruiterAgent.id,
        },
      });
    }
    await this.credibility.refreshAgent(application.applicant_agent_id);

    if (screening.nextStatus === "shortlisted") {
      await this.enqueueHiringFollowUpActivity({
        recruiterAgentId: recruiterAgent.id,
        applicantAgentId: application.applicant_agent_id,
        applicationId: application.id,
      });
      await this.ripple.enqueueHiringDiscussionRipple({
        recruiterAgentId: recruiterAgent.id,
        applicantAgentId: application.applicant_agent_id,
        applicationId: application.id,
      });
    }

    await this.persistDecisionEvent({
      taskRun,
      agentId: recruiterAgent.id,
      actionFamily: "recruiter_screening",
      decisionOutcome: "executed",
      rationale,
      contextDigest: {
        phase: "screening",
        result: "screened",
        applicationId: application.id,
        applicantAgentId: application.applicant_agent_id,
        jobId: job.id,
        nextStatus: screening.nextStatus,
        screening,
        privateState: true,
      },
    });

    return {
      decisionOutcome: "executed",
      action: message.action,
      rationale,
      details: {
        applicationId: application.id,
        applicantAgentId: application.applicant_agent_id,
        nextStatus: screening.nextStatus,
        screening,
      },
    };
  }

  private evaluateApplicationMatch(input: {
    agent: AgentRow;
    state: AgentStateRow | null;
    objective: ObjectiveRow | null;
    job: JobRow;
  }): MatchEvaluation {
    const checks: MatchEvaluation["checks"] = [];
    let score = 0;

    const statePayload = asRecord(input.state?.state_payload);
    const openToWork = statePayload.open_to_work === true;
    checks.push({
      key: "open_to_work",
      passed: openToWork,
      weight: 2,
      note: "Agent state is marked open_to_work.",
    });
    if (openToWork) {
      score += 2;
    }

    const objectiveType = input.objective?.objective_type ?? null;
    const objectiveEligible = objectiveType === "open_to_work" || objectiveType === "passive_candidate";
    checks.push({
      key: "objective_alignment",
      passed: objectiveEligible,
      weight: 1,
      note: "Active objective type aligns with candidate job-seeking modes.",
    });
    if (objectiveEligible) {
      score += 1;
    }

    const sameOrg = Boolean(input.agent.primary_org_id && input.agent.primary_org_id === input.job.org_id);
    checks.push({
      key: "not_same_primary_org",
      passed: !sameOrg,
      weight: 1,
      note: "Avoid auto-applying to jobs in the agent's primary org.",
    });
    if (!sameOrg) {
      score += 1;
    }

    const profileText = `${input.agent.display_name} ${input.agent.bio ?? ""} ${input.objective?.summary ?? ""}`;
    const jobText = `${input.job.title} ${input.job.description}`;
    const overlapKeywords = buildOverlap(profileText, jobText);
    const overlapPoints = Math.min(2, overlapKeywords.length);
    checks.push({
      key: "keyword_overlap",
      passed: overlapPoints > 0,
      weight: 2,
      note: `Profile/job keyword overlap count=${overlapKeywords.length}.`,
    });
    score += overlapPoints;

    const threshold = 4;
    const eligible = score >= threshold && openToWork && !sameOrg;
    const rationale = eligible
      ? `Eligible for application (score ${score}/${threshold}) with explainable checks.`
      : `Not eligible for application (score ${score}/${threshold}) under MVP matching gates.`;

    return {
      eligible,
      score,
      threshold,
      checks,
      overlapKeywords,
      rationale,
    };
  }

  private async evaluateScreening(job: JobRow, application: ApplicationRow): Promise<ScreeningEvaluation> {
    const checks: ScreeningEvaluation["checks"] = [];
    let score = 0;

    const applicant = await this.loadAgent(application.applicant_agent_id);
    const applicantState = await this.loadAgentState(applicant.id);
    const applicantObjective = await this.loadPrimaryObjective(applicant.id);
    const endorsementsCount = await this.countEndorsements(applicant.id);

    const coverNoteLength = await this.loadCoverNoteLength(application.id);
    const hasCoverNote = coverNoteLength >= 80;
    checks.push({
      key: "cover_note_quality",
      passed: hasCoverNote,
      weight: 1,
      note: "Cover note has practical minimum length.",
    });
    if (hasCoverNote) {
      score += 1;
    }

    const openToWork = asRecord(applicantState?.state_payload).open_to_work === true;
    checks.push({
      key: "open_to_work",
      passed: openToWork,
      weight: 1,
      note: "Applicant currently signals open-to-work.",
    });
    if (openToWork) {
      score += 1;
    }

    const objectiveAligned =
      applicantObjective?.objective_type === "open_to_work" ||
      applicantObjective?.objective_type === "passive_candidate";
    checks.push({
      key: "objective_alignment",
      passed: objectiveAligned,
      weight: 1,
      note: "Applicant objective mode aligns with job-seeking activity.",
    });
    if (objectiveAligned) {
      score += 1;
    }

    const socialProof = endorsementsCount >= 2;
    checks.push({
      key: "endorsement_signal",
      passed: socialProof,
      weight: 1,
      note: "Applicant has at least two endorsements.",
    });
    if (socialProof) {
      score += 1;
    }

    const overlap = buildOverlap(
      `${applicant.display_name} ${applicant.bio ?? ""} ${applicantObjective?.summary ?? ""}`,
      `${job.title} ${job.description}`,
    );
    const overlapPassed = overlap.length > 0;
    checks.push({
      key: "job_overlap",
      passed: overlapPassed,
      weight: 1,
      note: "Applicant profile overlaps with job title/description keywords.",
    });
    if (overlapPassed) {
      score += 1;
    }

    const threshold = 3;
    const nextStatus: "shortlisted" | "in_review" | "rejected" =
      score >= threshold + 1 ? "shortlisted" : score >= threshold - 1 ? "in_review" : "rejected";
    const rationale =
      nextStatus === "shortlisted"
        ? `Shortlisted with deterministic screening score ${score}/${threshold}.`
        : nextStatus === "in_review"
          ? `Moved to in-review with deterministic screening score ${score}/${threshold}.`
          : `Rejected with deterministic screening score ${score}/${threshold}.`;

    return {
      nextStatus,
      score,
      threshold,
      checks,
      rationale,
    };
  }

  private async loadAgent(agentId: string): Promise<AgentRow> {
    const { data, error } = await this.supabase
      .from("agents")
      .select("id,owner_user_id,handle,display_name,bio,primary_org_id")
      .eq("id", agentId)
      .single();
    if (error) {
      throw new Error(`Failed to load agent ${agentId}: ${error.message}`);
    }
    return data as AgentRow;
  }

  private async loadJob(jobId: string): Promise<JobRow> {
    const { data, error } = await this.supabase
      .from("jobs")
      .select("id,org_id,created_by_user_id,title,description,status,closes_at")
      .eq("id", jobId)
      .single();
    if (error) {
      throw new Error(`Failed to load job ${jobId}: ${error.message}`);
    }
    return data as JobRow;
  }

  private async loadAgentState(agentId: string): Promise<AgentStateRow | null> {
    const { data, error } = await this.supabase
      .from("agent_state")
      .select("agent_id,lifecycle_status,state_payload")
      .eq("agent_id", agentId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load agent_state for ${agentId}: ${error.message}`);
    }
    return (data as AgentStateRow | null) ?? null;
  }

  private async loadPrimaryObjective(agentId: string): Promise<ObjectiveRow | null> {
    const { data, error } = await this.supabase
      .from("agent_objectives")
      .select("id,objective_type,summary,priority,created_at")
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
    return (data as ObjectiveRow | null) ?? null;
  }

  private async loadApplication(jobId: string, applicantAgentId: string): Promise<ApplicationRow | null> {
    const { data, error } = await this.supabase
      .from("applications")
      .select("id,job_id,applicant_agent_id,current_status,created_at")
      .eq("job_id", jobId)
      .eq("applicant_agent_id", applicantAgentId)
      .maybeSingle();
    if (error) {
      throw new Error(
        `Failed to check existing application for job ${jobId} and agent ${applicantAgentId}: ${error.message}`,
      );
    }
    return (data as ApplicationRow | null) ?? null;
  }

  private async loadApplicationById(applicationId: string): Promise<ApplicationRow | null> {
    const { data, error } = await this.supabase
      .from("applications")
      .select("id,job_id,applicant_agent_id,current_status,created_at")
      .eq("id", applicationId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load application ${applicationId}: ${error.message}`);
    }
    return (data as ApplicationRow | null) ?? null;
  }

  private async createApplication(jobId: string, applicantAgentId: string): Promise<ApplicationRow> {
    const { data, error } = await this.supabase
      .from("applications")
      .insert({
        job_id: jobId,
        applicant_agent_id: applicantAgentId,
        submitted_by_user_id: null,
        current_status: "submitted",
      })
      .select("id,job_id,applicant_agent_id,current_status,created_at")
      .single();
    if (error) {
      if (hasDuplicateKeyError(error)) {
        const existing = await this.loadApplication(jobId, applicantAgentId);
        if (existing) {
          return existing;
        }
      }
      throw new Error(`Failed to create application for job ${jobId}: ${error.message}`);
    }
    return data as ApplicationRow;
  }

  private async insertApplicationStatusHistory(input: {
    applicationId: string;
    fromStatus: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    note: string;
  }): Promise<void> {
    const { error } = await this.supabase.from("application_status_history").insert({
      application_id: input.applicationId,
      from_status: input.fromStatus,
      to_status: input.toStatus,
      changed_by_user_id: null,
      changed_by_source: "worker",
      note: input.note.slice(0, 800),
    });
    if (error) {
      throw new Error(`Failed to insert application status history for ${input.applicationId}: ${error.message}`);
    }
  }

  private async transitionApplicationStatus(input: {
    applicationId: string;
    fromStatus: "submitted";
    toStatus: "shortlisted" | "in_review" | "rejected";
    note: string;
  }): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("applications")
      .update({
        current_status: input.toStatus,
      })
      .eq("id", input.applicationId)
      .eq("current_status", input.fromStatus)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to transition application ${input.applicationId}: ${error.message}`);
    }
    if (!data) {
      return false;
    }

    await this.insertApplicationStatusHistory({
      applicationId: input.applicationId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      note: input.note,
    });
    return true;
  }

  private async isRecruiterAllowedForJob(ownerUserId: string, job: JobRow): Promise<boolean> {
    if (job.created_by_user_id === ownerUserId) {
      return true;
    }

    const { data, error } = await this.supabase
      .from("org_memberships")
      .select("id")
      .eq("org_id", job.org_id)
      .eq("user_id", ownerUserId)
      .eq("status", "active")
      .in("role", ["owner", "admin", "recruiter"])
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed recruiter ownership check for org ${job.org_id}: ${error.message}`);
    }
    return Boolean(data);
  }

  private async loadUnscreenedApplication(
    jobId: string,
    preferredApplicationId: string | null,
  ): Promise<ApplicationRow | null> {
    if (preferredApplicationId) {
      const preferred = await this.loadApplicationById(preferredApplicationId);
      if (preferred && preferred.job_id === jobId && preferred.current_status === "submitted") {
        return preferred;
      }
    }

    const { data, error } = await this.supabase
      .from("applications")
      .select("id,job_id,applicant_agent_id,current_status,created_at")
      .eq("job_id", jobId)
      .eq("current_status", "submitted")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load unscreened application for job ${jobId}: ${error.message}`);
    }
    return (data as ApplicationRow | null) ?? null;
  }

  private async countEndorsements(agentId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("endorsements")
      .select("id", { count: "exact", head: true })
      .eq("endorsed_agent_id", agentId);
    if (error) {
      throw new Error(`Failed to count endorsements for ${agentId}: ${error.message}`);
    }
    return count ?? 0;
  }

  private async loadAgentOwnerUserId(agentId: string): Promise<string> {
    const { data, error } = await this.supabase.from("agents").select("owner_user_id").eq("id", agentId).single();
    if (error) {
      throw new Error(`Failed to load owner user for agent ${agentId}: ${error.message}`);
    }
    return data.owner_user_id as string;
  }

  private async loadCoverNoteLength(applicationId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("applications")
      .select("cover_note")
      .eq("id", applicationId)
      .single();
    if (error) {
      throw new Error(`Failed to load cover note for application ${applicationId}: ${error.message}`);
    }
    const text = asString(data.cover_note) ?? "";
    return text.length;
  }

  private async enqueueHiringFollowUpActivity(input: {
    recruiterAgentId: string;
    applicantAgentId: string;
    applicationId: string;
  }): Promise<void> {
    const objectiveId = await this.loadPrimaryObjectiveId(input.recruiterAgentId);
    if (!objectiveId) {
      return;
    }

    const scheduledFor = new Date(Date.now() + 75 * 1000).toISOString();
    await this.producer.enqueueAgentActivity(
      {
        queue: MVP_QUEUES.agentActivity,
        action: "no_op",
        agentId: input.recruiterAgentId,
        objectiveId,
        dedupeKey: `market:hiring-follow-up:${input.applicationId}`,
        producer: "market-task",
        context: {
          trigger: "hiring_follow_up",
          hiringFollowUp: {
            applicantAgentId: input.applicantAgentId,
            applicationId: input.applicationId,
          },
        },
      },
      scheduledFor,
    );
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

  private async persistDecisionEvent(input: {
    taskRun: TaskRunRecord;
    agentId: string;
    actionFamily: "apply_to_job" | "recruiter_screening";
    decisionOutcome: DecisionOutcome;
    rationale: string;
    contextDigest: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.from("decision_events").upsert(
      {
        id: input.taskRun.id,
        agent_id: input.agentId,
        objective_id: input.taskRun.objective_id ?? null,
        task_run_id: input.taskRun.id,
        action_family: input.actionFamily,
        decision_outcome: input.decisionOutcome,
        rationale: input.rationale.slice(0, 1000),
        created_by_source: "worker",
        context_digest: input.contextDigest,
      },
      { onConflict: "id" },
    );
    if (error) {
      throw new Error(`Failed to persist market decision event for task ${input.taskRun.id}: ${error.message}`);
    }
  }
}
