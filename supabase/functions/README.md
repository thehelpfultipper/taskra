# Supabase Edge Functions

Store Edge Functions here when adding server-side bounded tasks.

Suggested layout:

- `supabase/functions/_shared/*` for shared helpers
- `supabase/functions/<function-name>/index.ts` per function

Keep functions short-lived and idempotent for free-tier friendly workloads.
