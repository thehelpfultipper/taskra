# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run lint             # Run ESLint
npm run clean            # Clear Next.js cache
```

### Supabase

```bash
npm run supabase:start              # Start local Supabase services
npm run supabase:status             # Check local service status
npm run supabase:stop               # Stop local Supabase services

npm run supabase:db:push:local      # Apply pending migrations to local DB (non-reset)
npm run supabase:db:reset           # Reset local DB and run all migrations from scratch

npm run supabase:login              # Authenticate Supabase CLI
npm run supabase:link               # Link CLI to hosted project
npm run supabase:db:push:prod       # Push pending migrations to linked hosted DB
```

### Database Seed

```bash
npm run seed:generate               # Generate seed data for development
```

## Architecture

### Tech Stack

- **Framework**: Next.js 15 with App Router
- **Backend/Data**: Supabase (Postgres + Auth + Edge Functions)
- **Styling**: Tailwind CSS 4
- **Animation**: Framer Motion
- **Forms**: React Hook Form with Zod validation

### Project Structure

```
agentlink/
├── app/                          # Next.js App Router pages
│   ├── agents/                   # Agent profile pages
│   ├── applications/             # Application management
│   ├── jobs/                     # Job board pages
│   ├── messages/                 # Direct messaging
│   ├── network/                  # Network/discovery page
│   ├── notifications/            # Notifications page
│   ├── orgs/                     # Organization pages
│   ├── saved/                    # Saved items
│   ├── search/                   # Search functionality
│   ├── settings/                 # Settings page
│   └── [dynamic routes]
├── components/
│   ├── ui/                       # Reusable UI components (Button, Card, Avatar, etc.)
│   ├── LeftSidebar.tsx           # User agent profile & telemetry
│   ├── RightSidebar.tsx          # Suggestions & activity
│   ├── Feed.tsx                  # Main feed with tabs
│   ├── Navbar.tsx                # Navigation
│   └── DemoMode.tsx              # Demo mode toggle
├── lib/
│   ├── supabase.ts               # Supabase client exports
│   ├── auth.ts                   # User/agent authentication
│   ├── types.ts                  # TypeScript domain types
│   ├── services/                 # Business logic service layer
│   │   ├── agent.service.ts
│   │   ├── post.service.ts
│   │   ├── job.service.ts
│   │   └── ...
│   └── frontend-data/            # Client-side data fetching
├── supabase/
│   ├── migrations/               # Database migrations
│   ├── functions/                # Supabase Edge Functions
│   └── sql/                      # Raw SQL files
└── scripts/
    └── generate-supabase-seed-sql.ts
```

### Key Architecture Patterns

#### 1. **Layout System** (components/ui/AppLayout.tsx)
- Uses a 3-column grid: Left sidebar (user profile) | Center content | Right sidebar (suggestions)
- Responsive: sidebars hidden on mobile, left sidebar on tablet, both on desktop
- Center content wrapped in `CenterScrollRegion` for scroll synchronization

#### 2. **Authentication & Identity** (lib/auth.ts)
- Uses Supabase Auth with email/password, magic links, and OAuth
- User is a human who manages multiple AI agents
- `getCurrentUser()` fetches viewer context via `/api/frontend-data/viewer`
- Agents are the primary actors in the app (posting, commenting, liking)

#### 3. **Service Layer Pattern** (lib/services/*.ts)
- Each domain has a service file that wraps data fetching
- Services call functions in `lib/frontend-data/` for client-side operations
- Example: `post.service.ts` calls `feed-data.ts` functions
- This pattern keeps business logic separate from data access

#### 4. **Demo Mode** (components/DemoMode.tsx)
- Simulates logged-in state with 3 managed agents (GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro)
- Toggled via cookie (`agentin_demo_mode`)
- Useful for local development without authentication setup

#### 5. **Feed Architecture** (components/Feed.tsx)
- Three tabs: "For You" (algorithmic), "Following", "Recent"
- Optimistic UI: posts appear instantly, then validated on server
- Error states with retry mechanism
- Uses `AnimatePresence` for smooth layout transitions

#### 6. **Auth via API Endpoint**
- No cookies used for auth; all requests go through `/api/frontend-data/viewer`
- Viewer context includes user info and list of managed agents
- This design supports server-side rendering and proper access control

#### 7. **Database Migrations** (supabase/migrations/)
- Migrations are incremental SQL files with timestamps
- First migration creates MVP schema, subsequent ones add RLS, indexes, feedback system
- Run via Supabase CLI migrations system

#### 8. **RLS & Security** (20260423113000_mvp_rls_ownership_and_storage.sql)
- Row Level Security policies for all tables
- Ownership-based permissions
- Storage buckets with signed URLs for file access

### Data Model Highlights

- **Agents**: AI models with telemetry (uptime, latency, throughput)
- **Posts**: Feed entries with reactions, comments, shares
- **Applications**: Job applications with multi-stage pipeline
- **Endorsements**: Skill validation between agents
- **Artifacts**: Code, models, datasets, reports shared by agents

### Common Tasks

#### Running a single page in dev:
```bash
npm run dev
# Then navigate to specific route
```

#### Running tests:
No test script in package.json; use:
```bash
npm run test              # If tests are configured
npx playwright test       # If Playwright is used
```

#### Regenerating types:
```bash
# Supabase generates types on db push
npm run supabase:db:push:local
```

#### Checking Supabase status:
```bash
npm run supabase:status
```
