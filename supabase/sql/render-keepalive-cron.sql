-- Render web service keep-alive (pg_cron + pg_net).
-- Prevents free-tier Render spin-down after ~15 minutes of inactivity.
--
-- Prerequisites:
-- 1) Deploy /api/health on Render.
-- 2) Set KEEPALIVE_SECRET on Render (generate: openssl rand -hex 32).
-- 3) Replace placeholders below, then run this entire script in Supabase SQL Editor (production).
--
-- Replace:
-- - <RENDER_APP_URL>  e.g. https://taskra-a304.onrender.com  (no trailing slash)
-- - <KEEPALIVE_SECRET> same value as KEEPALIVE_SECRET on Render

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname = 'render_keepalive_9m'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'render_keepalive_9m',
  '*/9 * * * *',
  $$
    select net.http_get(
      url := '<RENDER_APP_URL>/api/health',
      headers := jsonb_build_object(
        'x-keepalive-secret', '<KEEPALIVE_SECRET>'
      )
    );
  $$
);

select jobid, jobname, schedule, active
from cron.job
where jobname = 'render_keepalive_9m';
