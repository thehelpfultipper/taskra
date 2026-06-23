# Supabase Edge Functions

Queue workers and cron orchestration for MVP backend automation.

## Layout

- `supabase/functions/_shared/` — canonical shared modules (edit here only).
- `supabase/functions/<function-name>/index.ts` — function entrypoints.
- `supabase/functions/<function-name>/_shared/` — deploy bundle copy (generated; do not edit).

Remote Supabase deploys **each function directory as an isolated bundle**. Parent-level `../_shared` imports are not included on hosted deploy. Run `npm run functions:prepare` to copy shared code into every function folder before local serve or remote deploy.

## Functions

| Function | Role | JWT verify |
|---|---|---|
| `activity-worker` | Drains `agent_activity` queue | yes (service-role bearer from cron) |
| `content-worker` | Drains `content_tasks` queue | yes |
| `market-worker` | Drains `market_tasks` queue | yes |
| `notification-worker` | Drains `notifications` queue | yes |
| `cron-pulse` | Enqueues bounded pulse work | no (`x-cron-secret` header) |

## Prepare and deploy

```bash
# Copy _shared into each function directory (required before serve/deploy/dashboard upload)
npm run functions:prepare

# CLI deploy (bundles on Supabase servers — no local Docker; works on many VPN setups)
npm run functions:deploy

# Dashboard deploy without CLI: zip each function for drag-and-drop upload
npm run functions:package
# → dist/edge-function-zips/*.zip
```

### If `supabase functions deploy` fails (VPN / Docker / corporate SSL)

1. **Try API bundling (no Docker):** `npm run functions:deploy` (uses `--use-api`).
2. **Dashboard + zip (no CLI):**
   - Run `npm run functions:package`
   - Supabase Dashboard → **Edge Functions** → **Deploy a new function** → **Via Editor**
   - Drag `dist/edge-function-zips/cron-pulse.zip` (etc.) into the editor
   - Set the function name to match the zip (`cron-pulse`, `activity-worker`, …)
   - Click **Deploy function**
   - Repeat for all five functions
3. **CI deploy:** GitHub Actions from a clean network (see Supabase deploy docs).

Set secrets in Dashboard → **Project Settings** → **Edge Functions** → **Secrets**, or via CLI when available:

```bash
supabase secrets set CRON_PULSE_SECRET=<random-long-secret> --project-ref "$SUPABASE_PROJECT_REF"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically for Edge Functions.

### CLI deploy (when network allows)

```bash
npm run functions:prepare
supabase functions deploy --use-api --project-ref "$SUPABASE_PROJECT_REF"
```

## Local development

```bash
npm run functions:prepare
supabase functions serve
```

Uses Deno 2 (`deno_version = 2` in `supabase/config.toml`) and `npm:@supabase/supabase-js@2` imports per current Supabase Edge Function guidance.

## Operational notes

- Respect `runtime_controls` and `agent_runtime_controls` safety rails.
- Keep handlers short-lived and idempotent for free-tier workloads.
- Register cron jobs via `supabase/sql/mvp-cron-pulse-jobs.sql` and `supabase/sql/mvp-worker-cron-jobs.sql`.
