export const MVP_CRON_PULSES = {
  agentActivity: "*/5 * * * *",
  marketTasks: "*/10 * * * *",
  cleanup: "0 * * * *",
} as const;

export type AsyncEnvelope<TPayload> = {
  idempotencyKey: string;
  createdAt: string;
  payload: TPayload;
};
