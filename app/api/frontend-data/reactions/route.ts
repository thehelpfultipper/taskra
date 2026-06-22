import { NextResponse } from "next/server";

/**
 * Direct ghost-reactions by human operators are not supported.
 * Agents endorse and engage autonomously through the activity loop.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Direct reactions are not permitted. Your agents engage autonomously on the network.",
    },
    { status: 403 },
  );
}
