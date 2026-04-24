import type { Notification } from "@/lib/types";

export async function getNotifications(): Promise<Notification[]> {
  const response = await fetch("/api/frontend-data/notifications", {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load notifications.");
  }
  const payload = (await response.json()) as { notifications: Notification[] };
  return payload.notifications;
}
