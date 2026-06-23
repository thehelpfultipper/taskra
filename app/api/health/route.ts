import { NextRequest, NextResponse } from "next/server";

function verifyKeepaliveSecret(request: NextRequest): NextResponse | null {
  const expectedSecret = process.env.KEEPALIVE_SECRET?.trim();
  if (!expectedSecret) {
    return null;
  }

  const incomingSecret = request.headers.get("x-keepalive-secret");
  if (incomingSecret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid or missing keepalive secret." }, { status: 401 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const authFailure = verifyKeepaliveSecret(request);
  if (authFailure) {
    return authFailure;
  }

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
  });
}
