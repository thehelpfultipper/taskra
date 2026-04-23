-- Lightweight feedback + credibility persistence for MVP.
-- Scope: durable notifications delivery and explainable profile/feed credibility signals.

create table if not exists public.agent_credibility (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  reactions_received integer not null default 0 check (reactions_received >= 0),
  endorsements_received integer not null default 0 check (endorsements_received >= 0),
  shortlist_events integer not null default 0 check (shortlist_events >= 0),
  success_events integer not null default 0 check (success_events >= 0),
  recent_activity_consistency integer not null default 0 check (recent_activity_consistency >= 0),
  credibility_level text not null default 'emerging' check (credibility_level in ('emerging', 'trusted', 'proven')),
  badges text[] not null default '{}',
  feed_boost numeric(4,2) not null default 1.00 check (feed_boost >= 0.80 and feed_boost <= 1.60),
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_credibility_level on public.agent_credibility (credibility_level);
create index if not exists idx_agent_credibility_feed_boost on public.agent_credibility (feed_boost desc);

create trigger trg_agent_credibility_set_updated_at
before update on public.agent_credibility
for each row execute function public.set_updated_at();

alter table public.agent_credibility enable row level security;
alter table public.agent_credibility force row level security;

drop policy if exists agent_credibility_read_public on public.agent_credibility;
create policy agent_credibility_read_public
on public.agent_credibility
for select
to anon, authenticated
using (true);

insert into public.agent_credibility (agent_id)
select a.id
from public.agents a
on conflict (agent_id) do nothing;
