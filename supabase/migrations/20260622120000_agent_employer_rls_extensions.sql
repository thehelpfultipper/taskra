-- Extend hiring RLS for agent-to-agent sub-contract jobs (employer_kind = 'agent').
-- Anon browser reads stay limited to open jobs; authenticated agent owners can manage their gigs.

drop policy if exists jobs_read_public_open_or_org_manager on public.jobs;
create policy jobs_read_public_open_or_org_manager
on public.jobs
for select
to anon, authenticated
using (
  status = 'open'
  or public.is_org_manager(org_id)
  or (
    employer_kind = 'agent'
    and employer_agent_id is not null
    and public.owns_agent(employer_agent_id)
  )
);

drop policy if exists jobs_insert_by_org_manager on public.jobs;
create policy jobs_insert_by_org_manager
on public.jobs
for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and (
    public.is_org_manager(org_id)
    or (
      employer_kind = 'agent'
      and employer_agent_id is not null
      and public.owns_agent(employer_agent_id)
    )
  )
);

drop policy if exists jobs_update_by_org_manager on public.jobs;
create policy jobs_update_by_org_manager
on public.jobs
for update
to authenticated
using (
  public.is_org_manager(org_id)
  or (
    employer_kind = 'agent'
    and employer_agent_id is not null
    and public.owns_agent(employer_agent_id)
  )
)
with check (
  public.is_org_manager(org_id)
  or (
    employer_kind = 'agent'
    and employer_agent_id is not null
    and public.owns_agent(employer_agent_id)
  )
);

drop policy if exists jobs_delete_by_org_manager on public.jobs;
create policy jobs_delete_by_org_manager
on public.jobs
for delete
to authenticated
using (
  public.is_org_manager(org_id)
  or (
    employer_kind = 'agent'
    and employer_agent_id is not null
    and public.owns_agent(employer_agent_id)
  )
);

drop policy if exists applications_read_participants on public.applications;
create policy applications_read_participants
on public.applications
for select
to authenticated
using (
  public.owns_agent(applicant_agent_id)
  or exists (
    select 1
    from public.jobs j
    where j.id = applications.job_id
      and public.is_org_manager(j.org_id)
  )
  or exists (
    select 1
    from public.jobs j
    where j.id = applications.job_id
      and j.employer_kind = 'agent'
      and j.employer_agent_id is not null
      and public.owns_agent(j.employer_agent_id)
  )
);

drop policy if exists applications_update_by_participants on public.applications;
create policy applications_update_by_participants
on public.applications
for update
to authenticated
using (
  public.owns_agent(applicant_agent_id)
  or exists (
    select 1
    from public.jobs j
    where j.id = applications.job_id
      and public.is_org_manager(j.org_id)
  )
  or exists (
    select 1
    from public.jobs j
    where j.id = applications.job_id
      and j.employer_kind = 'agent'
      and j.employer_agent_id is not null
      and public.owns_agent(j.employer_agent_id)
  )
)
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = applications.job_id
      and public.is_org_manager(j.org_id)
  )
  or exists (
    select 1
    from public.jobs j
    where j.id = applications.job_id
      and j.employer_kind = 'agent'
      and j.employer_agent_id is not null
      and public.owns_agent(j.employer_agent_id)
  )
  or (
    public.owns_agent(applicant_agent_id)
    and current_status = 'withdrawn'
  )
);

drop policy if exists application_status_history_read_participants on public.application_status_history;
create policy application_status_history_read_participants
on public.application_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = application_status_history.application_id
      and (
        public.owns_agent(a.applicant_agent_id)
        or public.is_org_manager(j.org_id)
        or (
          j.employer_kind = 'agent'
          and j.employer_agent_id is not null
          and public.owns_agent(j.employer_agent_id)
        )
      )
  )
);

drop policy if exists application_status_history_insert_by_participants on public.application_status_history;
create policy application_status_history_insert_by_participants
on public.application_status_history
for insert
to authenticated
with check (
  exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = application_status_history.application_id
      and public.is_org_manager(j.org_id)
  )
  or exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = application_status_history.application_id
      and j.employer_kind = 'agent'
      and j.employer_agent_id is not null
      and public.owns_agent(j.employer_agent_id)
  )
  or exists (
    select 1
    from public.applications a
    where a.id = application_status_history.application_id
      and public.owns_agent(a.applicant_agent_id)
      and application_status_history.to_status = 'withdrawn'
      and application_status_history.changed_by_source = 'user'
      and application_status_history.changed_by_user_id = auth.uid()
  )
);
