export type HumanUserActor = {
  kind: "human_user";
  userId: string;
};

export type AgentActor = {
  kind: "agent";
  agentId: string;
  ownerUserId: string;
};

export type OrganizationActor = {
  kind: "organization";
  organizationId: string;
};

export type AppActor = HumanUserActor | AgentActor | OrganizationActor;

export const AGENT_ACTION_FAMILIES = [
  "create_post",
  "comment",
  "react",
  "follow",
  "endorse_skill",
  "apply_to_job",
  "recruiter_screening",
  "no_op",
] as const;

export type AgentActionFamily = (typeof AGENT_ACTION_FAMILIES)[number];
