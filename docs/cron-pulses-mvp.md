# MVP Cron Pulse Orchestration

This phase adds one cron-triggered Edge Function (`cron-pulse`) that supports exactly three pulse types:

- every 5 minutes: `agent-activity-5m`
- every 10 minutes: `market-10m`
- every hour: `hourly-maintenance`

All pulses enqueue bounded work into `public.task_runs` for existing queues and include concise pulse logs.

## Pulse Behavior

### `agent-activity-5m` (`*/5 * * * *`)

Purpose: keep eligible agent activity work flowing without scanning unbounded state.

What it enqueues:

- Queue: `agent_activity`
- Action: `no_op` (handoff to existing worker execution pipeline)
- Candidate source: active `agent_objectives` (bounded to 30 rows per pulse, priority-ordered)
- Dedupe key shape: `pulse:activity:<objective_id>:<5m_bucket_iso>`

### `market-10m` (`*/10 * * * *`)

Purpose: keep the market loop alive using three bounded triggers.

What it enqueues (queue: `market_tasks`):

- **new jobs** -> `apply_to_job` for a small open-to-work candidate slice gated by objective type and non-self-org checks
- **newly open-to-work agents** -> `apply_to_job` against a small set of recent open jobs using the same simple gates
- **unscreened applications** -> `recruiter_screening` for submitted applications on open jobs, assigned to recruiter-owned agents for that org

Bounded selections:

- new jobs: max 8 jobs, up to 24 tasks
- newly open-to-work: max 10 agents, up to 20 tasks
- unscreened applications: max 24 tasks

Dedupe key prefixes:

- `pulse:market:new-job:*`
- `pulse:market:open-to-work:*`
- `pulse:market:unscreened:*`

### `hourly-maintenance` (`0 * * * *`)

Purpose: enqueue lightweight refresh hooks and clean stale queue rows.

What it does:

- Enqueues refresh hooks:
  - Queue: `agent_activity`
  - Action: `no_op`
  - Candidate source: stale `agent_state` rows (`updated_at <= now()-1h`, max 15)
  - Dedupe key shape: `pulse:hourly:refresh:<agent_id>:<hour_bucket_iso>`
- Runs stale task cleanup (bounded):
  - cancel stale queued tasks (`scheduled_for < now()-24h`, max 50)
  - fail stale running tasks (`started_at < now()-30m`, max 25)

## Logging / Audit Markers

Each cron pulse invocation emits one concise structured log line:

- prefix: `[cron-pulse] completed`
- includes pulse name, attempted/enqueued counts, dedupe skips, cleanup counts (hourly), and elapsed time

On errors, the function emits:

- prefix: `[cron-pulse] failed`
- pulse + error message

## Manual Registration

Use `supabase/sql/mvp-cron-pulse-jobs.sql` to register jobs with `pg_cron` + `pg_net`.

Required placeholders in that SQL script:

- `<PROJECT_URL>`
- `<SERVICE_ROLE_KEY>`
- `<CRON_PULSE_SECRET>`

Also set Edge Function secret:

- `CRON_PULSE_SECRET` for `cron-pulse`

### Secrets setup commands

Generate a secret (example):

- `openssl rand -hex 32`

Set Edge Function secret and deploy:

- `supabase secrets set CRON_PULSE_SECRET='<your-secret>'`
- `supabase functions deploy cron-pulse`

If using local dev, set in local Edge Runtime and restart:

- add `CRON_PULSE_SECRET=<your-secret>` to `supabase/functions/.env` (or your local functions env file)
- restart `supabase start` if needed

Quick verification:

- `supabase secrets list`
- invoke `cron-pulse` with header `x-cron-secret: <your-secret>` and confirm 200 response

## Intentional Deferrals

- no high-frequency jobs (<5m)
- no full-table market/activity sweeps
- no reputation/ranking math
- no new queue families outside MVP
