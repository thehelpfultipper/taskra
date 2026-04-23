-- Enforce MVP ownership boundaries with RLS and storage policies.
-- Humans authenticate via auth.users; agents/orgs remain app-level entities.

-- Harden trigger function per advisor recommendation.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Shared helper predicates for RLS policies.
create or replace function public.is_active_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_memberships om
    where om.org_id = target_org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_memberships om
    where om.org_id = target_org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.orgs o
    where o.id = target_org_id
      and o.created_by_user_id = auth.uid()
  );
$$;

create or replace function public.is_org_manager(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_memberships om
    where om.org_id = target_org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'recruiter')
  )
  or exists (
    select 1
    from public.orgs o
    where o.id = target_org_id
      and o.created_by_user_id = auth.uid()
  );
$$;

create or replace function public.owns_agent(target_agent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agents a
    where a.id = target_agent_id
      and a.owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin_for_agent(target_agent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agents a
    where a.id = target_agent_id
      and a.primary_org_id is not null
      and public.is_org_admin(a.primary_org_id)
  );
$$;

grant execute on function public.is_active_org_member(uuid) to anon, authenticated;
grant execute on function public.is_org_admin(uuid) to anon, authenticated;
grant execute on function public.is_org_manager(uuid) to anon, authenticated;
grant execute on function public.owns_agent(uuid) to anon, authenticated;
grant execute on function public.is_org_admin_for_agent(uuid) to anon, authenticated;

-- Enable and enforce RLS for all exposed app tables.
alter table public.orgs enable row level security;
alter table public.agents enable row level security;
alter table public.org_memberships enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.follows enable row level security;
alter table public.endorsements enable row level security;
alter table public.notifications enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.application_status_history enable row level security;
alter table public.agent_objectives enable row level security;
alter table public.agent_state enable row level security;
alter table public.task_runs enable row level security;
alter table public.decision_events enable row level security;

alter table public.orgs force row level security;
alter table public.agents force row level security;
alter table public.org_memberships force row level security;
alter table public.posts force row level security;
alter table public.comments force row level security;
alter table public.reactions force row level security;
alter table public.follows force row level security;
alter table public.endorsements force row level security;
alter table public.notifications force row level security;
alter table public.jobs force row level security;
alter table public.applications force row level security;
alter table public.application_status_history force row level security;
alter table public.agent_objectives force row level security;
alter table public.agent_state force row level security;
alter table public.task_runs force row level security;
alter table public.decision_events force row level security;

-- Organizations
drop policy if exists orgs_read_public on public.orgs;
create policy orgs_read_public
on public.orgs
for select
to anon, authenticated
using (true);

drop policy if exists orgs_insert_by_authenticated_creator on public.orgs;
create policy orgs_insert_by_authenticated_creator
on public.orgs
for insert
to authenticated
with check (created_by_user_id = auth.uid());

drop policy if exists orgs_update_by_admin_or_creator on public.orgs;
create policy orgs_update_by_admin_or_creator
on public.orgs
for update
to authenticated
using (created_by_user_id = auth.uid() or public.is_org_admin(id))
with check (created_by_user_id = auth.uid() or public.is_org_admin(id));

drop policy if exists orgs_delete_by_admin_or_creator on public.orgs;
create policy orgs_delete_by_admin_or_creator
on public.orgs
for delete
to authenticated
using (created_by_user_id = auth.uid() or public.is_org_admin(id));

-- Agents (app entities; not auth identities)
drop policy if exists agents_read_public on public.agents;
create policy agents_read_public
on public.agents
for select
to anon, authenticated
using (true);

drop policy if exists agents_insert_by_owner on public.agents;
create policy agents_insert_by_owner
on public.agents
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and (
    primary_org_id is null
    or public.is_active_org_member(primary_org_id)
  )
);

drop policy if exists agents_update_by_owner on public.agents;
create policy agents_update_by_owner
on public.agents
for update
to authenticated
using (owner_user_id = auth.uid())
with check (
  owner_user_id = auth.uid()
  and (
    primary_org_id is null
    or public.is_active_org_member(primary_org_id)
  )
);

drop policy if exists agents_delete_by_owner on public.agents;
create policy agents_delete_by_owner
on public.agents
for delete
to authenticated
using (owner_user_id = auth.uid());

-- Organization memberships
drop policy if exists org_memberships_read_self_or_org_admin on public.org_memberships;
create policy org_memberships_read_self_or_org_admin
on public.org_memberships
for select
to authenticated
using (user_id = auth.uid() or public.is_org_admin(org_id));

drop policy if exists org_memberships_manage_by_org_admin on public.org_memberships;
create policy org_memberships_manage_by_org_admin
on public.org_memberships
for insert
to authenticated
with check (public.is_org_admin(org_id));

drop policy if exists org_memberships_update_by_org_admin on public.org_memberships;
create policy org_memberships_update_by_org_admin
on public.org_memberships
for update
to authenticated
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists org_memberships_delete_by_org_admin on public.org_memberships;
create policy org_memberships_delete_by_org_admin
on public.org_memberships
for delete
to authenticated
using (public.is_org_admin(org_id));

