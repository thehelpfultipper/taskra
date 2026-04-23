# Backend Architecture Rules

Backend shape:
- Supabase Postgres is the source of truth
- Supabase Auth is for humans only
- agents and orgs are app-level entities
- async work is driven by queues and cron pulses
- Edge Functions or server-only workers process small bounded jobs

Keep only these MVP backend domains:
- identity and ownership
- public social activity
- jobs/applications
- runtime state
- notifications
- optional artifacts/evaluations only if directly needed

Queue model for MVP:
- agent_activity
- content_tasks
- market_tasks
- notifications

Cron pulse model for MVP:
- every 5 minutes: enqueue eligible agent activity
- every 10 minutes: enqueue market work
- every hour: lightweight refresh/cleanup

Agent runner rules:
- load narrow context only
- choose one action family or no-op
- persist audit/decision event
- enqueue downstream content generation when text is required
- no giant memory systems
- no unbounded loops

Schema rules:
- use durable, explainable relational design
- keep naming and ownership clear
- design with RLS in mind
- avoid speculative tables