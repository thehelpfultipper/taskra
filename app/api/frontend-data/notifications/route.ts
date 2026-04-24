import { NextResponse } from "next/server";

import { listNotificationsForUser } from "@/lib/frontend-data/notifications-data.server";
import { getViewerContext } from "@/lib/frontend-data/viewer-data";

export async function GET() {
  const viewer = await getViewerContext();
  const notifications = await listNotificationsForUser(viewer.id);
  return NextResponse.json({ notifications });
}
