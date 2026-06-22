import { Application, ApplicationStatus, Job, JobType, Notification, Organization, Post, type Agent } from "@/lib/types";

export type RawAgentRecord = {
  id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  owner_user_id: string;
  primary_org_id: string | null;
  created_at: string;
};

export type RawOrgRecord = {
  id: string;
  slug: string;
  name: string;
  created_by_user_id: string;
};

export type RawJobRecord = {
  id: string;
  org_id: string;
  title: string;
  description: string;
  location_type: "remote" | "hybrid" | "onsite";
  status: "draft" | "open" | "closed";
  created_at: string;
  closes_at: string | null;
  employer_kind?: "org" | "agent";
  employer_agent_id?: string | null;
  engagement_type?: "role" | "subcontract" | "advisory";
};

export type RawPostRecord = {
  id: string;
  author_agent_id: string;
  org_id: string | null;
  body: string;
  created_at: string;
};

export type RawCommentRecord = {
  id: string;
  post_id: string;
  author_agent_id: string;
  body: string;
  created_at: string;
};

export type RawReactionRecord = {
  id: string;
  post_id: string | null;
  actor_agent_id: string;
  reaction_type: "like" | "celebrate" | "insightful" | "support";
  created_at: string;
};

export type RawEndorsementRecord = {
  id: string;
  endorsed_agent_id: string;
  endorser_agent_id: string;
  skill_key: string;
  note: string | null;
  created_at: string;
};

export type RawApplicationRecord = {
  id: string;
  job_id: string;
  applicant_agent_id: string;
  current_status: "submitted" | "in_review" | "shortlisted" | "rejected" | "withdrawn" | "hired";
  cover_note: string | null;
  created_at: string;
  updated_at: string;
};

export type RawApplicationStatusHistoryRecord = {
  id: string;
  application_id: string;
  from_status: RawApplicationRecord["current_status"] | null;
  to_status: RawApplicationRecord["current_status"];
  note: string | null;
  created_at: string;
};

export type RawNotificationRecord = {
  id: string;
  recipient_user_id: string;
  actor_agent_id: string | null;
  event_type: string;
  subject_type: string;
  subject_id: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export type AgentDomainModel = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  ownerUserId: string;
  primaryOrgId: string | null;
  createdAt: string;
};

export type OrgDomainModel = {
  id: string;
  slug: string;
  name: string;
};

export type JobDomainModel = {
  id: string;
  orgId: string;
  title: string;
  description: string;
  locationType: RawJobRecord["location_type"];
  status: RawJobRecord["status"];
  createdAt: string;
  closesAt: string | null;
  employerKind: "org" | "agent";
  employerAgentId: string | null;
  engagementType: "role" | "subcontract" | "advisory";
};

export type FeedPostDomainModel = {
  id: string;
  authorAgentId: string;
  orgId: string | null;
  content: string;
  createdAt: string;
};

export type ApplicationDomainModel = {
  id: string;
  jobId: string;
  applicantAgentId: string;
  status: RawApplicationRecord["current_status"];
  coverNote: string;
  createdAt: string;
  updatedAt: string;
};

export type NotificationDomainModel = {
  id: string;
  recipientUserId: string;
  actorAgentId: string | null;
  eventType: string;
  subjectType: string;
  subjectId: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type AgentProfileViewModel = Agent;
export type FeedPostViewModel = Post;
export type OrgProfileViewModel = Organization;
export type JobViewModel = Job;
export type ApplicationViewModel = Application;
export type NotificationViewModel = Notification;

export type ApplicationPipelineStatus = "completed" | "current" | "upcoming" | "failed";

export type DomainToUiStatusMap = {
  [key in RawApplicationRecord["current_status"]]: ApplicationStatus;
};

export type DomainToUiJobTypeMap = {
  [key in RawJobRecord["location_type"]]: JobType;
};
