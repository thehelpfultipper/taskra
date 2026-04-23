import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

type SeedRows = Record<string, unknown>[];

type SeedDataShape = {
  users: SeedRows;
  orgs: SeedRows;
  org_memberships: SeedRows;
  agents: SeedRows;
  agent_objectives: SeedRows;
  agent_state: SeedRows;
  agent_runtime_controls: SeedRows;
  jobs: SeedRows;
  follows: SeedRows;
  endorsements: SeedRows;
  posts: SeedRows;
  comments: SeedRows;
  reactions: SeedRows;
  applications: SeedRows;
  application_status_history: SeedRows;
  notifications: SeedRows;
};

type TableConfig = {
  tableName: string;
  columns: string[];
  types: string[];
  conflictTarget: string;
  updateColumns: string[];
};

const workspaceRoot = path.resolve(__dirname, "..");
const seedDataPath = path.join(workspaceRoot, "docs/backend/seed-data.ts");
const outputPath = path.join(workspaceRoot, "supabase/seed.sql");

function stripAssertions(source: string): string {
  const withoutAssertFunction = source.replace(
    /function assert\([\s\S]*?\n\}/m,
    "function assert(_condition: boolean, _message: string): void {}",
  );
  return withoutAssertFunction.replace(/^assert\(.*\);\n/gm, "");
}

async function loadSeedData(): Promise<SeedDataShape> {
  const raw = fs.readFileSync(seedDataPath, "utf8");
  const transformed = stripAssertions(raw);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlink-seed-"));
  const tempModulePath = path.join(tempDir, "seed-data-eval.ts");
  fs.writeFileSync(tempModulePath, transformed);

  const loaded = await import(pathToFileURL(tempModulePath).href);
  const seedData = (loaded.seedData ?? loaded.default?.seedData ?? loaded.default) as SeedDataShape | undefined;
  if (!seedData || !Array.isArray(seedData.orgs)) {
    throw new Error("Unable to load seedData from docs/backend/seed-data.ts");
  }
  return seedData;
}

function toJsonLiteral(rows: SeedRows): string {
  return `$seed$${JSON.stringify(rows)}$seed$::jsonb`;
}

function buildUpsertSql(rows: SeedRows, config: TableConfig): string {
  const typedColumns = config.columns.map((column, index) => `${column} ${config.types[index]}`).join(", ");
  const updateAssignments = config.updateColumns.map((column) => `${column} = excluded.${column}`).join(",\n      ");

  return [
    `with source as (`,
    `  select *`,
    `  from jsonb_to_recordset(${toJsonLiteral(rows)})`,
    `    as x(${typedColumns})`,
    `)`,
    `insert into ${config.tableName} (${config.columns.join(", ")})`,
    `select ${config.columns.join(", ")}`,
    `from source`,
    `on conflict ${config.conflictTarget} do update`,
    `set`,
    `      ${updateAssignments};`,
  ].join("\n");
}

function buildAuthUsersSql(users: SeedRows): string {
  const rows = users.map((row) => ({
    id: row.id,
    email: row.email,
    created_at: "2026-04-10T09:00:00.000Z",
    updated_at: "2026-04-10T09:00:00.000Z",
    raw_user_meta_data: { label: row.label },
  }));

  return [
    `with source as (`,
    `  select *`,
    `  from jsonb_to_recordset(${toJsonLiteral(rows)})`,
    `    as x(id uuid, email text, created_at timestamptz, updated_at timestamptz, raw_user_meta_data jsonb)`,
    `)`,
    `insert into auth.users (`,
    `  id,`,
    `  instance_id,`,
    `  aud,`,
    `  role,`,
    `  email,`,
    `  encrypted_password,`,
    `  email_confirmed_at,`,
    `  created_at,`,
    `  updated_at,`,
    `  raw_app_meta_data,`,
    `  raw_user_meta_data,`,
    `  is_sso_user,`,
    `  is_anonymous`,
    `)`,
    `select`,
    `  s.id,`,
    `  '00000000-0000-0000-0000-000000000000'::uuid as instance_id,`,
    `  'authenticated'::varchar as aud,`,
    `  'authenticated'::varchar as role,`,
    `  s.email,`,
    `  crypt('agentlink-dev-password', gen_salt('bf')) as encrypted_password,`,
    `  s.created_at as email_confirmed_at,`,
    `  s.created_at,`,
    `  s.updated_at,`,
    `  '{"provider":"email","providers":["email"]}'::jsonb as raw_app_meta_data,`,
    `  s.raw_user_meta_data,`,
    `  false as is_sso_user,`,
    `  false as is_anonymous`,
    `from source s`,
    `on conflict (id) do update`,
    `set`,
    `      email = excluded.email,`,
    `      aud = excluded.aud,`,
    `      role = excluded.role,`,
    `      email_confirmed_at = excluded.email_confirmed_at,`,
    `      updated_at = excluded.updated_at,`,
    `      raw_app_meta_data = excluded.raw_app_meta_data,`,
    `      raw_user_meta_data = excluded.raw_user_meta_data,`,
    `      is_sso_user = excluded.is_sso_user,`,
    `      is_anonymous = excluded.is_anonymous;`,
  ].join("\n");
}

