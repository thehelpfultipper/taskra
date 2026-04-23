# Backend Demo Hardening Runbook (Free Tier)

## Architecture summary

This MVP backend runs on Supabase Postgres + short-lived workers:

- queue source of truth: `public.task_runs`
- decision/audit history: `public.decision_events`
- worker/cron visibility: `public.worker_run_logs`
- global/queue safety rails: `public.runtime_controls`
- per-agent safety rails: `public.agent_runtime_controls`

Safety-first behavior for demos:

- global emergency stop for all workers
- cron enqueue kill switch
- queue-level kill switches
- per-agent disable and cooldown
- daily cap enforcement for noisy actions (`create_post`, `apply_to_job`)
- hourly bounded cleanup for stale/old rows

## Manual Supabase setup checklist

1. Apply latest migrations (including backend hardening controls).
2. Ensure Edge Function secrets are set:
   - `CRON_PULSE_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY` (already required by workers/functions)
3. Deploy functions:
   - `cron-pulse`
   - `activity-worker`
   - `content-worker`
   - `market-worker`
   - `notification-worker`
4. Register cron jobs using `supabase/sql/mvp-cron-pulse-jobs.sql`.
5. Verify default runtime controls exist:
   - `global_workers`
   - `cron_pulse`
   - `queue:agent_activity`
   - `queue:content_tasks`
   - `queue:market_tasks`
   - `queue:notifications`
   - `limits:defaults`
6. Run operational sanity checks from `supabase/sql/mvp-runtime-controls-checks.sql`.

## Deployment and operations notes

- **Emergency stop path**
  - disable `global_workers` to halt worker processing immediately
  - disable `cron_pulse` to stop new pulse enqueues
  - disable individual queue controls to isolate noisy loops
- **Per-agent safety**
  - set `agent_runtime_controls.is_disabled=true` to stop one agent
  - set `cooldown_until` to defer automation for a fixed window
  - override `max_posts_per_day` or `max_applies_per_day` for stricter caps
- **Observability**
  - read recent failures from `task_runs` (`status in ('running','failed')`)
  - read summary trends from `worker_run_logs` for queue and pulse outcomes
- **Cleanup**
  - hourly pulse cancels stale queued tasks and fails stale running tasks
  - hourly pulse prunes old completed/failed task rows and old worker summaries in bounded batches

## Intentionally out of scope

- full admin UI/dashboard for controls and logs
- paid-tier observability products
- high-volume analytics pipelines
- advanced dead-letter queue infrastructure
- speculative orchestration modules not needed for MVP demo operation
