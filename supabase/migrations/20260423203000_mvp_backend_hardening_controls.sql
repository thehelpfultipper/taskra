-- MVP demo hardening controls for safety rails, observability, and bounded cleanup.

create table if not exists public.runtime_controls (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_runtime_controls (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  is_disabled boolean not null default false,
  cooldown_until timestamptz,
  max_posts_per_day smallint check (max_posts_per_day is null or max_posts_per_day > 0),
  max_applies_per_day smallint check (max_applies_per_day is null or max_applies_per_day > 0),
  notes text,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.worker_run_logs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('worker_batch', 'cron_pulse', 'cleanup')),
  queue_name text check (queue_name in ('agent_activity', 'content_tasks', 'market_tasks', 'notifications')),
  pulse_name text check (pulse_name in ('agent-activity-5m', 'market-10m', 'hourly-maintenance')),
  status text not null check (status in ('succeeded', 'failed', 'skipped')),
  requested_batch_size integer check (requested_batch_size is null or requested_batch_size > 0),
  claimed integer not null default 0 check (claimed >= 0),
  succeeded integer not null default 0 check (succeeded >= 0),
  retried integer not null default 0 check (retried >= 0),
  failed integer not null default 0 check (failed >= 0),
  skipped_duplicate integer not null default 0 check (skipped_duplicate >= 0),
  details jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_worker_run_logs_started_at on public.worker_run_logs (started_at desc);
create index if not exists idx_worker_run_logs_run_type_status on public.worker_run_logs (run_type, status, started_at desc);
create index if not exists idx_worker_run_logs_queue on public.worker_run_logs (queue_name, started_at desc);
create index if not exists idx_worker_run_logs_pulse on public.worker_run_logs (pulse_name, started_at desc);

create trigger trg_runtime_controls_set_updated_at before update on public.runtime_controls
for each row execute function public.set_updated_at();

create trigger trg_agent_runtime_controls_set_updated_at before update on public.agent_runtime_controls
for each row execute function public.set_updated_at();

insert into public.runtime_controls (key, value, description)
values
  (
    'global_workers',
    '{"enabled": true}'::jsonb,
    'Master on/off switch for all queue workers.'
  ),
  (
    'cron_pulse',
    '{"enabled": true}'::jsonb,
    'Master on/off switch for cron-pulse orchestration.'
  ),
  (
    'queue:agent_activity',
    '{"enabled": true}'::jsonb,
    'Queue-level switch for agent activity processing and enqueue.'
  ),
  (
    'queue:content_tasks',
    '{"enabled": true}'::jsonb,
    'Queue-level switch for content task processing.'
  ),
  (
    'queue:market_tasks',
    '{"enabled": true}'::jsonb,
    'Queue-level switch for market task processing and enqueue.'
  ),
  (
    'queue:notifications',
    '{"enabled": true}'::jsonb,
    'Queue-level switch for notification processing.'
  ),
  (
    'limits:defaults',
    '{"max_posts_per_day": 6, "max_applies_per_day": 8}'::jsonb,
    'Default daily caps for noisy automation control on free-tier demos.'
  )
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description;

alter table public.runtime_controls enable row level security;
alter table public.runtime_controls force row level security;
alter table public.agent_runtime_controls enable row level security;
alter table public.agent_runtime_controls force row level security;
alter table public.worker_run_logs enable row level security;
alter table public.worker_run_logs force row level security;

drop policy if exists runtime_controls_read_authenticated on public.runtime_controls;
create policy runtime_controls_read_authenticated
on public.runtime_controls
for select
to authenticated
using (true);

drop policy if exists agent_runtime_controls_read_owner_or_org_admin on public.agent_runtime_controls;
create policy agent_runtime_controls_read_owner_or_org_admin
on public.agent_runtime_controls
for select
to authenticated
using (
  public.owns_agent(agent_id)
  or public.is_org_admin_for_agent(agent_id)
);

drop policy if exists worker_run_logs_read_authenticated on public.worker_run_logs;
create policy worker_run_logs_read_authenticated
on public.worker_run_logs
for select
to authenticated
using (true);
