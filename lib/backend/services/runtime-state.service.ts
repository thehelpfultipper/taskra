import "server-only";

import { MVP_QUEUES } from "@/lib/backend/database/schema";
import { MVP_CRON_PULSES } from "@/lib/backend/domain/async-model";
import { createSupabaseServerClient } from "@/lib/backend/supabase/server-client";

export type BackendRuntimeState = {
  hasSupabaseClient: boolean;
  queues: readonly string[];
  cronPulses: typeof MVP_CRON_PULSES;
  checkedAt: string;
};

export function getBackendRuntimeState(): BackendRuntimeState {
  // Instantiate once to confirm env + server client wiring is valid.
  createSupabaseServerClient();
  return {
    hasSupabaseClient: true,
    queues: Object.values(MVP_QUEUES),
    cronPulses: MVP_CRON_PULSES,
    checkedAt: new Date().toISOString(),
  };
}
