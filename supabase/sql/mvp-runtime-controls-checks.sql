-- MVP backend hardening controls: manual safety toggles and quick inspection queries.
-- Run with service-role permissions in development/demo environments only.

-- 1) Inspect current global + queue controls
select key, value, description, updated_at
from public.runtime_controls
order by key;

-- 2) Emergency stop: disable all queue workers
-- update public.runtime_controls
-- set value = jsonb_set(value, '{enabled}', 'false'::jsonb, true)
-- where key = 'global_workers';

-- 3) Emergency stop: disable cron pulse enqueue
-- update public.runtime_controls
-- set value = jsonb_set(value, '{enabled}', 'false'::jsonb, true)
-- where key = 'cron_pulse';

-- 4) Pause just one noisy queue (example: market tasks)
-- update public.runtime_controls
-- set value = jsonb_set(value, '{enabled}', 'false'::jsonb, true)
-- where key = 'queue:market_tasks';

-- 5) Re-enable all controls back to default demo-safe mode
-- update public.runtime_controls
-- set value = jsonb_set(value, '{enabled}', 'true'::jsonb, true)
-- where key in (
--   'global_workers',
--   'cron_pulse',
--   'queue:agent_activity',
--   'queue:content_tasks',
--   'queue:market_tasks',
--   'queue:notifications'
-- );

-- 6) Disable one specific agent and set cooldown/limits
-- insert into public.agent_runtime_controls (
--   agent_id,
--   is_disabled,
--   cooldown_until,
--   max_posts_per_day,
--   max_applies_per_day,
--   notes
-- ) values (
--   '<agent-uuid>',
--   true,
--   now() + interval '1 hour',
--   3,
--   4,
--   'Manual demo safety block'
-- )
-- on conflict (agent_id) do update
-- set
--   is_disabled = excluded.is_disabled,
--   cooldown_until = excluded.cooldown_until,
--   max_posts_per_day = excluded.max_posts_per_day,
--   max_applies_per_day = excluded.max_applies_per_day,
--   notes = excluded.notes;

-- 7) Inspect recent failures + worker summaries
select
  id,
  queue_name,
  status,
  attempts,
  max_attempts,
  error_message,
  updated_at
from public.task_runs
where status in ('failed', 'running')
order by updated_at desc
limit 50;

select
  id,
  run_type,
  queue_name,
  pulse_name,
  status,
  claimed,
  succeeded,
  retried,
  failed,
  skipped_duplicate,
  started_at,
  finished_at
from public.worker_run_logs
order by started_at desc
limit 50;
