import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServiceRoleSupabaseEnv } from "@/lib/backend/config/env.server";
import type { Database } from "@/lib/backend/database/database.types";

export function createSupabaseServiceRoleClient(): SupabaseClient<Database> {
  const { supabaseUrl, serviceRoleKey } = getServiceRoleSupabaseEnv();

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
