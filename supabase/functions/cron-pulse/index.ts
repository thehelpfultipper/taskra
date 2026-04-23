import { runPulseOrchestration, isPulseKind } from "../_shared/pulse-orchestrator.ts";
import { recordWorkerRunLog } from "../_shared/safety-rails.ts";
import { getServiceRoleClient } from "../_shared/supabase-client.ts";

function unauthorizedResponse(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function badRequestResponse(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function resolvePulse(request: Request): Promise<string | null> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("pulse");
  if (fromQuery) {
    return fromQuery;
  }

  if (request.method !== "POST") {
    return null;
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    const payload = (await request.json()) as { pulse?: string };
    return payload.pulse ?? null;
  } catch {
    return null;
  }
}

function verifyCronSecret(request: Request): Response | null {
  const expectedSecret = Deno.env.get("CRON_PULSE_SECRET");
  if (!expectedSecret) {
    return null;
  }

  const incomingSecret = request.headers.get("x-cron-secret");
  if (incomingSecret !== expectedSecret) {
    return unauthorizedResponse("Invalid or missing cron secret.");
  }

  return null;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "GET" && request.method !== "POST") {
    return badRequestResponse("Use GET or POST.");
  }

  const authFailure = verifyCronSecret(request);
  if (authFailure) {
    return authFailure;
  }

  const pulse = await resolvePulse(request);
  if (!isPulseKind(pulse)) {
    return badRequestResponse(
      "Missing or invalid pulse. Allowed values: agent-activity-5m, market-10m, hourly-maintenance.",
    );
  }

  const startedAt = Date.now();
  const startedAtIso = new Date().toISOString();
  try {
    const client = getServiceRoleClient();
    const summary = await runPulseOrchestration({ pulse, client });
    const elapsedMs = Date.now() - startedAt;

    const response = {
      ...summary,
      elapsedMs,
      checkedAt: new Date().toISOString(),
    };

    const status = summary.skippedReason ? "skipped" : "succeeded";
    await recordWorkerRunLog(client, {
      runType: "cron_pulse",
      pulseName: pulse,
      status,
      details: response,
      startedAtIso,
      finishedAtIso: new Date().toISOString(),
    });
    console.info("[cron-pulse] completed", JSON.stringify({ ...response, status }));
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error ?? {});
    const client = getServiceRoleClient();
    await recordWorkerRunLog(client, {
      runType: "cron_pulse",
      pulseName: pulse,
      status: "failed",
      errorMessage: message,
      details: {
        pulse,
      },
      startedAtIso,
      finishedAtIso: new Date().toISOString(),
    });
    console.error("[cron-pulse] failed", JSON.stringify({ pulse, message }));
    return new Response(JSON.stringify({ error: "Pulse orchestration failed.", details: message }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
});
