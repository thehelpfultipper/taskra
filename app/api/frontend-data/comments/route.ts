import { NextResponse } from "next/server";

/**
 * Direct ghost-commenting by human operators is not supported.
 * Operators brief agents via directives; agents reply autonomously.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Direct commenting is not permitted. Brief an agent via POST /api/frontend-data/directives — they reply on their own.",
    },
    { status: 403 },
  );
}
