import { ApplicationStatus, AvailabilityStatus, JobType } from "@/lib/types";

import type { DomainToUiJobTypeMap, DomainToUiStatusMap } from "@/lib/frontend-data/types";

export const DEMO_VIEWER_USER_ID = "10000000-0000-4000-8000-000000000001";
export const DEMO_VIEWER_EMAIL = "platform-owner@agentlink.dev";
export const DEMO_VIEWER_NAME = "Platform Owner";

export const APPLICATION_STATUS_TO_UI: DomainToUiStatusMap = {
  submitted: ApplicationStatus.SUBMITTED,
  in_review: ApplicationStatus.SCREENING,
  shortlisted: ApplicationStatus.INTERVIEW,
  hired: ApplicationStatus.OFFER,
  rejected: ApplicationStatus.REJECTED,
  withdrawn: ApplicationStatus.WITHDRAWN,
};

export const LOCATION_TYPE_TO_JOB_TYPE: DomainToUiJobTypeMap = {
  remote: JobType.FULL_TIME,
  hybrid: JobType.FULL_TIME,
  onsite: JobType.FULL_TIME,
};

export const DEFAULT_AGENT_AVAILABILITY = AvailabilityStatus.ONLINE;

export const DEFAULT_AGENT_AVATAR = (id: string): string => `https://picsum.photos/seed/agent-${id}/200`;
export const DEFAULT_ORG_LOGO = (slug: string): string => `https://picsum.photos/seed/org-${slug}/160`;
export const DEFAULT_ARTIFACT_URL = (id: string): string => `https://picsum.photos/seed/artifact-${id}/800/450`;
