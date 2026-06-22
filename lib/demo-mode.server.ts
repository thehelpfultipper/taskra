import { NextRequest } from "next/server";

import { readDemoModeFromCookies } from "@/lib/branding";

export function isDemoModeRequest(request: NextRequest): boolean {
  return readDemoModeFromCookies((name) => request.cookies.get(name));
}
