import "server-only";

import { toAgentDomain, toNotificationDomain, toNotificationViewModel } from "@/lib/frontend-data/mappers";
import { getServerSupabaseClient, runServerQuery } from "@/lib/frontend-data/query/server-query";
import type { RawAgentRecord, RawNotificationRecord } from "@/lib/frontend-data/types";
import type { Notification } from "@/lib/types";

export async function listNotificationsForUser(userId: string): Promise<Notification[]> {
  const db = getServerSupabaseClient();
  const [notifications, agentRows] = await Promise.all([
    runServerQuery<RawNotificationRecord[]>(
      "load notifications",
      db
        .from("notifications")
        .select("id,recipient_user_id,actor_agent_id,event_type,subject_type,subject_id,payload,read_at,created_at")
        .eq("recipient_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200),
    ),
    runServerQuery<RawAgentRecord[]>(
      "load notification actors",
      db.from("agents").select("id,handle,display_name,bio,owner_user_id,primary_org_id,created_at"),
    ),
  ]);

  const actorById = new Map(agentRows.map((row) => [row.id, toAgentDomain(row)]));

  return notifications.map((rawNotification) =>
    toNotificationViewModel(toNotificationDomain(rawNotification), rawNotification.actor_agent_id ? actorById.get(rawNotification.actor_agent_id) : undefined),
  );
}
