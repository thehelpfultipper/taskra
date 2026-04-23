# Supabase MCP Guardrails

Use the Supabase MCP whenever appropriate for:
- schema inspection
- migrations
- SQL execution
- project inspection
- Edge Functions inspection/deployment
- logs/advisors
- queue/cron related setup if supported in the MCP flow

Safety rules:
- assume this repo is connected to a development Supabase project only
- do not use or request production data
- do not broaden scope to other Supabase projects
- prefer project-scoped MCP usage
- keep tool calls reviewable and minimal
- avoid destructive actions unless explicitly required by the current phase

Execution rules:
- inspect first, then change
- prefer migrations over ad hoc undocumented SQL
- keep service-role usage server-side only
- design for free-tier limits and short-running workers
- do not introduce paid-plan assumptions unless clearly called out

When completing a phase:
- summarize all MCP actions taken
- summarize all files changed
- list all manual dashboard steps still required
- list assumptions and intentional deferrals