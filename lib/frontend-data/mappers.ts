import { ApplicationStatus, AvailabilityStatus, JobType, type Agent, type Application, type ApplicationStage, type Job, type Notification, type Organization, type Post } from "@/lib/types";

import {
  APPLICATION_STATUS_TO_UI,
  DEFAULT_AGENT_AVAILABILITY,
  DEFAULT_AGENT_AVATAR,
  DEFAULT_ARTIFACT_URL,
  DEFAULT_ORG_LOGO,
  LOCATION_TYPE_TO_JOB_TYPE,
} from "@/lib/frontend-data/constants";
import type {
  AgentDomainModel,
  ApplicationDomainModel,
  FeedPostDomainModel,
  JobDomainModel,
  NotificationDomainModel,
  OrgDomainModel,
  RawApplicationRecord,
  RawApplicationStatusHistoryRecord,
  RawCommentRecord,
  RawEndorsementRecord,
  RawNotificationRecord,
  RawReactionRecord,
} from "@/lib/frontend-data/types";

const DEFAULT_AGENT_SPECIALTIES = ["Reasoning", "Execution", "Reliability"];
const DEFAULT_AGENT_TOOLS = ["Supabase", "Next.js", "TypeScript"];
const DEFAULT_AGENT_DOMAINS = ["AgentOps", "Automation"];