function buildAuthIdentitiesSql(users: SeedRows): string {
  const rows = users.map((row) => ({
    id: row.id,
    user_id: row.id,
    provider_id: row.id,
    provider: "email",
    identity_data: {
      sub: row.id,
      email: row.email,
    },
    created_at: "2026-04-10T09:00:00.000Z",
    updated_at: "2026-04-10T09:00:00.000Z",
  }));

  return [
    `with source as (`,
    `  select *`,
    `  from jsonb_to_recordset(${toJsonLiteral(rows)})`,
    `    as x(`,
    `      id uuid,`,
    `      user_id uuid,`,
    `      provider_id text,`,
    `      provider text,`,
    `      identity_data jsonb,`,
    `      created_at timestamptz,`,
    `      updated_at timestamptz`,
    `    )`,
    `)`,
    `insert into auth.identities (`,
    `  id,`,
    `  user_id,`,
    `  provider_id,`,
    `  provider,`,
    `  identity_data,`,
    `  last_sign_in_at,`,
    `  created_at,`,
    `  updated_at`,
    `)`,
    `select`,
    `  s.id,`,
    `  s.user_id,`,
    `  s.provider_id,`,
    `  s.provider,`,
    `  s.identity_data,`,
    `  s.created_at as last_sign_in_at,`,
    `  s.created_at,`,
    `  s.updated_at`,
    `from source s`,
    `on conflict (id) do update`,
    `set`,
    `      user_id = excluded.user_id,`,
    `      provider_id = excluded.provider_id,`,
    `      provider = excluded.provider,`,
    `      identity_data = excluded.identity_data,`,
    `      last_sign_in_at = excluded.last_sign_in_at,`,
    `      updated_at = excluded.updated_at;`,
  ].join("\n");
}

function buildAgentCredibilitySql(): string {
  return [
    `insert into public.agent_credibility (agent_id)`,
    `select a.id`,
    `from public.agents a`,
    `on conflict (agent_id) do nothing;`,
  ].join("\n");
}

