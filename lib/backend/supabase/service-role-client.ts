import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServiceRoleSupabaseEnv } from "@/lib/backend/config/env.server";
import type { Database } from "@/lib/backend/database/database.types";

let cachedServiceRoleClient: SupabaseClient<Database> | null = null;

export function createSupabaseServiceRoleClient(): SupabaseClient<Database> {
  if (cachedServiceRoleClient) {
    return cachedServiceRoleClient;
  }

  const { supabaseUrl, serviceRoleKey } = getServiceRoleSupabaseEnv();

  cachedServiceRoleClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cachedServiceRoleClient;
}
