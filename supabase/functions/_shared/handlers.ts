import type {
  AgentActivityMessage,
  ContentTaskMessage,
  MarketTaskMessage,
  NotificationMessage,
} from "./queue-contracts.ts";
import { getServiceRoleClient } from "./supabase-client.ts";

export async function handleAgentActivity(
  message: AgentActivityMessage,
): Promise<Record<string, unknown>> {
  return {
    queue: message.queue,
    action: message.action,
    agentId: message.agentId,
    note: "Scaffold handler: plug in decision/action execution.",
  };
}

export async function handleContentTask(
  message: ContentTaskMessage,
): Promise<Record<string, unknown>> {
  return {
    queue: message.queue,
    action: message.action,
    agentId: message.agentId,
    sourceEventId: message.sourceEventId,
    note: "Scaffold handler: plug in content generation.",
  };
}

export async function handleMarketTask(
  message: MarketTaskMessage,
  context: { taskRunId: string },
): Promise<Record<string, unknown>> {
  const supabase = getServiceRoleClient();
  const taskContext = asRecord(message.context);

  if (message.action === "apply_to_job") {
    const [agentResult, jobResult] = await Promise.all([
      supabase.from("agents").select("id,display_name,bio,primary_org_id").eq("id", message.agentId).single(),
      supabase
        .from("jobs")
        .select("id,org_id,title,description,status,closes_at")
        .eq("id", message.jobId)
        .single(),
    ]);
    if (agentResult.error) {
      throw new Error(`Failed to load agent ${message.agentId}: ${agentResult.error.message}`);
    }
    if (jobResult.error) {
      throw new Error(`Failed to load job ${message.jobId}: ${jobResult.error.message}`);
    }

    const agent = agentResult.data as {
      id: string;
      display_name: string;
      bio: string | null;
      primary_org_id: string | null;
    };
    const job = jobResult.data as {
      id: string;
      org_id: string;
      title: string;
      description: string;
      status: "draft" | "open" | "closed";
      closes_at: string | null;
    };

    const [stateResult, objectiveResult, existingApplicationResult] = await Promise.all([
      supabase.from("agent_state").select("state_payload").eq("agent_id", agent.id).maybeSingle(),
      supabase
        .from("agent_objectives")
        .select("objective_type")
        .eq("agent_id", agent.id)
        .eq("status", "active")
        .is("archived_at", null)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("applications")
        .select("id,current_status")
        .eq("job_id", job.id)
        .eq("applicant_agent_id", agent.id)
        .maybeSingle(),
    ]);
    if (stateResult.error) {
      throw new Error(`Failed to load agent_state ${agent.id}: ${stateResult.error.message}`);
    }
    if (objectiveResult.error) {
      throw new Error(`Failed to load objective for ${agent.id}: ${objectiveResult.error.message}`);
    }
    if (existingApplicationResult.error) {
      throw new Error(`Failed to check existing application: ${existingApplicationResult.error.message}`);
    }

    if (existingApplicationResult.data) {
      await upsertDecisionEvent(supabase, {
        id: context.taskRunId,
        agentId: agent.id,
        actionFamily: "apply_to_job",
        decisionOutcome: "skipped",
        rationale: "Application already exists for this agent and job.",
        contextDigest: {
          phase: "application_decision",
          reason: "duplicate_application",
          applicationId: existingApplicationResult.data.id,
          currentStatus: existingApplicationResult.data.current_status,
          privateState: true,
        },
      });
      return {
        queue: message.queue,
        action: message.action,
        decisionOutcome: "skipped",
        applicationId: existingApplicationResult.data.id,
      };
    }

    if (job.status !== "open" || (job.closes_at && Date.parse(job.closes_at) <= Date.now())) {
      await upsertDecisionEvent(supabase, {
        id: context.taskRunId,
        agentId: agent.id,
        actionFamily: "apply_to_job",
        decisionOutcome: "skipped",
        rationale: "Job is not currently open for new applications.",
        contextDigest: {
          phase: "application_decision",
          reason: "job_not_open",
          privateState: true,
        },
      });
      return {
        queue: message.queue,
        action: message.action,
        decisionOutcome: "skipped",
        jobId: job.id,
      };
    }

    const statePayload = asRecord(stateResult.data?.state_payload);
    const openToWork = statePayload.open_to_work === true;
    const objectiveType = objectiveResult.data?.objective_type ?? null;
    const objectiveAligned = objectiveType === "open_to_work" || objectiveType === "passive_candidate";
    const sameOrg = Boolean(agent.primary_org_id && agent.primary_org_id === job.org_id);
    const overlapKeywords = buildOverlap(
      `${agent.display_name} ${agent.bio ?? ""} ${String(objectiveType ?? "")}`,
      `${job.title} ${job.description}`,
    );
    const score =
      (openToWork ? 2 : 0) +
      (objectiveAligned ? 1 : 0) +
      (sameOrg ? 0 : 1) +
      Math.min(2, overlapKeywords.length);
    const threshold = 4;
    const eligible = openToWork && !sameOrg && score >= threshold;

    if (!eligible) {
      await upsertDecisionEvent(supabase, {
        id: context.taskRunId,
        agentId: agent.id,
        actionFamily: "apply_to_job",
        decisionOutcome: "no_op",
        rationale: `Not eligible for application (score ${score}/${threshold}) under MVP matching gates.`,
        contextDigest: {
          phase: "application_decision",
          reason: "not_eligible",
          match: {
            score,
            threshold,
            openToWork,
            objectiveAligned,
            sameOrg,
            overlapKeywords,
          },
          privateState: true,
        },
      });
      return {
        queue: message.queue,
        action: message.action,
        decisionOutcome: "no_op",
        score,
        threshold,
      };
    }

    const insertApplication = await supabase
      .from("applications")
      .insert({
        job_id: job.id,
        applicant_agent_id: agent.id,
        submitted_by_user_id: null,
        current_status: "submitted",
      })
      .select("id")
      .single();
    if (insertApplication.error) {
      throw new Error(`Failed to create application: ${insertApplication.error.message}`);
    }

    const applicationId = insertApplication.data.id as string;
    const historyInsert = await supabase.from("application_status_history").insert({
      application_id: applicationId,
      from_status: null,
      to_status: "submitted",
      changed_by_user_id: null,
      changed_by_source: "worker",
      note: `Auto-submitted by market worker. score=${score}/${threshold}; overlap=${overlapKeywords.join(",") || "none"}`,
    });
    if (historyInsert.error) {
      throw new Error(`Failed to write application history: ${historyInsert.error.message}`);
    }

    const contentDedupeKey = `market:${context.taskRunId}:application-cover-note:${applicationId}`;
    const contentTaskPayload = {
      messageId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      enqueuedAt: new Date().toISOString(),
      producer: "market-task",
      queue: "content_tasks",
      action: "draft_application_cover_note",
      dedupeKey: contentDedupeKey,
      agentId: agent.id,
      sourceEventId: context.taskRunId,
      context: {
        selectedAction: "apply_to_job",
        applicationId,
        jobId: job.id,
        match: {
          score,
          threshold,
          openToWork,
          objectiveAligned,
          sameOrg,
          overlapKeywords,
        },
      },
    };
    const contentTaskInsert = await supabase.from("task_runs").insert({
      queue_name: "content_tasks",
      status: "queued",
      agent_id: agent.id,
      objective_id: null,
      dedupe_key: contentDedupeKey,
      attempts: 0,
      max_attempts: 3,
      scheduled_for: new Date().toISOString(),
      payload: contentTaskPayload,
    });
    if (contentTaskInsert.error) {
      throw new Error(`Failed to enqueue content task for application ${applicationId}: ${contentTaskInsert.error.message}`);
    }

    await upsertDecisionEvent(supabase, {
      id: context.taskRunId,
      agentId: agent.id,
      actionFamily: "apply_to_job",
      decisionOutcome: "executed",
      rationale: `Application submitted from explainable match score ${score}/${threshold}.`,
      contextDigest: {
        phase: "application_decision",
        result: "application_created",
        jobId: job.id,
        applicationId,
        downstream: {
          contentTaskDedupeKey: contentDedupeKey,
        },
        match: {
          score,
          threshold,
          openToWork,
          objectiveAligned,
          sameOrg,
          overlapKeywords,
        },
        privateState: true,
      },
    });

    return {
      queue: message.queue,
      action: message.action,
      decisionOutcome: "executed",
      jobId: job.id,
      applicationId,
      contentTaskDedupeKey: contentDedupeKey,
    };
  }

  if (message.action === "recruiter_screening") {
    const [recruiterAgentResult, jobResult] = await Promise.all([
      supabase.from("agents").select("id,owner_user_id,handle").eq("id", message.agentId).single(),
      supabase
        .from("jobs")
        .select("id,org_id,created_by_user_id,title,description,status")
        .eq("id", message.jobId)
        .single(),
    ]);
    if (recruiterAgentResult.error) {
      throw new Error(`Failed to load recruiter agent ${message.agentId}: ${recruiterAgentResult.error.message}`);
    }
    if (jobResult.error) {
      throw new Error(`Failed to load job ${message.jobId}: ${jobResult.error.message}`);
    }
    const recruiterAgent = recruiterAgentResult.data as { id: string; owner_user_id: string; handle: string };
    const job = jobResult.data as {
      id: string;
      org_id: string;
      created_by_user_id: string;
      title: string;
      description: string;
      status: string;
    };

    const isCreator = job.created_by_user_id === recruiterAgent.owner_user_id;
    let canScreen = isCreator;
    if (!canScreen) {
      const membershipResult = await supabase
        .from("org_memberships")
        .select("id")
        .eq("org_id", job.org_id)
        .eq("user_id", recruiterAgent.owner_user_id)
        .eq("status", "active")
        .in("role", ["owner", "admin", "recruiter"])
        .limit(1)
        .maybeSingle();
      if (membershipResult.error) {
        throw new Error(`Failed recruiter org membership check: ${membershipResult.error.message}`);
      }
      canScreen = Boolean(membershipResult.data);
    }

    if (!canScreen) {
      await upsertDecisionEvent(supabase, {
        id: context.taskRunId,
        agentId: recruiterAgent.id,
        actionFamily: "recruiter_screening",
        decisionOutcome: "skipped",
        rationale: "Recruiter agent owner does not have recruiter/admin ownership on this job's org.",
        contextDigest: {
          phase: "screening",
          reason: "not_authorized",
          privateState: true,
        },
      });
      return {
        queue: message.queue,
        action: message.action,
        decisionOutcome: "skipped",
      };
    }

    const preferredApplicationId = asString(taskContext.applicationId);
    const applicationResult = preferredApplicationId
      ? await supabase
          .from("applications")
          .select("id,job_id,applicant_agent_id,current_status,cover_note,created_at")
          .eq("id", preferredApplicationId)
          .eq("job_id", job.id)
          .eq("current_status", "submitted")
          .maybeSingle()
      : await supabase
          .from("applications")
          .select("id,job_id,applicant_agent_id,current_status,cover_note,created_at")
          .eq("job_id", job.id)
          .eq("current_status", "submitted")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

    if (applicationResult.error) {
      throw new Error(`Failed to load submitted application for screening: ${applicationResult.error.message}`);
    }
    if (!applicationResult.data) {
      await upsertDecisionEvent(supabase, {
        id: context.taskRunId,
        agentId: recruiterAgent.id,
        actionFamily: "recruiter_screening",
        decisionOutcome: "no_op",
        rationale: "No unscreened submitted application available for this recruiter-owned job.",
        contextDigest: {
          phase: "screening",
          reason: "no_unscreened_application",
          privateState: true,
        },
      });
      return {
        queue: message.queue,
        action: message.action,
        decisionOutcome: "no_op",
      };
    }

    const application = applicationResult.data as {
      id: string;
      job_id: string;
      applicant_agent_id: string;
      current_status: string;
      cover_note: string | null;
    };
    const applicantStateResult = await supabase
      .from("agent_state")
      .select("state_payload")
      .eq("agent_id", application.applicant_agent_id)
      .maybeSingle();
    const applicantObjectiveResult = await supabase
      .from("agent_objectives")
      .select("objective_type")
      .eq("agent_id", application.applicant_agent_id)
      .eq("status", "active")
      .is("archived_at", null)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const endorsementsResult = await supabase
      .from("endorsements")
      .select("id", { count: "exact", head: true })
      .eq("endorsed_agent_id", application.applicant_agent_id);
    if (applicantStateResult.error) {
      throw new Error(`Failed to load applicant state: ${applicantStateResult.error.message}`);
    }
    if (applicantObjectiveResult.error) {
      throw new Error(`Failed to load applicant objective: ${applicantObjectiveResult.error.message}`);
    }
    if (endorsementsResult.error) {
      throw new Error(`Failed to load applicant endorsements: ${endorsementsResult.error.message}`);
    }

    const applicantOpenToWork = asRecord(applicantStateResult.data?.state_payload).open_to_work === true;
    const applicantObjectiveType = applicantObjectiveResult.data?.objective_type ?? null;
    const objectiveAligned =
      applicantObjectiveType === "open_to_work" || applicantObjectiveType === "passive_candidate";
    const coverNoteLength = (asString(application.cover_note) ?? "").length;
    const hasCoverNote = coverNoteLength >= 80;
    const endorsementsCount = endorsementsResult.count ?? 0;
    const socialProof = endorsementsCount >= 2;

    const screeningScore =
      (hasCoverNote ? 1 : 0) + (applicantOpenToWork ? 1 : 0) + (objectiveAligned ? 1 : 0) + (socialProof ? 1 : 0);
    const screeningThreshold = 3;
    const nextStatus = screeningScore >= screeningThreshold ? "shortlisted" : "rejected";

    const transitionResult = await supabase
      .from("applications")
      .update({ current_status: nextStatus })
      .eq("id", application.id)
      .eq("current_status", "submitted")
      .select("id")
      .maybeSingle();
    if (transitionResult.error) {
      throw new Error(`Failed to update application status: ${transitionResult.error.message}`);
    }
    if (!transitionResult.data) {
      await upsertDecisionEvent(supabase, {
        id: context.taskRunId,
        agentId: recruiterAgent.id,
        actionFamily: "recruiter_screening",
        decisionOutcome: "skipped",
        rationale: "Application already transitioned before this screening run.",
        contextDigest: {
          phase: "screening",
          reason: "already_screened",
          applicationId: application.id,
          privateState: true,
        },
      });
      return {
        queue: message.queue,
        action: message.action,
        decisionOutcome: "skipped",
        applicationId: application.id,
      };
    }

    const historyInsert = await supabase.from("application_status_history").insert({
      application_id: application.id,
      from_status: "submitted",
      to_status: nextStatus,
      changed_by_user_id: null,
      changed_by_source: "worker",
      note: `Auto-screened by recruiter agent ${recruiterAgent.handle}. score=${screeningScore}/${screeningThreshold}`,
    });
    if (historyInsert.error) {
      throw new Error(`Failed to insert screening status history: ${historyInsert.error.message}`);
    }

    await upsertDecisionEvent(supabase, {
      id: context.taskRunId,
      agentId: recruiterAgent.id,
      actionFamily: "recruiter_screening",
      decisionOutcome: "executed",
      rationale: `Screened application using deterministic checks (${screeningScore}/${screeningThreshold}).`,
      contextDigest: {
        phase: "screening",
        result: "screened",
        applicationId: application.id,
        applicantAgentId: application.applicant_agent_id,
        nextStatus,
        checks: {
          hasCoverNote,
          applicantOpenToWork,
          objectiveAligned,
          endorsementsCount,
        },
        privateState: true,
      },
    });

    return {
      queue: message.queue,
      action: message.action,
      decisionOutcome: "executed",
      applicationId: application.id,
      nextStatus,
    };
  }

  return {
    queue: message.queue,
    action: message.action,
    agentId: message.agentId,
    jobId: message.jobId,
    note: "Unsupported market action.",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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
  const profileTokens = tokenize(profileText);
  const jobTokens = tokenize(jobText);
  const overlap: string[] = [];
  for (const token of profileTokens) {
    if (jobTokens.has(token)) {
      overlap.push(token);
    }
  }
  return overlap.slice(0, 8);
}

async function upsertDecisionEvent(
  supabase: ReturnType<typeof getServiceRoleClient>,
  input: {
    id: string;
    agentId: string;
    actionFamily: "apply_to_job" | "recruiter_screening";
    decisionOutcome: "executed" | "no_op" | "skipped" | "failed";
    rationale: string;
    contextDigest: Record<string, unknown>;
  },
): Promise<void> {
  const result = await supabase.from("decision_events").upsert(
    {
      id: input.id,
      agent_id: input.agentId,
      objective_id: null,
      task_run_id: input.id,
      action_family: input.actionFamily,
      decision_outcome: input.decisionOutcome,
      rationale: input.rationale.slice(0, 1000),
      created_by_source: "worker",
      context_digest: input.contextDigest,
    },
    { onConflict: "id" },
  );
  if (result.error) {
    throw new Error(`Failed to upsert decision event ${input.id}: ${result.error.message}`);
  }
}

export async function handleNotification(
  message: NotificationMessage,
): Promise<Record<string, unknown>> {
  const supabase = getServiceRoleClient();
  const rawMessage = message as unknown as Record<string, unknown>;
  const baseContext =
    message.context && typeof message.context === "object"
      ? { ...(message.context as Record<string, unknown>) }
      : {};
  const payloadContext =
    rawMessage.payload && typeof rawMessage.payload === "object"
      ? { ...(rawMessage.payload as Record<string, unknown>) }
      : {};
  const context = {
    ...baseContext,
    ...payloadContext,
  };
  const actorAgentId =
    typeof rawMessage.actorAgentId === "string"
      ? rawMessage.actorAgentId
      : typeof context.actorAgentId === "string"
        ? context.actorAgentId
        : null;
  const eventType =
    typeof context.eventType === "string" && context.eventType.length > 0
      ? context.eventType
      : `${message.action}:${message.subjectType}`;

  const insertResult = await supabase
    .from("notifications")
    .insert({
      recipient_user_id: message.recipientUserId,
      actor_agent_id: actorAgentId,
      event_type: eventType,
      subject_type: message.subjectType,
      subject_id: message.subjectId ?? null,
      payload: {
        ...context,
        queueAction: message.action,
        idempotencyKey: message.idempotencyKey,
        enqueuedAt: message.enqueuedAt,
      },
    })
    .select("id,event_type,recipient_user_id")
    .single();
  if (insertResult.error) {
    throw new Error(`Failed to persist notification: ${insertResult.error.message}`);
  }

  return {
    queue: message.queue,
    action: message.action,
    notificationId: insertResult.data.id,
    eventType: insertResult.data.event_type,
    recipientUserId: insertResult.data.recipient_user_id,
    subjectType: message.subjectType,
    subjectId: message.subjectId ?? null,
  };
}
