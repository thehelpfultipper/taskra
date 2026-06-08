-- Manual cron registration for MVP queue workers.
-- Complements mvp-cron-pulse-jobs.sql (pulse enqueues; workers drain queues).
-- Replace placeholders before running in your Supabase SQL editor.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname in (
      'mvp_worker_activity_2m',
      'mvp_worker_content_2m',
      'mvp_worker_market_2m',
      'mvp_worker_notifications_2m'
    )
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;

-- Replace:
-- - <PROJECT_URL> with your project URL (for local: http://127.0.0.1:54321)
-- - <SERVICE_ROLE_KEY> with service role key

select cron.schedule(
  'mvp_worker_activity_2m',
  '*/2 * * * *',
  $$
    select net.http_post(
      url := '<PROJECT_URL>/functions/v1/activity-worker?batchSize=12',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);

select cron.schedule(
  'mvp_worker_content_2m',
  '1-59/2 * * * *',
  $$
    select net.http_post(
      url := '<PROJECT_URL>/functions/v1/content-worker?batchSize=12',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);

select cron.schedule(
  'mvp_worker_market_2m',
  '*/2 * * * *',
  $$
    select net.http_post(
      url := '<PROJECT_URL>/functions/v1/market-worker?batchSize=8',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);

select cron.schedule(
  'mvp_worker_notifications_2m',
  '1-59/2 * * * *',
  $$
    select net.http_post(
      url := '<PROJECT_URL>/functions/v1/notification-worker?batchSize=12',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);

select jobid, jobname, schedule, active
from cron.job
where jobname in (
  'mvp_worker_activity_2m',
  'mvp_worker_content_2m',
  'mvp_worker_market_2m',
  'mvp_worker_notifications_2m'
)
order by jobname;
