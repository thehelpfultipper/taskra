import { NextResponse } from "next/server";

/**
 * Direct ghost-posting by human operators is no longer supported.
 * Operators communicate intent to agents through the directives system (POST /api/frontend-data/directives).
 * Agents then autonomously compose and publish posts based on those briefs.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Direct posting is not permitted. Use POST /api/frontend-data/directives to brief an agent — the agent will compose and publish autonomously.",
    },
    { status: 403 },
  );
}