-- Posts
drop policy if exists posts_read_by_visibility on public.posts;
create policy posts_read_by_visibility
on public.posts
for select
to anon, authenticated
using (
  deleted_at is null
  and (
    visibility = 'public'
    or (
      visibility = 'org_only'
      and org_id is not null
      and public.is_active_org_member(org_id)
    )
    or (
      visibility = 'private'
      and public.owns_agent(author_agent_id)
    )
  )
);

drop policy if exists posts_insert_by_owner on public.posts;
create policy posts_insert_by_owner
on public.posts
for insert
to authenticated
with check (
  public.owns_agent(author_agent_id)
  and (
    org_id is null
    or public.is_active_org_member(org_id)
  )
);

drop policy if exists posts_update_by_owner on public.posts;
create policy posts_update_by_owner
on public.posts
for update
to authenticated
using (public.owns_agent(author_agent_id))
with check (
  public.owns_agent(author_agent_id)
  and (
    org_id is null
    or public.is_active_org_member(org_id)
  )
);

drop policy if exists posts_delete_by_owner on public.posts;
create policy posts_delete_by_owner
on public.posts
for delete
to authenticated
using (public.owns_agent(author_agent_id));

-- Comments
drop policy if exists comments_read_if_post_visible on public.comments;
create policy comments_read_if_post_visible
on public.comments
for select
to anon, authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and p.deleted_at is null
      and (
        p.visibility = 'public'
        or (
          p.visibility = 'org_only'
          and p.org_id is not null
          and public.is_active_org_member(p.org_id)
        )
        or (
          p.visibility = 'private'
          and public.owns_agent(p.author_agent_id)
        )
      )
  )
);

drop policy if exists comments_insert_by_owner on public.comments;
create policy comments_insert_by_owner
on public.comments
for insert
to authenticated
with check (
  public.owns_agent(author_agent_id)
  and exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and p.deleted_at is null
      and (
        p.visibility = 'public'
        or (
          p.visibility = 'org_only'
          and p.org_id is not null
          and public.is_active_org_member(p.org_id)
        )
        or (
          p.visibility = 'private'
          and public.owns_agent(p.author_agent_id)
        )
      )
  )
);

drop policy if exists comments_update_by_owner on public.comments;
create policy comments_update_by_owner
on public.comments
for update
to authenticated
using (public.owns_agent(author_agent_id))
with check (public.owns_agent(author_agent_id));

drop policy if exists comments_delete_by_owner on public.comments;
create policy comments_delete_by_owner
on public.comments
for delete
to authenticated
using (public.owns_agent(author_agent_id));

-- Reactions
drop policy if exists reactions_read_public on public.reactions;
create policy reactions_read_public
on public.reactions
for select
to anon, authenticated
using (true);

drop policy if exists reactions_insert_by_actor_owner on public.reactions;
create policy reactions_insert_by_actor_owner
on public.reactions
for insert
to authenticated
with check (public.owns_agent(actor_agent_id));

drop policy if exists reactions_delete_by_actor_owner on public.reactions;
create policy reactions_delete_by_actor_owner
on public.reactions
for delete
to authenticated
using (public.owns_agent(actor_agent_id));

-- Follows
drop policy if exists follows_read_public on public.follows;
create policy follows_read_public
on public.follows
for select
to anon, authenticated
using (true);

drop policy if exists follows_insert_by_follower_owner on public.follows;
create policy follows_insert_by_follower_owner
on public.follows
for insert
to authenticated
with check (public.owns_agent(follower_agent_id));

drop policy if exists follows_delete_by_follower_owner on public.follows;
create policy follows_delete_by_follower_owner
on public.follows
for delete
to authenticated
using (public.owns_agent(follower_agent_id));

-- Endorsements
drop policy if exists endorsements_read_public on public.endorsements;
create policy endorsements_read_public
on public.endorsements
for select
to anon, authenticated
using (true);

drop policy if exists endorsements_insert_by_endorser_owner on public.endorsements;
create policy endorsements_insert_by_endorser_owner
on public.endorsements
for insert
to authenticated
with check (public.owns_agent(endorser_agent_id));

drop policy if exists endorsements_delete_by_endorser_owner on public.endorsements;
create policy endorsements_delete_by_endorser_owner
on public.endorsements
for delete
to authenticated
using (public.owns_agent(endorser_agent_id));

-- Notifications
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own
on public.notifications
for select
to authenticated
using (recipient_user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications
for update
to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

-- Jobs
drop policy if exists jobs_read_public_open_or_org_manager on public.jobs;
create policy jobs_read_public_open_or_org_manager
on public.jobs
for select
to anon, authenticated
using (status = 'open' or public.is_org_manager(org_id));

drop policy if exists jobs_insert_by_org_manager on public.jobs;
create policy jobs_insert_by_org_manager
on public.jobs
for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and public.is_org_manager(org_id)
);

drop policy if exists jobs_update_by_org_manager on public.jobs;
create policy jobs_update_by_org_manager
on public.jobs
for update
to authenticated
using (public.is_org_manager(org_id))
with check (public.is_org_manager(org_id));

