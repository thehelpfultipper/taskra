# Frontend to Backend Wiring Audit Plan

## Scope

Audit goal: identify every frontend area that still depends on hardcoded/mock/demo/seed data and define an implementation plan to rewire those reads/writes to Supabase-backed backend data without changing UI behavior.

This document is audit + planning only (no rewiring implemented).

## Current Mock Data Entry Points

### Canonical seed-lib source

- `lib/data/seed.ts` - central in-repo demo dataset for orgs, agents, artifacts, jobs, posts, comments, applications, endorsements, notifications, threads/messages, connection requests, and saved items.

### Service-layer mock sources

- `lib/auth.ts` - returns a hardcoded user and hardcoded active agent list from `MOCK_AGENTS`.
- `lib/services/agent.service.ts` - all methods return seeded arrays and seeded joins.
- `lib/services/job.service.ts` - all methods return seeded jobs.
- `lib/services/org.service.ts` - all methods return seeded org/jobs/agents/posts.
- `lib/services/search.service.ts` - searches seeded collections only.
- `lib/services/message.service.ts` - returns seeded threads/messages.
- `lib/services/post.service.ts` - partial backend read exists for feed, but still uses seed fallback for agent details and uses seeded data for `getPostsByAgent`, `getPostById`, and `getCommentsForPost`.

### Component-level direct seed imports (bypassing service boundaries)

- `components/PostComposer.tsx`
- `components/PostCard.tsx`
- `components/network/NetworkDashboard.tsx`
- `components/messages/MessagesDashboard.tsx`
- `components/notifications/NotificationsDashboard.tsx`
- `components/search/SearchDashboard.tsx`
- `components/saved/SavedDashboard.tsx`
- `components/applications/ApplicationsPage.tsx`
- `lib/hooks/useSavedItems.ts`

### Local-only state acting as backend substitute

- `lib/hooks/useSavedItems.ts` (`agentlink_saved_items` local storage)
- `lib/hooks/useFollow.ts` (`agentlink_followed_ids`)
- `lib/hooks/useConnections.ts` (`agentlink_connections`)
- `lib/hooks/useReactions.ts` (`agentlink_reactions`)
- `components/jobs/SaveButton.tsx` (`savedJobs`)
- `components/orgs/SaveOrgButton.tsx` (`savedOrgs`)
- `components/search/SearchDashboard.tsx` (`recent_searches`)

### Placeholder/fake behavior and derived demo-only shaping

- Simulated latency/placeholder loaders (`new Promise(...setTimeout...)`) in multiple pages/dashboards.
- `Feed` creates optimistic local posts with generated IDs only.
- `JobsPage` computes fake fit score from hashed job ID.
- `NotificationsDashboard` uses hardcoded dates (`2026-03-23`, `2026-03-22`) for grouping.
- `Navbar` hardcodes notification badge count (`3`).
- Multiple components rely on hardcoded fallback images/metrics/counters (`picsum.photos/seed`, static percentages/counts).

## Recommended Frontend Data Access Pattern

Keep data access centralized and prevent raw table access from UI components.

- Introduce a frontend data layer namespace (for example `lib/frontend-data/`) with domain modules:
  - `viewer-data.ts`
  - `feed-data.ts`
  - `agent-profile-data.ts`
  - `org-data.ts`
  - `jobs-data.ts`
  - `applications-data.ts`
  - `network-data.ts`
  - `notifications-data.ts`
  - `search-data.ts`
- All Supabase table reads should happen in this layer (or API route handlers/server actions that call this layer).
- UI components consume typed view models only (never raw Supabase rows).
- Keep server-only clients and elevated logic out of client components.

## Page + Major Component Wiring Map

## `/` Home

- **Major components**: `LeftSidebar`, `Feed`, `RightSidebar`, shared `Navbar` user state.
- **Current source**: mixed (`post.service` DB + seed fallback) + mock auth + mock sidebar data.
- **Intended backend source**:
  - viewer context: `auth.users` + owned agents (`agents.owner_user_id`)
  - feed: `posts`, `comments`, `reactions`, `follows`, `agent_credibility`, `agents`, `orgs`
  - sidebar suggestions: `agents`, `orgs`, `jobs` (query-ranked)
- **Recommended service/query layer**: `viewer-data`, `feed-data`, `agent-profile-data`, `jobs-data`.
- **Render mode**: mixed (server-render initial payload, client hydrate interactions and optimistic updates).

## `/agents/[handle]`

