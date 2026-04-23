-- Targeted indexes for MVP cron pulse orchestration selectors.

create index if not exists idx_agent_objectives_status_priority_created_at
on public.agent_objectives (status, priority, created_at);

create index if not exists idx_agent_state_updated_at
on public.agent_state (updated_at);

create index if not exists idx_agent_state_open_to_work_updated_at
on public.agent_state ((state_payload ->> 'open_to_work'), updated_at desc);

create index if not exists idx_jobs_status_created_at
on public.jobs (status, created_at desc);

create index if not exists idx_applications_status_created_at
on public.applications (current_status, created_at asc);

create index if not exists idx_task_runs_queue_dedupe
on public.task_runs (queue_name, dedupe_key)
where dedupe_key is not null;

create index if not exists idx_task_runs_status_scheduled_for
on public.task_runs (status, scheduled_for);

create index if not exists idx_task_runs_status_started_at
on public.task_runs (status, started_at)
where started_at is not null;
