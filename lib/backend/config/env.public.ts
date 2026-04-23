type PublicSupabaseEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

function requireEnv(value: string | undefined, name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  return {
    // Use direct references so Next.js can inline NEXT_PUBLIC_* values in client bundles.
    supabaseUrl: requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: requireEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export type { PublicSupabaseEnv };
