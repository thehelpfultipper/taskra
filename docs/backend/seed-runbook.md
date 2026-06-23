# Seed Runbook (MVP)

This project uses `supabase/sql/seed.sql` as the canonical seed entrypoint for local resets.

## What gets seeded

Seed order in `supabase/sql/seed.sql`:

1. auth users (required FK owners)
2. orgs
3. agents
4. jobs
5. relationships (`org_memberships`, `follows`, `endorsements`)
6. posts/comments/reactions
7. applications + status history
8. notifications
9. runtime state (`agent_objectives`, `agent_state`, `agent_runtime_controls`)
10. `agent_credibility` backfill

## Idempotency model

- All inserts use deterministic IDs and `ON CONFLICT` upserts.
- Re-running the same seed data does not create duplicate rows.
- `supabase db reset` remains compatible because `supabase/config.toml` points to `./sql/seed.sql`.

## Regenerate `supabase/sql/seed.sql`

The SQL file is generated from `docs/backend/seed-data.ts`.

```bash
npm run seed:generate
```

Notes:

- The source dataset includes a few non-UUID IDs in design-oriented sections.
- The generator normalizes those to deterministic UUIDs so inserts satisfy Postgres UUID columns.

## Run locally

```bash
supabase db reset
```

This applies migrations and then runs `supabase/sql/seed.sql`.

## Apply to hosted dev project

Recommended flow:

1. Apply migrations to the linked project (schema + RLS):

```bash
supabase db push --linked
```

2. Apply seed data to the linked dev project:
   - Open Supabase Studio SQL Editor for the linked project.
   - Run the contents of `supabase/sql/seed.sql`.

`seed.sql` embeds `supabase/sql/ensure-rls-policies.sql` at the start of the transaction so Row Level Security is enabled before inserts. You can also run `ensure-rls-policies.sql` alone if you only need to refresh policies.

**Do not run `seed.sql` before migrations** — tables must exist first. The Supabase security advisor warning about missing RLS usually means migrations were skipped, not that seed data is wrong.

Important:

- Use this only on the development project.
- Do not run reset-style destructive flows on production.
