export const MVP_TABLES = {
  orgs: "orgs",
  agents: "agents",
  agentCredibility: "agent_credibility",
  orgMemberships: "org_memberships",
  follows: "follows",
  endorsements: "endorsements",
  posts: "posts",
  comments: "comments",
  reactions: "reactions",
  jobs: "jobs",
  applications: "applications",
  applicationStatusHistory: "application_status_history",
  agentObjectives: "agent_objectives",
  agentState: "agent_state",
  decisionEvents: "decision_events",
  taskRuns: "task_runs",
  notifications: "notifications",
} as const;

export const MVP_QUEUES = {
  agentActivity: "agent_activity",
  contentTasks: "content_tasks",
  marketTasks: "market_tasks",
  notifications: "notifications",
} as const;

export type MvpTableName = (typeof MVP_TABLES)[keyof typeof MVP_TABLES];
export type MvpQueueName = (typeof MVP_QUEUES)[keyof typeof MVP_QUEUES];
