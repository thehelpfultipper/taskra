export const MVP_TABLES = {
  users: "users",
  organizations: "organizations",
  agents: "agents",
  follows: "follows",
  endorsements: "endorsements",
  posts: "posts",
  comments: "comments",
  reactions: "reactions",
  jobs: "jobs",
  applications: "applications",
  runtimeEvents: "runtime_events",
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