function makeDeterministicUuid(prefixHex: string, index: number): string {
  return `${prefixHex}-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function normalizeIdRows(rows: SeedRows, prefixHex: string): SeedRows {
  return rows.map((row, index) => ({
    ...row,
    id: makeDeterministicUuid(prefixHex, index),
  }));
}

async function main(): Promise<void> {
  const seedData = await loadSeedData();

  const orgs = seedData.orgs;
  const agents = seedData.agents;
  const jobs = seedData.jobs.map(({ slug: _slug, ...rest }) => rest);
  const relationshipsOrgMemberships = normalizeIdRows(seedData.org_memberships, "81000000");
  const relationshipsFollows = normalizeIdRows(seedData.follows, "82000000");
  const relationshipsEndorsements = normalizeIdRows(seedData.endorsements, "83000000");
  const posts = seedData.posts;
  const comments = seedData.comments;
  const reactions = seedData.reactions;
  const applications = seedData.applications;
  const applicationStatusHistory = normalizeIdRows(seedData.application_status_history, "85000000");
  const notifications = seedData.notifications;
  const runtimeAgentObjectives = normalizeIdRows(seedData.agent_objectives, "84000000");
  const runtimeAgentState = seedData.agent_state;
  const runtimeAgentRuntimeControls = seedData.agent_runtime_controls;

  const sections: string[] = [];
  sections.push("-- Seed data for AgentLink MVP.");
  sections.push("-- Generated from docs/backend/seed-data.ts via scripts/generate-supabase-seed-sql.ts.");
  sections.push("-- Idempotent: safe to re-run in development.");
  sections.push("");
  sections.push("begin;");
  sections.push("");
  sections.push("-- Required auth users (foreign keys from public.* tables).");
  sections.push(buildAuthUsersSql(seedData.users));
  sections.push("");
  sections.push("-- Back auth users with email identities for local auth flows.");
  sections.push(buildAuthIdentitiesSql(seedData.users));
  sections.push("");
  sections.push("-- 1) orgs");
  sections.push(
    buildUpsertSql(orgs, {
      tableName: "public.orgs",
      columns: ["id", "slug", "name", "created_by_user_id", "created_at"],
      types: ["uuid", "text", "text", "uuid", "timestamptz"],
      conflictTarget: "(id)",
      updateColumns: ["slug", "name", "created_by_user_id", "created_at"],
    }),
  );
  sections.push("");
  sections.push("-- 2) agents");
  sections.push(
    buildUpsertSql(agents, {
      tableName: "public.agents",
      columns: ["id", "handle", "display_name", "bio", "owner_user_id", "primary_org_id", "created_at"],
      types: ["uuid", "text", "text", "text", "uuid", "uuid", "timestamptz"],
      conflictTarget: "(id)",
      updateColumns: ["handle", "display_name", "bio", "owner_user_id", "primary_org_id", "created_at"],
    }),
  );
  sections.push("");
  sections.push("-- 3) jobs");
  sections.push(
    buildUpsertSql(jobs, {
      tableName: "public.jobs",
      columns: [
        "id",
        "org_id",
        "created_by_user_id",
        "title",
        "description",
        "location_type",
        "status",
        "closes_at",
        "created_at",
      ],
      types: ["uuid", "uuid", "uuid", "text", "text", "text", "text", "timestamptz", "timestamptz"],
      conflictTarget: "(id)",
      updateColumns: [
        "org_id",
        "created_by_user_id",
        "title",
        "description",
        "location_type",
        "status",
        "closes_at",
        "created_at",
      ],
    }),
  );
  sections.push("");
  sections.push("-- 4) relationships");
  sections.push(
    buildUpsertSql(relationshipsOrgMemberships, {
      tableName: "public.org_memberships",
      columns: ["id", "org_id", "user_id", "role", "status", "joined_at", "created_at"],
      types: ["uuid", "uuid", "uuid", "text", "text", "timestamptz", "timestamptz"],
      conflictTarget: "(id)",
      updateColumns: ["org_id", "user_id", "role", "status", "joined_at", "created_at"],
    }),
  );
  sections.push("");
  sections.push(
    buildUpsertSql(relationshipsFollows, {
      tableName: "public.follows",
      columns: ["id", "follower_agent_id", "followed_agent_id", "followed_org_id", "created_at"],
      types: ["uuid", "uuid", "uuid", "uuid", "timestamptz"],
      conflictTarget: "(id)",
      updateColumns: ["follower_agent_id", "followed_agent_id", "followed_org_id", "created_at"],
    }),
  );
  sections.push("");
  sections.push(
    buildUpsertSql(relationshipsEndorsements, {
      tableName: "public.endorsements",
      columns: ["id", "endorser_agent_id", "endorsed_agent_id", "skill_key", "note", "created_at"],
      types: ["uuid", "uuid", "uuid", "text", "text", "timestamptz"],
      conflictTarget: "(id)",
      updateColumns: ["endorser_agent_id", "endorsed_agent_id", "skill_key", "note", "created_at"],
    }),
  );
  sections.push("");
  sections.push("-- 5) posts/comments/reactions");
  sections.push(
    buildUpsertSql(posts, {
      tableName: "public.posts",
      columns: ["id", "author_agent_id", "org_id", "body", "visibility", "created_at"],
      types: ["uuid", "uuid", "uuid", "text", "text", "timestamptz"],
      conflictTarget: "(id)",
      updateColumns: ["author_agent_id", "org_id", "body", "visibility", "created_at"],
    }),
  );
  sections.push("");
  sections.push(
    buildUpsertSql(comments, {
      tableName: "public.comments",
      columns: ["id", "post_id", "parent_comment_id", "author_agent_id", "body", "created_at"],
      types: ["uuid", "uuid", "uuid", "uuid", "text", "timestamptz"],
      conflictTarget: "(id)",
      updateColumns: ["post_id", "parent_comment_id", "author_agent_id", "body", "created_at"],
    }),
  );
  sections.push("");
  sections.push(
    buildUpsertSql(reactions, {
      tableName: "public.reactions",
      columns: ["id", "actor_agent_id", "post_id", "comment_id", "reaction_type", "created_at"],
      types: ["uuid", "uuid", "uuid", "uuid", "text", "timestamptz"],
      conflictTarget: "(id)",
      updateColumns: ["actor_agent_id", "post_id", "comment_id", "reaction_type", "created_at"],
    }),
  );
  sections.push("");
  sections.push("-- 6) applications");
  sections.push(
    buildUpsertSql(applications, {
      tableName: "public.applications",
      columns: ["id", "job_id", "applicant_agent_id", "submitted_by_user_id", "cover_note", "current_status", "created_at", "updated_at"],
      types: ["uuid", "uuid", "uuid", "uuid", "text", "text", "timestamptz", "timestamptz"],
      conflictTarget: "(id)",
      updateColumns: ["job_id", "applicant_agent_id", "submitted_by_user_id", "cover_note", "current_status", "created_at", "updated_at"],
    }),
  );
  sections.push("");
  sections.push(
    buildUpsertSql(applicationStatusHistory, {
      tableName: "public.application_status_history",
      columns: ["id", "application_id", "from_status", "to_status", "changed_by_user_id", "changed_by_source", "note", "created_at"],
      types: ["uuid", "uuid", "text", "text", "uuid", "text", "text", "timestamptz"],
      conflictTarget: "(id)",
      updateColumns: ["application_id", "from_status", "to_status", "changed_by_user_id", "changed_by_source", "note", "created_at"],
    }),
  );
  sections.push("");
  sections.push("-- 7) notifications");
  sections.push(
    buildUpsertSql(notifications, {
      tableName: "public.notifications",
      columns: ["id", "recipient_user_id", "actor_agent_id", "event_type", "subject_type", "subject_id", "payload", "read_at", "created_at"],
      types: ["uuid", "uuid", "uuid", "text", "text", "uuid", "jsonb", "timestamptz", "timestamptz"],
      conflictTarget: "(id)",
      updateColumns: ["recipient_user_id", "actor_agent_id", "event_type", "subject_type", "subject_id", "payload", "read_at", "created_at"],
    }),
  );
  sections.push("");
  sections.push("-- 8) runtime state");
  sections.push(
    buildUpsertSql(runtimeAgentObjectives, {
      tableName: "public.agent_objectives",
      columns: ["id", "agent_id", "objective_type", "summary", "priority", "status", "created_by_user_id", "created_by_source", "created_at"],
      types: ["uuid", "uuid", "text", "text", "smallint", "text", "uuid", "text", "timestamptz"],
      conflictTarget: "(id)",
      updateColumns: ["agent_id", "objective_type", "summary", "priority", "status", "created_by_user_id", "created_by_source", "created_at"],
    }),
  );
  sections.push("");
  sections.push(
    buildUpsertSql(runtimeAgentState, {
      tableName: "public.agent_state",
      columns: ["agent_id", "lifecycle_status", "last_seen_at", "last_decision_at", "state_payload", "updated_at"],
      types: ["uuid", "text", "timestamptz", "timestamptz", "jsonb", "timestamptz"],
      conflictTarget: "(agent_id)",
      updateColumns: ["lifecycle_status", "last_seen_at", "last_decision_at", "state_payload", "updated_at"],
    }),
  );
  sections.push("");
  sections.push(
    buildUpsertSql(runtimeAgentRuntimeControls, {
      tableName: "public.agent_runtime_controls",
      columns: [
        "agent_id",
        "is_disabled",
        "cooldown_until",
        "max_posts_per_day",
        "max_applies_per_day",
        "notes",
        "updated_by_user_id",
        "created_at",
        "updated_at",
      ],
      types: ["uuid", "boolean", "timestamptz", "smallint", "smallint", "text", "uuid", "timestamptz", "timestamptz"],
      conflictTarget: "(agent_id)",
      updateColumns: [
        "is_disabled",
        "cooldown_until",
        "max_posts_per_day",
        "max_applies_per_day",
        "notes",
        "updated_by_user_id",
        "created_at",
        "updated_at",
      ],
    }),
  );
  sections.push("");
  sections.push("-- Keep credibility rows aligned with seeded agents.");
  sections.push(buildAgentCredibilitySql());
  sections.push("");
  sections.push("commit;");
  sections.push("");

  fs.writeFileSync(outputPath, `${sections.join("\n")}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
