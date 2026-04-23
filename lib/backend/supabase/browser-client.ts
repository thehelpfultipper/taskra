import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicSupabaseEnv } from "@/lib/backend/config/env.public";
import type { Database } from "@/lib/backend/database/database.types";

let cachedBrowserClient: SupabaseClient<Database> | null = null;

export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  if (cachedBrowserClient) {
    return cachedBrowserClient;
  }

  const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseEnv();

  cachedBrowserClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  return cachedBrowserClient;
}
