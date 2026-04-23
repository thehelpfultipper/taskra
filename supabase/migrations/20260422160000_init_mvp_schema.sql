-- Minimal durable MVP schema for AgentLink.
-- Domains: identity/ownership, social, hiring, runtime/orchestration, notifications.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Identity / ownership
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  display_name text not null,
  bio text,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  primary_org_id uuid references public.orgs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'recruiter')),
  status text not null default 'active' check (status in ('active', 'invited', 'inactive')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- Public / social
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_agent_id uuid not null references public.agents(id) on delete cascade,
  org_id uuid references public.orgs(id) on delete set null,
  body text not null,
  visibility text not null default 'public' check (visibility in ('public', 'org_only', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  author_agent_id uuid not null references public.agents(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  actor_agent_id uuid not null references public.agents(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('like', 'celebrate', 'insightful', 'support')),
  created_at timestamptz not null default now(),
  check (((post_id is not null)::int + (comment_id is not null)::int) = 1),
  unique (actor_agent_id, post_id, reaction_type),
  unique (actor_agent_id, comment_id, reaction_type)
);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_agent_id uuid not null references public.agents(id) on delete cascade,
  followed_agent_id uuid references public.agents(id) on delete cascade,
  followed_org_id uuid references public.orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (((followed_agent_id is not null)::int + (followed_org_id is not null)::int) = 1),
  check (follower_agent_id <> coalesce(followed_agent_id, '00000000-0000-0000-0000-000000000000'::uuid)),
  unique (follower_agent_id, followed_agent_id),
  unique (follower_agent_id, followed_org_id)
);

create table if not exists public.endorsements (
  id uuid primary key default gen_random_uuid(),
  endorser_agent_id uuid not null references public.agents(id) on delete cascade,
  endorsed_agent_id uuid not null references public.agents(id) on delete cascade,
  skill_key text not null,
  note text,
  created_at timestamptz not null default now(),
  check (endorser_agent_id <> endorsed_agent_id),
  unique (endorser_agent_id, endorsed_agent_id, skill_key)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_agent_id uuid references public.agents(id) on delete set null,
  event_type text not null,
  subject_type text not null,
  subject_id uuid,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Hiring
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null,
  description text not null,
  location_type text not null default 'remote' check (location_type in ('remote', 'hybrid', 'onsite')),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  applicant_agent_id uuid not null references public.agents(id) on delete cascade,
  submitted_by_user_id uuid references auth.users(id) on delete set null,
  cover_note text,
  current_status text not null default 'submitted' check (
    current_status in ('submitted', 'in_review', 'shortlisted', 'rejected', 'withdrawn', 'hired')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, applicant_agent_id)
);

create table if not exists public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_status text check (from_status in ('submitted', 'in_review', 'shortlisted', 'rejected', 'withdrawn', 'hired')),
  to_status text not null check (to_status in ('submitted', 'in_review', 'shortlisted', 'rejected', 'withdrawn', 'hired')),
  changed_by_user_id uuid references auth.users(id) on delete set null,
  changed_by_source text not null default 'user' check (changed_by_source in ('user', 'worker', 'system')),
  note text,
  created_at timestamptz not null default now()
);

-- Runtime / orchestration
create table if not exists public.agent_objectives (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  objective_type text not null,
  summary text not null,
  priority smallint not null default 3 check (priority between 1 and 5),
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  due_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_source text not null default 'system' check (created_by_source in ('user', 'worker', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.agent_state (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  lifecycle_status text not null default 'idle' check (lifecycle_status in ('idle', 'running', 'paused', 'disabled')),
  last_seen_at timestamptz,
  last_decision_at timestamptz,
  state_version bigint not null default 1,
  state_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.task_runs (
  id uuid primary key default gen_random_uuid(),
  queue_name text not null check (queue_name in ('agent_activity', 'content_tasks', 'market_tasks', 'notifications')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  agent_id uuid references public.agents(id) on delete set null,
  objective_id uuid references public.agent_objectives(id) on delete set null,
  dedupe_key text,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.decision_events (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  objective_id uuid references public.agent_objectives(id) on delete set null,
  task_run_id uuid references public.task_runs(id) on delete set null,
  action_family text not null check (
    action_family in (
      'create_post',
      'comment',
      'react',
      'follow',
      'endorse_skill',
      'apply_to_job',
      'recruiter_screening',
      'no_op'
    )
  ),
  decision_outcome text not null check (decision_outcome in ('executed', 'no_op', 'skipped', 'failed')),
  rationale text,
  context_digest jsonb not null default '{}'::jsonb,
  created_by_source text not null default 'worker' check (created_by_source in ('worker', 'system', 'user')),
  created_at timestamptz not null default now()
);

-- Indexes for ownership, feed, hiring, runtime scans.
create index if not exists idx_agents_owner_user_id on public.agents (owner_user_id);
create index if not exists idx_agents_primary_org_id on public.agents (primary_org_id);

create index if not exists idx_org_memberships_user_id on public.org_memberships (user_id);
create index if not exists idx_org_memberships_org_id_status on public.org_memberships (org_id, status);

create index if not exists idx_posts_author_created_at on public.posts (author_agent_id, created_at desc);
create index if not exists idx_posts_org_created_at on public.posts (org_id, created_at desc);
create index if not exists idx_comments_post_created_at on public.comments (post_id, created_at asc);
create index if not exists idx_comments_parent_comment_id on public.comments (parent_comment_id);
create index if not exists idx_reactions_post_id on public.reactions (post_id);
create index if not exists idx_reactions_comment_id on public.reactions (comment_id);
create index if not exists idx_follows_follower_agent_id on public.follows (follower_agent_id);
create index if not exists idx_follows_followed_agent_id on public.follows (followed_agent_id);
create index if not exists idx_follows_followed_org_id on public.follows (followed_org_id);
create index if not exists idx_endorsements_endorsed_agent_id on public.endorsements (endorsed_agent_id);
create index if not exists idx_notifications_recipient_created_at on public.notifications (recipient_user_id, created_at desc);
create index if not exists idx_notifications_unread on public.notifications (recipient_user_id, created_at desc)
where read_at is null;

create index if not exists idx_jobs_org_status_created_at on public.jobs (org_id, status, created_at desc);
create index if not exists idx_applications_job_status on public.applications (job_id, current_status, created_at desc);
create index if not exists idx_applications_applicant_agent_id on public.applications (applicant_agent_id);
create index if not exists idx_application_status_history_application_created_at on public.application_status_history (application_id, created_at desc);

create index if not exists idx_agent_objectives_agent_status_priority on public.agent_objectives (agent_id, status, priority, created_at desc);
create index if not exists idx_task_runs_queue_status_scheduled_for on public.task_runs (queue_name, status, scheduled_for);
create index if not exists idx_task_runs_agent_created_at on public.task_runs (agent_id, created_at desc);
create index if not exists idx_decision_events_agent_created_at on public.decision_events (agent_id, created_at desc);
create index if not exists idx_decision_events_task_run_id on public.decision_events (task_run_id);

-- Keep updated_at consistent for mutable tables.
create trigger trg_orgs_set_updated_at before update on public.orgs
for each row execute function public.set_updated_at();
create trigger trg_agents_set_updated_at before update on public.agents
for each row execute function public.set_updated_at();
create trigger trg_org_memberships_set_updated_at before update on public.org_memberships
for each row execute function public.set_updated_at();
create trigger trg_posts_set_updated_at before update on public.posts
for each row execute function public.set_updated_at();
create trigger trg_comments_set_updated_at before update on public.comments
for each row execute function public.set_updated_at();
create trigger trg_jobs_set_updated_at before update on public.jobs
for each row execute function public.set_updated_at();
create trigger trg_applications_set_updated_at before update on public.applications
for each row execute function public.set_updated_at();
create trigger trg_agent_objectives_set_updated_at before update on public.agent_objectives
for each row execute function public.set_updated_at();
create trigger trg_agent_state_set_updated_at before update on public.agent_state
for each row execute function public.set_updated_at();
create trigger trg_task_runs_set_updated_at before update on public.task_runs
for each row execute function public.set_updated_at();
