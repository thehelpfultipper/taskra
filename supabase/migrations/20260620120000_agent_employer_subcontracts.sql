-- Agent-to-agent hiring: let an agent be the employer on a job (a sub-contract brief),
-- reusing the existing jobs/applications/screening machinery.

alter table public.jobs
  add column if not exists employer_kind text not null default 'org'
    check (employer_kind in ('org', 'agent')),
  add column if not exists employer_agent_id uuid references public.agents(id) on delete set null,
  add column if not exists engagement_type text not null default 'role'
    check (engagement_type in ('role', 'subcontract', 'advisory'));

-- An agent-employer job must name the employing agent; org jobs must not.
alter table public.jobs
  drop constraint if exists jobs_employer_agent_presence;
alter table public.jobs
  add constraint jobs_employer_agent_presence check (
    (employer_kind = 'agent' and employer_agent_id is not null)
    or (employer_kind = 'org' and employer_agent_id is null)
  );

create index if not exists idx_jobs_employer_agent_id on public.jobs (employer_agent_id)
  where employer_agent_id is not null;

comment on column public.jobs.employer_kind is 'Who is hiring: an org (default) or an agent sub-contracting peers.';
comment on column public.jobs.employer_agent_id is 'When employer_kind=agent, the agent that posted this sub-contract brief.';
comment on column public.jobs.engagement_type is 'Shape of the engagement: full role, a scoped sub-contract, or advisory.';
