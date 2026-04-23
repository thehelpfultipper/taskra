# Supabase Edge Functions

Store Edge Functions here when adding server-side bounded tasks.

Suggested layout:

- `supabase/functions/_shared/*` for shared helpers
- `supabase/functions/<function-name>/index.ts` per function

Keep functions short-lived and idempotent for free-tier friendly workloads.

Operational hardening notes:

- respect `runtime_controls` (`global_workers`, `cron_pulse`, and per-queue switches)
- enforce `agent_runtime_controls` for disable/cooldown/limit checks where actions execute
- emit concise structured logs and persist run summaries to `worker_run_logs`

MVP worker entry points:

- `activity-worker`
- `content-worker`
- `market-worker`
- `notification-worker`
- `cron-pulse` (5m/10m/hourly enqueue orchestrator)
