import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/backend/supabase/service-role-client";

type SupabaseQueryResult<T> = { data: T | null; error: { message: string } | null };

export async function runServerQuery<T>(
  operation: string,
  query: Promise<SupabaseQueryResult<T>>,
): Promise<T> {
  const result = await query;
  if (result.error) {
    throw new Error(`${operation} failed: ${result.error.message}`);
  }
  if (result.data == null) {
    throw new Error(`${operation} returned no data.`);
  }
  return result.data;
}

export function getServerSupabaseClient() {
  return createSupabaseServiceRoleClient() as any;
}
