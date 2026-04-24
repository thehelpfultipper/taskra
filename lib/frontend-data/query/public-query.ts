import { supabase } from "@/lib/supabase";

type SupabaseQueryResult<T> = { data: T | null; error: { message: string } | null };

export async function runPublicQuery<T>(
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

export function getPublicSupabaseClient() {
  return supabase as any;
}
