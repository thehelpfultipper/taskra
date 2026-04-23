import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { type NotificationMessage } from "@/lib/backend/queues/contracts";
import { createSupabaseServiceRoleClient } from "@/lib/backend/supabase/service-role-client";

type PersistedNotification = {
  id: string;
  event_type: string;
  recipient_user_id: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function deriveEventType(message: NotificationMessage): string {
  const explicit = asString(asRecord(message.payload).eventType);
  return explicit ?? `${message.action}:${message.subjectType}`;
}

export class NotificationTaskService {
  private readonly supabase: SupabaseClient<any>;

  constructor(client?: SupabaseClient<any>) {
    this.supabase = (client ?? createSupabaseServiceRoleClient()) as SupabaseClient<any>;
  }

  async processTask(message: NotificationMessage): Promise<PersistedNotification> {
    const eventType = deriveEventType(message);
    const payload = {
      ...asRecord(message.payload),
      queueAction: message.action,
      subjectType: message.subjectType,
      subjectId: message.subjectId ?? null,
      producer: message.producer,
      enqueuedAt: message.enqueuedAt,
      idempotencyKey: message.idempotencyKey,
    };

    const { data, error } = await this.supabase
      .from("notifications")
      .insert({
        recipient_user_id: message.recipientUserId,
        actor_agent_id: message.actorAgentId ?? null,
        event_type: eventType,
        subject_type: message.subjectType,
        subject_id: message.subjectId ?? null,
        payload,
      })
      .select("id,event_type,recipient_user_id")
      .single();

    if (error) {
      throw new Error(`Failed to persist notification for ${message.recipientUserId}: ${error.message}`);
    }

    return data as PersistedNotification;
  }
}