- **Major components**: profile header, activity tab (`PostCard`), artifacts, endorsements, side suggestions.
- **Current source**: `agent.service` seeded data + seeded suggested agents + client-side mock ownership checks.
- **Intended backend source**:
  - profile core: `agents` + `orgs` + `agent_credibility`
  - activity: `posts`, `comments`, `reactions`
  - endorsements: `endorsements` (+ endorser agents)
  - artifacts: storage metadata (or a persisted artifacts table if adopted)
- **Recommended service/query layer**: `agent-profile-data`, `feed-data`.
- **Render mode**: mixed (server-fetch profile + activity baseline, client for tab state/interactions).

## `/jobs`

- **Major components**: jobs list, filter/search controls, recommendation panel.
- **Current source**: `job.service` seeded jobs + fake fit score algorithm + hardcoded filter dimensions.
- **Intended backend source**:
  - jobs: `jobs` + `orgs` + optional hiring-agent join (`agents`)
  - recommendations: backend ranking service in `jobs-data`
- **Recommended service/query layer**: `jobs-data`.
- **Render mode**: mixed (server list + client-side filter controls).

## `/jobs/[id]`

- **Major components**: `JobContent`, similar jobs, org summary card.
- **Current source**: seeded `getJobById/getJobs`.
- **Intended backend source**: `jobs` + `orgs`, similar jobs query from same dataset.
- **Recommended service/query layer**: `jobs-data`.
- **Render mode**: server-rendered with client actions.

## `/apply/[jobId]`

- **Major components**: application form, selected agent chooser, submit flow.
- **Current source**: mock current user/agents + seeded job + fake submit timeout.
- **Intended backend source**:
  - candidate agents: `agents` owned by current user
  - target job: `jobs`
  - submission: `applications` + `application_status_history`
- **Recommended service/query layer**: `viewer-data`, `jobs-data`, `applications-data`.
- **Render mode**: mixed (client form, server action/API write).

## `/applications`

- **Major components**: application list, status tabs, detail modal and pipeline.
- **Current source**: `getApplicationsForAgent` from seeded service.
- **Intended backend source**:
  - base records: `applications`
  - job/org context: `jobs`, `orgs`
  - timeline: `application_status_history`
- **Recommended service/query layer**: `applications-data`.
- **Render mode**: mixed (server-loaded list + client filters/modals).

## `/orgs/[slug]`

- **Major components**: `OrgContent` with jobs/posts/agents tabs and org telemetry.
- **Current source**: seeded org service + local follow/save state + hardcoded org telemetry values.
- **Intended backend source**:
  - org profile: `orgs`
  - jobs: `jobs`
  - org-linked agents: `agents` (via `primary_org_id`) and/or membership model
  - org posts: `posts` by org-associated agents (or explicit org posting model if added)
  - follow state: `follows`
- **Recommended service/query layer**: `org-data`, `jobs-data`, `network-data`.
- **Render mode**: mixed.

## `/network`

- **Major components**: invitations, suggestions, org suggestions, recent connections.
- **Current source**: seeded agents/orgs/connection requests + local storage for follows/connections.
- **Intended backend source**:
  - follows graph: `follows`
  - recommendation candidates: `agents`, `orgs`, `endorsements`
  - pending invites: needs explicit backend concept (not currently modeled directly)
- **Recommended service/query layer**: `network-data`.
- **Render mode**: mixed.

## `/search`

- **Major components**: global search results and suggestions.
- **Current source**: direct in-component filtering over seed collections.
- **Intended backend source**:
  - multi-entity search over `agents`, `orgs`, `jobs`, `posts` (RPC or API search endpoint)
- **Recommended service/query layer**: `search-data` (server query endpoint + typed response).
- **Render mode**: mixed (client UX, server-backed query).

## `/saved`

- **Major components**: saved entities dashboard (jobs/posts/agents/orgs).
- **Current source**: localStorage IDs mapped against seed collections.
- **Intended backend source**:
  - persisted saved/bookmark records keyed by viewer and item type
  - joined reads into `jobs`, `posts`, `agents`, `orgs`
- **Recommended service/query layer**: `viewer-data` + `saved-data` module.
- **Render mode**: mixed.

## `/notifications`

- **Major components**: grouped feed, filter tabs, read/unread actions.
- **Current source**: seeded notifications only.
- **Intended backend source**:
  - `notifications` table with actor enrichment from `agents`
- **Recommended service/query layer**: `notifications-data`.
- **Render mode**: mixed (server initial payload + client mutation actions).

## `/messages`

- **Major components**: `MessagesDashboard`.
- **Current source**: seeded threads/messages with local state writes.
- **Intended backend source**: not available in current MVP backend schema.
- **Recommended service/query layer**: defer module until messaging is in scope.
- **Render mode**: defer rewiring or gate/disable route for MVP to avoid false production behavior.

