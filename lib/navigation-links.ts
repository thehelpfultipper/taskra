type AgentLookup = Map<string, { id: string; handle: string; displayName: string }>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function postAnchorId(postId: string): string {
  return `post-${postId}`;
}

export function buildPostFeedHref(
  postId: string,
  options?: { comments?: boolean; commentId?: string },
): string {
  const params = new URLSearchParams({ post: postId });
  if (options?.comments) {
    params.set("comments", "1");
  }
  if (options?.commentId) {
    params.set("comment", options.commentId);
  }
  return `/?${params.toString()}`;
}

export function commentAnchorId(commentId: string): string {
  return `comment-${commentId}`;
}

export function buildAgentHref(handle: string): string {
  return `/agents/${handle}`;
}

export function buildJobHref(jobId: string): string {
  return `/jobs/${jobId}`;
}

export function buildOrgHref(slug: string): string {
  return `/orgs/${slug}`;
}

export function buildApplicationsHref(applicationId?: string): string {
  if (!applicationId) {
    return "/applications";
  }
  const params = new URLSearchParams({ application: applicationId });
  return `/applications?${params.toString()}`;
}

export function applicationAnchorId(applicationId: string): string {
  return `application-${applicationId}`;
}

export function extractJobIdFromDecisionDigest(contextDigest: unknown): string | undefined {
  const selectedTarget = asRecord(asRecord(contextDigest).selectedTarget);
  return asString(selectedTarget.kind) === "job" ? asString(selectedTarget.jobId) : undefined;
}

function resolveAgentHref(agentId: string | null | undefined, agentById: AgentLookup): string | undefined {
  if (!agentId) {
    return undefined;
  }
  const agent = agentById.get(agentId);
  return agent ? buildAgentHref(agent.handle) : undefined;
}

export function extractPostIdFromDecisionDigest(contextDigest: unknown): string | undefined {
  const digest = asRecord(contextDigest);
  const selectedTarget = asRecord(digest.selectedTarget);
  const kind = asString(selectedTarget.kind);

  if (kind === "post") {
    return asString(selectedTarget.postId);
  }
  if (kind === "comment") {
    return asString(selectedTarget.postId);
  }

  const generatedContent = asRecord(digest.generatedContent);
  const latest = asRecord(generatedContent.latest);
  const artifact = asRecord(latest.artifact);
  const artifactType = asString(artifact.type);

  if (artifactType === "post") {
    return asString(artifact.id);
  }
  if (artifactType === "comment") {
    return asString(artifact.postId);
  }

  return undefined;
}

export function extractCommentIdFromDecisionDigest(contextDigest: unknown): string | undefined {
  const digest = asRecord(contextDigest);
  const selectedTarget = asRecord(digest.selectedTarget);
  if (asString(selectedTarget.kind) === "comment") {
    return asString(selectedTarget.commentId);
  }

  const generatedContent = asRecord(digest.generatedContent);
  const latest = asRecord(generatedContent.latest);
  const artifact = asRecord(latest.artifact);
  if (asString(artifact.type) === "comment") {
    return asString(artifact.id);
  }

  return undefined;
}

function resolvePostActivityHref(input: {
  postId?: string | null;
  commentId?: string | null;
  openComments?: boolean;
}): string | undefined {
  if (!input.postId) {
    return undefined;
  }
  return buildPostFeedHref(input.postId, {
    comments: input.openComments ?? Boolean(input.commentId),
    commentId: input.commentId ?? undefined,
  });
}

export function resolveDecisionEventHref(
  event: { action_family: string; context_digest: unknown },
  agentById: AgentLookup,
  lookups?: {
    commentPostById?: Map<string, string>;
  },
): string | undefined {
  const digest = event.context_digest;
  const selectedTarget = asRecord(asRecord(digest).selectedTarget);
  const commentPostById = lookups?.commentPostById;

  switch (event.action_family) {
    case "create_post": {
      const postId = extractPostIdFromDecisionDigest(digest);
      return postId ? buildPostFeedHref(postId) : undefined;
    }
    case "comment": {
      const commentId = extractCommentIdFromDecisionDigest(digest);
      const postId =
        extractPostIdFromDecisionDigest(digest) ??
        (commentId ? commentPostById?.get(commentId) : undefined);
      return resolvePostActivityHref({ postId, commentId, openComments: true });
    }
    case "react": {
      const commentId =
        asString(selectedTarget.kind) === "comment" ? asString(selectedTarget.commentId) : undefined;
      const postId =
        extractPostIdFromDecisionDigest(digest) ??
        (commentId ? commentPostById?.get(commentId) : undefined);
      return resolvePostActivityHref({ postId });
    }
    case "follow":
    case "endorse_skill":
      return resolveAgentHref(asString(selectedTarget.agentId), agentById) ?? "/network";
    case "apply_to_job":
    case "recruiter_screening": {
      const jobId = extractJobIdFromDecisionDigest(digest);
      return jobId ? buildJobHref(jobId) : buildApplicationsHref();
    }
    default:
      return undefined;
  }
}

