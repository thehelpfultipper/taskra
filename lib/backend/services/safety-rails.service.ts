import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServiceRoleClient } from "@/lib/backend/supabase/service-role-client";

type RuntimeControlRow = {
  key: string;
  value: unknown;
};

type AgentRuntimeControlRow = {
  agent_id: string;
  is_disabled: boolean;
  cooldown_until: string | null;
  max_posts_per_day: number | null;
  max_applies_per_day: number | null;
};

type ActionFamily =
  | "create_post"
  | "comment"
  | "react"
  | "follow"
  | "endorse_skill"
  | "apply_to_job"
  | "recruiter_screening"
  | "no_op";

export type SafetyRailEvaluation = {
  allowed: boolean;
  reason: string | null;
  details: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }
  return null;
}

function getWindowStartIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

const LIMIT_ACTIONS = new Set<ActionFamily>(["create_post", "apply_to_job"]);

export class SafetyRailsService {
  constructor(private readonly supabase = createSupabaseServiceRoleClient() as SupabaseClient<any>) {}

  async evaluateAgentAction(agentId: string, actionFamily: ActionFamily): Promise<SafetyRailEvaluation> {
    const [globalWorkersEnabled, agentControl, defaultLimits] = await Promise.all([
      this.isGlobalWorkersEnabled(),
      this.loadAgentControl(agentId),
      this.loadDefaultLimits(),
    ]);

    if (!globalWorkersEnabled) {
      return {
        allowed: false,
        reason: "global_workers_disabled",
        details: { actionFamily },
      };
    }

    if (agentControl?.is_disabled) {
      return {
        allowed: false,
        reason: "agent_disabled",
        details: { actionFamily },
      };
    }

    if (agentControl?.cooldown_until && Date.parse(agentControl.cooldown_until) > Date.now()) {
      return {
        allowed: false,
        reason: "agent_cooldown_active",
        details: {
          actionFamily,
          cooldownUntil: agentControl.cooldown_until,
        },
      };
    }

    if (!LIMIT_ACTIONS.has(actionFamily)) {
      return {
        allowed: true,
        reason: null,
        details: { actionFamily, limitChecked: false },
      };
    }

    if (actionFamily === "create_post") {
      const maxPosts = agentControl?.max_posts_per_day ?? defaultLimits.maxPostsPerDay;
      const postsCount = await this.countPostsLastDay(agentId);
      if (postsCount >= maxPosts) {
        return {
          allowed: false,
          reason: "post_daily_limit_reached",
          details: {
            actionFamily,
            count: postsCount,
            max: maxPosts,
            windowHours: 24,
          },
        };
      }
      return {
        allowed: true,
        reason: null,
        details: {
          actionFamily,
          limitChecked: true,
          count: postsCount,
          max: maxPosts,
        },
      };
    }

    const maxApplies = agentControl?.max_applies_per_day ?? defaultLimits.maxAppliesPerDay;
    const applyCount = await this.countApplicationsLastDay(agentId);
    if (applyCount >= maxApplies) {
      return {
        allowed: false,
        reason: "apply_daily_limit_reached",
        details: {
          actionFamily,
          count: applyCount,
          max: maxApplies,
          windowHours: 24,
        },
      };
    }
    return {
      allowed: true,
      reason: null,
      details: {
        actionFamily,
        limitChecked: true,
        count: applyCount,
        max: maxApplies,
      },
    };
  }

  private async loadAgentControl(agentId: string): Promise<AgentRuntimeControlRow | null> {
    const { data, error } = await this.supabase
      .from("agent_runtime_controls")
      .select("agent_id,is_disabled,cooldown_until,max_posts_per_day,max_applies_per_day")
      .eq("agent_id", agentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load runtime controls for agent ${agentId}: ${error.message}`);
    }
    return (data as AgentRuntimeControlRow | null) ?? null;
  }

  private async loadRuntimeControl(key: string): Promise<RuntimeControlRow | null> {
    const { data, error } = await this.supabase
      .from("runtime_controls")
      .select("key,value")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load runtime control ${key}: ${error.message}`);
    }
    return (data as RuntimeControlRow | null) ?? null;
  }

  private async isGlobalWorkersEnabled(): Promise<boolean> {
    const control = await this.loadRuntimeControl("global_workers");
    const enabled = asBoolean(asRecord(control?.value).enabled);
    return enabled ?? true;
  }

  private async loadDefaultLimits(): Promise<{ maxPostsPerDay: number; maxAppliesPerDay: number }> {
    const control = await this.loadRuntimeControl("limits:defaults");
    const value = asRecord(control?.value);

    const maxPostsPerDay = asNumber(value.max_posts_per_day) ?? 6;
    const maxAppliesPerDay = asNumber(value.max_applies_per_day) ?? 8;

    return {
      maxPostsPerDay: Math.max(1, maxPostsPerDay),
      maxAppliesPerDay: Math.max(1, maxAppliesPerDay),
    };
  }

  private async countPostsLastDay(agentId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_agent_id", agentId)
      .is("deleted_at", null)
      .gte("created_at", getWindowStartIso());

    if (error) {
      throw new Error(`Failed to count recent posts for ${agentId}: ${error.message}`);
    }
    return count ?? 0;
  }

  private async countApplicationsLastDay(agentId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("applicant_agent_id", agentId)
      .gte("created_at", getWindowStartIso());

    if (error) {
      throw new Error(`Failed to count recent applications for ${agentId}: ${error.message}`);
    }
    return count ?? 0;
  }
}
