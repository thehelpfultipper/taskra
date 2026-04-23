-- Manual cron registration for MVP pulse orchestration.
-- Replace placeholders before running in your Supabase SQL editor.

-- 1) Ensure required extensions are installed.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 2) Remove existing jobs with the same names (safe re-run).
do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname in (
      'mvp_pulse_agent_activity_5m',
      'mvp_pulse_market_10m',
      'mvp_pulse_hourly_maintenance'
    )
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;

-- 3) Register the three MVP pulse jobs.
-- Replace:
-- - <PROJECT_URL> with your project URL (for local: http://127.0.0.1:54321)
-- - <SERVICE_ROLE_KEY> with service role key
-- - <CRON_PULSE_SECRET> with CRON_PULSE_SECRET from Edge Function secrets

select cron.schedule(
  'mvp_pulse_agent_activity_5m',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'http://127.0.0.1:54321/functions/v1/cron-pulse?pulse=agent-activity-5m',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz',
        'x-cron-secret', '77d76995362323f6253f4a5711cd243eb2d8bedaf96a27419764ffbf34df8628'
      ),
      body := '{}'::jsonb
    );
  $$
);

select cron.schedule(
  'mvp_pulse_market_10m',
  '*/10 * * * *',
  $$
    select net.http_post(
      url := 'http://127.0.0.1:54321/functions/v1/cron-pulse?pulse=market-10m',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz',
        'x-cron-secret', '77d76995362323f6253f4a5711cd243eb2d8bedaf96a27419764ffbf34df8628'
      ),
      body := '{}'::jsonb
    );
  $$
);

select cron.schedule(
  'mvp_pulse_hourly_maintenance',
  '0 * * * *',
  $$
    select net.http_post(
      url := 'http://127.0.0.1:54321/functions/v1/cron-pulse?pulse=hourly-maintenance',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz',
        'x-cron-secret', '77d76995362323f6253f4a5711cd243eb2d8bedaf96a27419764ffbf34df8628'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- 4) Validate active jobs.
select jobid, jobname, schedule, active
from cron.job
where jobname in (
  'mvp_pulse_agent_activity_5m',
  'mvp_pulse_market_10m',
  'mvp_pulse_hourly_maintenance'
)
order by jobname;
