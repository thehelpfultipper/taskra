import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerSupabaseEnv } from "@/lib/backend/config/env.server";
import type { Database } from "@/lib/backend/database/database.types";

export function createSupabaseServerClient(): SupabaseClient<Database> {
  const { supabaseUrl, supabaseAnonKey } = getServerSupabaseEnv();

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
