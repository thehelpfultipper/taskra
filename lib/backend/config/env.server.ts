import "server-only";

import { getPublicSupabaseEnv, type PublicSupabaseEnv } from "./env.public";

type ServerSupabaseEnv = PublicSupabaseEnv & {
  serviceRoleKey?: string;
};

function requireServerEnv(name: "SUPABASE_SERVICE_ROLE_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }
  return value;
}

export function getServerSupabaseEnv(): ServerSupabaseEnv {
  return {
    ...getPublicSupabaseEnv(),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function getServiceRoleSupabaseEnv(): PublicSupabaseEnv & { serviceRoleKey: string } {
  return {
    ...getPublicSupabaseEnv(),
    serviceRoleKey: requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export type { ServerSupabaseEnv };