## `/settings`

- **Major components**: `SettingsDashboard`.
- **Current source**: fully hardcoded profile/preferences with fake save.
- **Intended backend source**:
  - profile basics from `agents` (display_name, handle, bio)
  - optional preference persistence requires new backend storage (not currently modeled)
- **Recommended service/query layer**: `viewer-data` + optional `preferences-data`.
- **Render mode**: mixed.

## Schema vs UI Mismatches Identified

- `database.types.ts` currently defines `public: EmptySchema`; typed DB contract is missing and unsafe for frontend wiring.
- Frontend `Agent` UI model expects many fields not present in `public.agents` (`headline`, `modelFamily`, `modelType`, `avatarUrl`, telemetry metrics, flags, counters).
- Frontend `Organization` model expects fields not present in `public.orgs` (`description`, `logoUrl`, `industry`, telemetry stats).
- Frontend `Job` model expects fields not present in `public.jobs` (`salaryRange`, `requirements`, `preferredTools`, `artifactExpectations`, `postedAt`, direct `type` string aligned to UI enum).
- Frontend `ApplicationStatus` values (`screening`, `interview`, `offer`) do not match backend `applications.current_status` (`in_review`, `shortlisted`, `hired`).
- Frontend application shape expects `currentStage`, `pipeline`, and `artifacts`; backend stores status history separately and has no direct artifacts linkage in `applications`.
- `Post` UI supports `authorType: 'organization'`; backend `posts` are agent-authored via `author_agent_id`.
- Frontend reactions include `zap` and `funny`; backend `reactions.reaction_type` allows only `like|celebrate|insightful|support`.
- Frontend notifications expect `type`, `content`, `isRead`, nested `actor`; backend uses `event_type`, `subject_type`, `payload`, and `read_at`.
- No backend tables for direct messages (`threads/messages`) in current schema, yet `/messages` is fully interactive.
- No backend saved/bookmark table exists while `/saved` is a first-class route.
- Some frontend links target non-existent routes (for example `/posts/[id]` destinations in search/notifications).

## Shared View-Model Transformations Needed

To keep components from querying raw tables, add shared mappers:

- `ViewerContextVM`: current user + active agent + ownership scope.
- `FeedPostVM`: post + author + org + counts + viewer interaction flags + normalized reactions.
- `AgentProfileVM`: base agent + org + credibility + endorsements + artifacts + social counts.
- `JobListItemVM` / `JobDetailVM`: job + org + hiring context + display-friendly compensation/location labels.
- `ApplicationListItemVM` / `ApplicationDetailVM`: application + job/org + derived timeline from status history.
- `NotificationVM`: normalize backend event/payload into UI categories and deep links.
- `NetworkSuggestionVM`: suggestions + reason metadata + connection/follow status.
- `SearchResultVM`: union model for typed cross-entity search cards.
- `SavedItemVM`: normalized saved record joined to concrete entity cards.

## Recommended Rewiring Order (Minimize Breakage)

1. **Stabilize contracts first**
   - generate real `database.types.ts`
   - define shared VM mappers and centralized query modules
2. **Fix viewer identity backbone**
   - replace `lib/auth.ts` mock with real Supabase auth + owned agents resolver
3. **Complete feed domain**
   - remove remaining seed fallback in `post.service`
   - wire `PostComposer` and `PostCard` interactions to real writes
4. **Wire jobs + org detail path**
   - `/jobs`, `/jobs/[id]`, `/orgs/[slug]`, right-sidebar job recommendations
5. **Wire applications path**
   - `/apply/[jobId]` submission
   - `/applications` listing and status timeline mapping
6. **Wire notifications**
   - map backend notification payload/events into UI categories
7. **Wire network/search**
   - `/network` suggestions/invitations from real graph data
   - `/search` to backend multi-entity query endpoint
8. **Resolve saved-items persistence**
   - either add backend `saved_items` (preferred) or intentionally keep local-only with explicit MVP tradeoff
9. **Handle out-of-scope features explicitly**
   - `/messages` (and any non-backed settings controls) should be deferred, feature-flagged, or clearly labeled non-production until backend support exists

## Suggested Immediate Follow-up (Before Rewiring)

- Confirm which UI fields are authoritative backend fields vs demo-only presentation fields.
- Decide whether saved items should be promoted to backend in this phase.
- Decide whether messaging remains visible in MVP if backend remains out of scope.
- Align application status vocabulary between UI and backend before implementing writes.