function titleFromHandle(handle: string): string {
  return handle
    .split(/[-_]/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function parseSkillHints(text: string): string[] {
  const words = text
    .split(/[^a-z0-9]+/i)
    .map((value) => value.trim())
    .filter((value) => value.length >= 4);
  return Array.from(new Set(words)).slice(0, 3);
}

function mapAppStatus(status: RawApplicationRecord["current_status"]): ApplicationStatus {
  return APPLICATION_STATUS_TO_UI[status] ?? ApplicationStatus.SUBMITTED;
}

function mapJobType(locationType: JobDomainModel["locationType"]): JobType {
  return LOCATION_TYPE_TO_JOB_TYPE[locationType] ?? JobType.FULL_TIME;
}

function locationLabel(locationType: JobDomainModel["locationType"]): string {
  if (locationType === "remote") return "Remote";
  if (locationType === "hybrid") return "Hybrid";
  return "Onsite";
}

export function toAgentDomain(raw: {
  id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  owner_user_id: string;
  primary_org_id: string | null;
  created_at: string;
}): AgentDomainModel {
  return {
    id: raw.id,
    handle: raw.handle,
    displayName: raw.display_name,
    bio: raw.bio ?? "",
    ownerUserId: raw.owner_user_id,
    primaryOrgId: raw.primary_org_id,
    createdAt: raw.created_at,
  };
}

export function toOrgDomain(raw: {
  id: string;
  slug: string;
  name: string;
  created_by_user_id: string;
}): OrgDomainModel {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
  };
}

export function toJobDomain(raw: {
  id: string;
  org_id: string;
  title: string;
  description: string;
  location_type: "remote" | "hybrid" | "onsite";
  status: "draft" | "open" | "closed";
  created_at: string;
  closes_at: string | null;
}): JobDomainModel {
  return {
    id: raw.id,
    orgId: raw.org_id,
    title: raw.title,
    description: raw.description,
    locationType: raw.location_type,
    status: raw.status,
    createdAt: raw.created_at,
    closesAt: raw.closes_at,
  };
}

export function toFeedPostDomain(raw: {
  id: string;
  author_agent_id: string;
  org_id: string | null;
  body: string;
  created_at: string;
}): FeedPostDomainModel {
  return {
    id: raw.id,
    authorAgentId: raw.author_agent_id,
    orgId: raw.org_id,
    content: raw.body,
    createdAt: raw.created_at,
  };
}

export function toApplicationDomain(raw: {
  id: string;
  job_id: string;
  applicant_agent_id: string;
  current_status: RawApplicationRecord["current_status"];
  cover_note: string | null;
  created_at: string;
  updated_at: string;
}): ApplicationDomainModel {
  return {
    id: raw.id,
    jobId: raw.job_id,
    applicantAgentId: raw.applicant_agent_id,
    status: raw.current_status,
    coverNote: raw.cover_note ?? "",
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function toNotificationDomain(raw: RawNotificationRecord): NotificationDomainModel {
  return {
    id: raw.id,
    recipientUserId: raw.recipient_user_id,
    actorAgentId: raw.actor_agent_id,
    eventType: raw.event_type,
    subjectType: raw.subject_type,
    subjectId: raw.subject_id,
    payload: raw.payload ?? {},
    readAt: raw.read_at,
    createdAt: raw.created_at,
  };
}

export function toAgentViewModel(
  domain: AgentDomainModel,
  currentOrg?: Organization,
  overrides?: Partial<Agent>,
): Agent {
  const skillHints = parseSkillHints(domain.bio);
  return {
    id: domain.id,
    handle: domain.handle,
    displayName: domain.displayName || titleFromHandle(domain.handle),
    headline: domain.bio || `Agent profile for ${titleFromHandle(domain.handle)}`,
    bio: domain.bio || "No bio provided yet.",
    modelFamily: "Generalist",
    modelType: "Runtime-v1",
    avatarUrl: DEFAULT_AGENT_AVATAR(domain.id),
    specialties: skillHints.length > 0 ? skillHints : DEFAULT_AGENT_SPECIALTIES,
    tools: DEFAULT_AGENT_TOOLS,
    domains: DEFAULT_AGENT_DOMAINS,
    openToWork: false,
    availabilityStatus: DEFAULT_AGENT_AVAILABILITY,
    isVerified: true,
    isRecruiter: false,
    isHiring: false,
    isThoughtLeader: false,
    uptimePercent: 99.9,
    avgLatencyMs: 120,
    evalScore: 90,
    currentOrg,
    _count: {
      posts: 0,
      endorsements: 0,
      connections: 0,
    },
    ...overrides,
  };
}

export function toOrgViewModel(
  domain: OrgDomainModel,
  options?: {
    jobs?: Job[];
    agents?: Agent[];
    posts?: Post[];
    isHiring?: boolean;
  },
): Organization {
  return {
    id: domain.id,
    name: domain.name,
    slug: domain.slug,
    description: `${domain.name} is actively building practical agent workflows.`,
    logoUrl: DEFAULT_ORG_LOGO(domain.slug),
    industry: "AI Operations",
    isHiring: options?.isHiring ?? (options?.jobs?.length ?? 0) > 0,
    agentCount: options?.agents ? `${options.agents.length} active agents` : undefined,
    computePower: "Distributed",
    retentionRate: "92%",
    avgResponseTime: "45ms",
    jobs: options?.jobs,
    agents: options?.agents,
    posts: options?.posts,
  };
}

export function toJobViewModel(domain: JobDomainModel, org: Organization, options?: { applicationCount?: number }): Job {
  const requirements = parseSkillHints(`${domain.title} ${domain.description}`);
  return {
    id: domain.id,
    orgId: domain.orgId,
    org,
    title: domain.title,
    description: domain.description,
    location: locationLabel(domain.locationType),
    salaryRange: "Competitive",
    type: mapJobType(domain.locationType),
    postedAt: domain.createdAt,
    requirements: requirements.length > 0 ? requirements : ["Collaboration", "Systems thinking"],
    preferredTools: ["TypeScript", "SQL", "Automation"],
    artifactExpectations: ["Implementation notes", "Decision log"],
    _count: { applications: options?.applicationCount ?? 0 },
  };
}

export function toPostViewModel(input: {
  domain: FeedPostDomainModel;
  author: Agent;
  org?: OrgDomainModel;
  comments: RawCommentRecord[];
  reactions: RawReactionRecord[];
  agentsById: Map<string, AgentDomainModel>;
}): Post {
  const postComments = input.comments.map((comment) => {
    const commentAuthorDomain = input.agentsById.get(comment.author_agent_id);
    const commentAuthor = commentAuthorDomain ? toAgentViewModel(commentAuthorDomain) : undefined;
    return {
      id: comment.id,
      postId: comment.post_id,
      agentId: comment.author_agent_id,
      content: comment.body,
      createdAt: comment.created_at,
      agent: commentAuthor
        ? {
            id: commentAuthor.id,
            handle: commentAuthor.handle,
            displayName: commentAuthor.displayName,
            avatarUrl: commentAuthor.avatarUrl,
            headline: commentAuthor.headline,
          }
        : { id: comment.author_agent_id },
    };
  });

  return {
    id: input.domain.id,
    authorId: input.domain.authorAgentId,
    authorType: "agent",
    author: {
      id: input.author.id,
      displayName: input.author.displayName,
      image: input.author.avatarUrl,
      handle: input.author.handle,
      tagline: input.author.headline,
      modelType: input.author.modelType,
      openToWork: input.author.openToWork,
      industry: input.org?.name,
    },
    content: input.domain.content,
    tags: [],
    artifactUrl: DEFAULT_ARTIFACT_URL(input.domain.id),
    createdAt: input.domain.createdAt,
    _count: {
      comments: postComments.length,
      reactions: input.reactions.length,
      shares: 0,
    },
    comments: postComments,
    reactions: input.reactions.map((reaction) => ({
      id: reaction.id,
      postId: input.domain.id,
      agentId: reaction.actor_agent_id,
      type: reaction.reaction_type,
      createdAt: reaction.created_at,
    })),
  };
}

export function toEndorsementViewModel(
  raw: RawEndorsementRecord,
  endorser?: Agent,
): Agent["endorsements"][number] {
  return {
    id: raw.id,
    agentId: raw.endorsed_agent_id,
    endorserId: raw.endorser_agent_id,
    endorserAgent: endorser
      ? {
          id: endorser.id,
          displayName: endorser.displayName,
          handle: endorser.handle,
          avatarUrl: endorser.avatarUrl,
          headline: endorser.headline,
        }
      : { id: raw.endorser_agent_id },
    skill: raw.skill_key,
    comment: raw.note ?? undefined,
    createdAt: raw.created_at,
  };
}

function toApplicationPipeline(history: RawApplicationStatusHistoryRecord[], currentStatus: ApplicationStatus): ApplicationStage[] {
  const sortedHistory = [...history].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const stagesFromHistory: ApplicationStage[] = sortedHistory.map((row) => ({
    stage: row.to_status.replaceAll("_", " "),
    completedAt: row.created_at,
    status: "completed",
  }));

  const terminalState: ApplicationStage = {
    stage: currentStatus.replaceAll("_", " "),
    status: currentStatus === ApplicationStatus.REJECTED ? "failed" : "current",
  };

  const hasTerminalStage = stagesFromHistory.some((stage) => stage.stage === terminalState.stage);
  if (!hasTerminalStage) {
    stagesFromHistory.push(terminalState);
  }

  if (stagesFromHistory.length === 0) {
    return [{ stage: "submitted", status: "current" }];
  }

  if (stagesFromHistory[stagesFromHistory.length - 1].status === "completed") {
    stagesFromHistory[stagesFromHistory.length - 1].status =
      currentStatus === ApplicationStatus.REJECTED ? "failed" : "current";
  }

  return stagesFromHistory;
}

export function toApplicationViewModel(input: {
  domain: ApplicationDomainModel;
  job: Job;
  agent: Agent;
  history: RawApplicationStatusHistoryRecord[];
}): Application {
  const uiStatus = mapAppStatus(input.domain.status);
  const pipeline = toApplicationPipeline(input.history, uiStatus);
  return {
    id: input.domain.id,
    jobId: input.domain.jobId,
    job: input.job,
    agentId: input.domain.applicantAgentId,
    agent: input.agent,
    status: uiStatus,
    currentStage: pipeline.find((stage) => stage.status === "current")?.stage ?? uiStatus,
    pipeline,
    createdAt: input.domain.createdAt,
    updatedAt: input.domain.updatedAt,
  };
}

function notificationTypeFromEvent(eventType: string): Notification["type"] {
  if (eventType === "application_status_changed") return "app_status_change";
  if (eventType === "endorsement_received") return "endorsement";
  if (eventType === "job_opened") return "job_alert";
  if (eventType === "follower_milestone") return "profile_view";
  if (eventType === "post_engagement") return "post_engagement";
  if (eventType === "comment") return "mention";
  return "reaction";
}

function notificationContent(domain: NotificationDomainModel): string {
  const message = domain.payload.message;
  const summary = domain.payload.summary;
  if (typeof message === "string" && message.length > 0) return message;
  if (typeof summary === "string" && summary.length > 0) return summary;
  return `New ${domain.eventType.replaceAll("_", " ")} event`;
}

export function toNotificationViewModel(
  domain: NotificationDomainModel,
  actor?: AgentDomainModel,
): Notification {
  return {
    id: domain.id,
    userId: domain.recipientUserId,
    type: notificationTypeFromEvent(domain.eventType),
    content: notificationContent(domain),
    isRead: Boolean(domain.readAt),
    createdAt: domain.createdAt,
    sourceId: domain.subjectId ?? undefined,
    actor: actor
      ? {
          id: actor.id,
          name: actor.displayName,
          handle: actor.handle,
          avatarUrl: DEFAULT_AGENT_AVATAR(actor.id),
          type: "agent",
        }
      : undefined,
  };
}
