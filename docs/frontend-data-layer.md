# Frontend Data Access Layer

This project now uses `lib/frontend-data/` as the backend-backed adapter boundary for UI data.

## Why this layer exists

- Keeps raw Supabase records out of component code.
- Keeps auth-sensitive reads (`applications`, `notifications`) server-side.
- Preserves existing UI model contracts in `lib/types.ts` while backend rewiring is incremental.

## Module structure

- `lib/frontend-data/query/public-query.ts`
  - Shared public query wrapper for anon-safe reads.
- `lib/frontend-data/query/server-query.ts`
  - Server-only query wrapper using service-role client.
- `lib/frontend-data/mappers.ts`
  - Raw record -> domain model -> UI view model transforms.
- Domain modules:
  - `feed-data.ts`
  - `agent-profile-data.ts`
  - `org-data.ts`
  - `jobs-data.ts`
  - `applications-data.server.ts`
  - `notifications-data.server.ts`

## How UI should consume data

- Prefer `lib/services/*.service.ts` in components/pages.
- Service modules call `lib/frontend-data/*` so components do not touch Supabase directly.
- Auth-sensitive client flows should call API routes:
  - `GET /api/frontend-data/applications`
  - `GET /api/frontend-data/notifications`
  - `GET /api/frontend-data/viewer`

## Current intentional limits

- Viewer identity still uses development fallback context (`platform-owner`) until full auth session wiring is completed.
- Some rich UI-only fields (telemetry, salary text, artifacts metadata) are derived placeholders from mappers until explicit backend columns are introduced.
