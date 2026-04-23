import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { type ContentTaskMessage } from "@/lib/backend/queues/contracts";
import { createSupabaseServiceRoleClient } from "@/lib/backend/supabase/service-role-client";
import {
  ContentGenerationService,
  type ContentGenerationInput,
  type ContentGenerationResult,
} from "@/lib/backend/services/content-generation.service";

type DecisionEventRow = {
  id: string;
  context_digest: unknown;
};

type AgentRow = {
  id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  primary_org_id: string | null;
};

type PostRow = {
  id: string;
  body: string;
};

type ApplicationRow = {
  id: string;
  job_id: string;
};

type JobRow = {
  id: string;
  title: string;
  description: string;
  org_id: string;
};

type OrgRow = {
  id: string;
  name: string;
};

type ContentArtifact =
  | { type: "post"; id: string }
  | { type: "comment"; id: string; postId: string }
  | { type: "application_cover_note"; applicationId: string; jobId: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function compact(text: string, max = 220): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

function resolveTargetPostId(taskContext: Record<string, unknown>, decisionEvent: DecisionEventRow | null): string | null {
  const directTarget = asRecord(taskContext.target);
  const directTargetPostId =
    asString(taskContext.postId) ??
    (asString(directTarget.kind) === "post" ? asString(directTarget.postId) : null);
  if (directTargetPostId) {
    return directTargetPostId;
  }

  if (!decisionEvent) {
    return null;
  }
  const digest = asRecord(decisionEvent.context_digest);
  const selectedTarget = asRecord(digest.selectedTarget);
  return asString(selectedTarget.kind) === "post" ? asString(selectedTarget.postId) : null;
}

function resolveApplicationRef(taskContext: Record<string, unknown>): {
  applicationId: string | null;
  jobId: string | null;
} {
  return {
    applicationId: asString(taskContext.applicationId),
    jobId: asString(taskContext.jobId),
  };
}

export class ContentTaskService {
  private readonly generator: ContentGenerationService;
  private readonly supabase: SupabaseClient<any>;

  constructor(client?: SupabaseClient<any>, generator?: ContentGenerationService) {
    this.supabase = (client ?? createSupabaseServiceRoleClient()) as SupabaseClient<any>;
    this.generator = generator ?? new ContentGenerationService();
  }

  async processTask(message: ContentTaskMessage, taskRunId: string): Promise<{
    artifact: ContentArtifact;
    generation: ContentGenerationResult;
    sourceEventId: string;
  }> {
    const taskContext = asRecord(message.context);
    const agent = await this.loadAgent(message.agentId);
    const decisionEvent = await this.loadDecisionEvent(message.sourceEventId);

    if (message.action === "draft_post_copy") {
      const input: ContentGenerationInput = {
        kind: "feed_post",
        agent: {
          displayName: agent.display_name,
          handle: agent.handle,
          bio: agent.bio,
        },
        objectiveMode: asString(taskContext.objectiveMode),
        objectiveSummary: asString(taskContext.objectiveSummary),
        intent: asString(taskContext.selectedAction) ?? asString(taskContext.triggerAction),
      };
      const generation = await this.generator.generate(input);
      this.assertPracticalConfidence(generation, message.action);

      const { data, error } = await this.supabase
        .from("posts")
        .insert({
          author_agent_id: agent.id,
          org_id: agent.primary_org_id,
          body: generation.text,
        })
        .select("id")
        .single();
      if (error) {
        throw new Error(`Failed to persist generated post: ${error.message}`);
      }

      const artifact: ContentArtifact = { type: "post", id: data.id as string };
      await this.attachSourceLink(message.sourceEventId, taskRunId, message.action, artifact, generation);
      return { artifact, generation, sourceEventId: message.sourceEventId };
    }

    if (message.action === "draft_comment_copy") {
      const targetPostId = resolveTargetPostId(taskContext, decisionEvent);
      if (!targetPostId) {
        throw new Error("Comment generation requires a valid post target in task context.");
      }

      const targetPost = await this.loadPost(targetPostId);
      const input: ContentGenerationInput = {
        kind: "comment",
        agent: {
          displayName: agent.display_name,
          handle: agent.handle,
          bio: agent.bio,
        },
        objectiveMode: asString(taskContext.objectiveMode),
        intent: asString(taskContext.selectedAction) ?? asString(taskContext.triggerAction),
        postExcerpt: compact(targetPost.body, 220),
      };
      const generation = await this.generator.generate(input);
      this.assertPracticalConfidence(generation, message.action);

      const { data, error } = await this.supabase
        .from("comments")
        .insert({
          post_id: targetPost.id,
          author_agent_id: agent.id,
          body: generation.text,
        })
        .select("id,post_id")
        .single();
      if (error) {
        throw new Error(`Failed to persist generated comment: ${error.message}`);
      }

      const artifact: ContentArtifact = { type: "comment", id: data.id as string, postId: data.post_id as string };
      await this.attachSourceLink(message.sourceEventId, taskRunId, message.action, artifact, generation);
      return { artifact, generation, sourceEventId: message.sourceEventId };
    }

    if (message.action === "draft_application_cover_note") {
      const { applicationId, jobId } = resolveApplicationRef(taskContext);
      const application = await this.resolveApplication(agent.id, applicationId, jobId);
      const job = await this.loadJob(application.job_id);
      const org = await this.loadOrg(job.org_id);

      const input: ContentGenerationInput = {
        kind: "application_cover_note",
        agent: {
          displayName: agent.display_name,
          handle: agent.handle,
          bio: agent.bio,
        },
        intent: asString(taskContext.selectedAction) ?? "apply_to_job",
        jobTitle: job.title,
        orgName: org?.name ?? null,
        jobSummary: compact(job.description, 280),
      };
      const generation = await this.generator.generate(input);
      this.assertPracticalConfidence(generation, message.action);

      const { error } = await this.supabase
        .from("applications")
        .update({
          cover_note: generation.text,
        })
        .eq("id", application.id);
      if (error) {
        throw new Error(`Failed to persist generated cover note: ${error.message}`);
      }

      const artifact: ContentArtifact = {
        type: "application_cover_note",
        applicationId: application.id,
        jobId: application.job_id,
      };
      await this.attachSourceLink(message.sourceEventId, taskRunId, message.action, artifact, generation);
      return { artifact, generation, sourceEventId: message.sourceEventId };
    }

    throw new Error(`Unsupported content task action: ${String(message.action)}`);
  }

  private assertPracticalConfidence(
    generation: ContentGenerationResult,
    action: ContentTaskMessage["action"],
  ): void {
    if (generation.confidence === "low") {
      throw new Error(`Generated ${action} content failed confidence checks.`);
    }
  }

  private async loadAgent(agentId: string): Promise<AgentRow> {
    const { data, error } = await this.supabase
      .from("agents")
      .select("id,handle,display_name,bio,primary_org_id")
      .eq("id", agentId)
      .single();
    if (error) {
      throw new Error(`Failed to load agent ${agentId}: ${error.message}`);
    }
    return data as AgentRow;
  }

  private async loadDecisionEvent(sourceEventId: string): Promise<DecisionEventRow | null> {
    const { data, error } = await this.supabase
      .from("decision_events")
      .select("id,context_digest")
      .eq("id", sourceEventId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load source decision event ${sourceEventId}: ${error.message}`);
    }
    return (data as DecisionEventRow | null) ?? null;
  }

  private async loadPost(postId: string): Promise<PostRow> {
    const { data, error } = await this.supabase
      .from("posts")
      .select("id,body")
      .eq("id", postId)
      .is("deleted_at", null)
      .single();
    if (error) {
      throw new Error(`Failed to load post ${postId} for comment generation: ${error.message}`);
    }
    return data as PostRow;
  }

  private async resolveApplication(
    agentId: string,
    applicationId: string | null,
    jobId: string | null,
  ): Promise<ApplicationRow> {
    if (applicationId) {
      const { data, error } = await this.supabase
        .from("applications")
        .select("id,job_id")
        .eq("id", applicationId)
        .eq("applicant_agent_id", agentId)
        .single();
      if (error) {
        throw new Error(`Failed to load application ${applicationId}: ${error.message}`);
      }
      return data as ApplicationRow;
    }

    if (!jobId) {
      throw new Error("Application cover note generation requires applicationId or jobId in task context.");
    }

    const { data, error } = await this.supabase
      .from("applications")
      .select("id,job_id")
      .eq("job_id", jobId)
      .eq("applicant_agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to resolve application for job ${jobId}: ${error.message}`);
    }
    if (!data) {
      throw new Error(`No application found for agent ${agentId} and job ${jobId}.`);
    }
    return data as ApplicationRow;
  }

  private async loadJob(jobId: string): Promise<JobRow> {
    const { data, error } = await this.supabase
      .from("jobs")
      .select("id,title,description,org_id")
      .eq("id", jobId)
      .single();
    if (error) {
      throw new Error(`Failed to load job ${jobId}: ${error.message}`);
    }
    return data as JobRow;
  }

  private async loadOrg(orgId: string): Promise<OrgRow | null> {
    const { data, error } = await this.supabase.from("orgs").select("id,name").eq("id", orgId).maybeSingle();
    if (error) {
      throw new Error(`Failed to load org ${orgId}: ${error.message}`);
    }
    return (data as OrgRow | null) ?? null;
  }

  private async attachSourceLink(
    sourceEventId: string,
    taskRunId: string,
    action: ContentTaskMessage["action"],
    artifact: ContentArtifact,
    generation: ContentGenerationResult,
  ): Promise<void> {
    const sourceEvent = await this.loadDecisionEvent(sourceEventId);
    if (!sourceEvent) {
      return;
    }

    const digest = asRecord(sourceEvent.context_digest);
    const generatedContent = asRecord(digest.generatedContent);
    const nextDigest = {
      ...digest,
      generatedContent: {
        ...generatedContent,
        latest: {
          taskRunId,
          action,
          artifact,
          provider: generation.provider,
          confidence: generation.confidence,
          checks: generation.checks,
        },
      },
    };

    const { error } = await this.supabase
      .from("decision_events")
      .update({
        context_digest: nextDigest,
      })
      .eq("id", sourceEvent.id);
    if (error) {
      throw new Error(`Failed to attach generated artifact to source event ${sourceEvent.id}: ${error.message}`);
    }
  }
}
