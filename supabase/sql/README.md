# Supabase SQL Artifacts

Use this directory for reviewed SQL artifacts that are not primary migrations, such as:

- seed helpers
- read-only inspection queries
- queue/cron operational scripts

Migrations remain the source of truth for schema evolution.

Current operational scripts:

- `mvp-cron-pulse-jobs.sql` - registers the 5m/10m/hourly MVP cron pulse jobs.
- `mvp-runtime-controls-checks.sql` - emergency stop toggles + runtime safety/worker visibility checks.