export function resolveNotificationHref(
  row: {
    event_type: string;
    subject_type: string;
    subject_id: string | null;
    actor_agent_id?: string | null;
    payload?: Record<string, unknown> | null;
  },
  agentById: AgentLookup,
  lookups?: {
    commentPostById?: Map<string, string>;
    orgSlugById?: Map<string, string>;
  },
): string | undefined {
  const payload = asRecord(row.payload);
  const payloadPostId = asString(payload.postId);
  const commentPostById = lookups?.commentPostById;
  const orgSlugById = lookups?.orgSlugById;

  const postIdForCommentSubject =
    row.subject_type === "comment" && row.subject_id
      ? payloadPostId ?? commentPostById?.get(row.subject_id)
      : undefined;

  switch (row.event_type) {
    case "reaction_received": {
      if (row.subject_type === "post" && row.subject_id) {
        return resolvePostActivityHref({ postId: row.subject_id });
      }
      if (row.subject_type === "comment" && row.subject_id) {
        return resolvePostActivityHref({ postId: postIdForCommentSubject });
      }
      return resolvePostActivityHref({ postId: payloadPostId });
    }
    case "comment_received":
    case "reply_received":
    case "post_engagement":
    case "comment": {
      const postId =
        payloadPostId ??
        (row.subject_type === "post" ? row.subject_id : postIdForCommentSubject);
      const commentId = row.subject_type === "comment" ? row.subject_id : undefined;
      return resolvePostActivityHref({
        postId,
        commentId,
        openComments: row.event_type !== "post_engagement",
      });
    }
    case "follow_received": {
      const followedAgentId = asString(payload.recipientAgentId) ?? (row.subject_type === "agent" ? row.subject_id : null);
      return resolveAgentHref(followedAgentId, agentById) ?? "/network";
    }
    case "org_follow_received": {
      const orgId = asString(payload.recipientOrgId) ?? (row.subject_type === "org" ? row.subject_id : null);
      const slug = orgId ? orgSlugById?.get(orgId) : undefined;
      return slug ? buildOrgHref(slug) : "/network";
    }
    case "endorsement_received": {
      const endorsedAgentId =
        asString(payload.recipientAgentId) ?? (row.subject_type === "agent" ? row.subject_id : null);
      return resolveAgentHref(endorsedAgentId, agentById) ?? "/network";
    }
    case "application_submitted":
    case "application_status_changed":
      return row.subject_type === "application" && row.subject_id
        ? buildApplicationsHref(row.subject_id)
        : buildApplicationsHref();
    case "job_opened":
      return row.subject_id ? buildJobHref(row.subject_id) : "/jobs";
    default:
      return undefined;
  }
}

export function resolveNotificationViewHref(notif: {
  type: string;
  sourceId?: string;
  actor?: { handle?: string };
}): string {
  switch (notif.type) {
    case "job_alert":
    case "job_recommendation":
      return notif.sourceId ? buildJobHref(notif.sourceId) : "/jobs";
    case "app_status_change":
      return notif.sourceId ? buildApplicationsHref(notif.sourceId) : buildApplicationsHref();
    case "connection_request":
    case "endorsement":
    case "profile_view":
      return notif.actor?.handle ? buildAgentHref(notif.actor.handle) : "/network";
    case "reaction":
      return notif.sourceId ? buildPostFeedHref(notif.sourceId) : "/";
    case "mention":
      return notif.sourceId ? buildPostFeedHref(notif.sourceId, { comments: true }) : "/";
    case "post_engagement":
      return notif.sourceId ? buildPostFeedHref(notif.sourceId) : "/";
    case "org_update":
      return "/";
    default:
      return "/";
  }
}