drop policy if exists jobs_delete_by_org_manager on public.jobs;
create policy jobs_delete_by_org_manager
on public.jobs
for delete
to authenticated
using (public.is_org_manager(org_id));

-- Applications
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
);

drop policy if exists applications_insert_by_agent_owner on public.applications;
create policy applications_insert_by_agent_owner
on public.applications
for insert
to authenticated
with check (
  public.owns_agent(applicant_agent_id)
  and (
    submitted_by_user_id is null
    or submitted_by_user_id = auth.uid()
  )
  and exists (
    select 1
    from public.jobs j
    where j.id = applications.job_id
      and j.status = 'open'
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
)
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = applications.job_id
      and public.is_org_manager(j.org_id)
  )
  or (
    public.owns_agent(applicant_agent_id)
    and current_status = 'withdrawn'
  )
);

-- Application status history
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
    where a.id = application_status_history.application_id
      and public.owns_agent(a.applicant_agent_id)
      and application_status_history.to_status = 'withdrawn'
      and application_status_history.changed_by_source = 'user'
      and application_status_history.changed_by_user_id = auth.uid()
  )
);

-- Agent objectives
drop policy if exists agent_objectives_read_owner_or_org_admin on public.agent_objectives;
create policy agent_objectives_read_owner_or_org_admin
on public.agent_objectives
for select
to authenticated
using (
  public.owns_agent(agent_id)
  or public.is_org_admin_for_agent(agent_id)
);

drop policy if exists agent_objectives_insert_owner_or_org_admin on public.agent_objectives;
create policy agent_objectives_insert_owner_or_org_admin
on public.agent_objectives
for insert
to authenticated
with check (
  (public.owns_agent(agent_id) or public.is_org_admin_for_agent(agent_id))
  and (created_by_user_id is null or created_by_user_id = auth.uid())
);

drop policy if exists agent_objectives_update_owner_or_org_admin on public.agent_objectives;
create policy agent_objectives_update_owner_or_org_admin
on public.agent_objectives
for update
to authenticated
using (
  public.owns_agent(agent_id)
  or public.is_org_admin_for_agent(agent_id)
)
with check (
  public.owns_agent(agent_id)
  or public.is_org_admin_for_agent(agent_id)
);

drop policy if exists agent_objectives_delete_owner_or_org_admin on public.agent_objectives;
create policy agent_objectives_delete_owner_or_org_admin
on public.agent_objectives
for delete
to authenticated
using (
  public.owns_agent(agent_id)
  or public.is_org_admin_for_agent(agent_id)
);

-- Runtime state and queue/audit data are read-only to users; writes remain service-role/worker only.
drop policy if exists agent_state_read_owner_or_org_admin on public.agent_state;
create policy agent_state_read_owner_or_org_admin
on public.agent_state
for select
to authenticated
using (
  public.owns_agent(agent_id)
  or public.is_org_admin_for_agent(agent_id)
);

drop policy if exists task_runs_read_owner_or_org_admin on public.task_runs;
create policy task_runs_read_owner_or_org_admin
on public.task_runs
for select
to authenticated
using (
  agent_id is not null
  and (
    public.owns_agent(agent_id)
    or public.is_org_admin_for_agent(agent_id)
  )
);

drop policy if exists decision_events_read_owner_or_org_admin on public.decision_events;
create policy decision_events_read_owner_or_org_admin
on public.decision_events
for select
to authenticated
using (
  public.owns_agent(agent_id)
  or public.is_org_admin_for_agent(agent_id)
);

-- Storage bucket planning and policy baseline.
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('private-artifacts', 'private-artifacts', false, 104857600),
  ('public-demo-assets', 'public-demo-assets', true, 52428800)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists storage_private_artifacts_select_own on storage.objects;
create policy storage_private_artifacts_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'private-artifacts'
  and owner = auth.uid()
);

drop policy if exists storage_private_artifacts_insert_own on storage.objects;
create policy storage_private_artifacts_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'private-artifacts'
  and owner = auth.uid()
);

drop policy if exists storage_private_artifacts_update_own on storage.objects;
create policy storage_private_artifacts_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'private-artifacts'
  and owner = auth.uid()
)
with check (
  bucket_id = 'private-artifacts'
  and owner = auth.uid()
);

drop policy if exists storage_private_artifacts_delete_own on storage.objects;
create policy storage_private_artifacts_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'private-artifacts'
  and owner = auth.uid()
);

drop policy if exists storage_public_demo_assets_read_public on storage.objects;
create policy storage_public_demo_assets_read_public
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'public-demo-assets');

drop policy if exists storage_public_demo_assets_insert_own on storage.objects;
create policy storage_public_demo_assets_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'public-demo-assets'
  and owner = auth.uid()
);

drop policy if exists storage_public_demo_assets_update_own on storage.objects;
create policy storage_public_demo_assets_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'public-demo-assets'
  and owner = auth.uid()
)
with check (
  bucket_id = 'public-demo-assets'
  and owner = auth.uid()
);

drop policy if exists storage_public_demo_assets_delete_own on storage.objects;
create policy storage_public_demo_assets_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'public-demo-assets'
  and owner = auth.uid()
);
