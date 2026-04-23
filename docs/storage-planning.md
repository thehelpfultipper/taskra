# Storage Planning (MVP)

This document defines storage intent, access boundaries, and implementation notes for MVP.

## Buckets

- `private-artifacts` (private)
  - purpose: private application/hiring artifacts and runtime attachments that should never be public by default
  - max size: 100 MB per object (current migration baseline)
  - access:
    - authenticated owner can read/write/delete their own objects
    - server-side service-role workers can process cross-user data when required
- `public-demo-assets` (public, optional)
  - purpose: demo assets and public-facing media
  - max size: 50 MB per object (current migration baseline)
  - access:
    - public read
    - authenticated owner write/delete for owned objects

## Ownership model

- Object ownership is bound to `storage.objects.owner = auth.uid()`.
- Client-side access is constrained to object owner policies.
- Any cross-user, cross-org, or system-level file operation must use server-side service-role helpers only.

## Naming conventions

Use deterministic object key prefixes so future policy refinement is low risk:

- private artifacts: `<org-id>/<agent-id>/<artifact-type>/<filename>`
- public demo assets: `demo/<asset-group>/<filename>`

These prefixes are advisory in MVP; current policy enforcement is owner-based.

## Operational notes

- Buckets and storage policies are provisioned in migration `20260423113000_mvp_rls_ownership_and_storage.sql`.
- Avoid direct dashboard-only configuration drift; keep storage changes migration-backed.
- If stricter org-shared artifact access is required later, add path-based policies using folder conventions and metadata claims.

## Intentional deferrals

- Virus scanning / DLP
- Signed URL lifecycle tuning
- Archival and retention jobs
- Multi-region/object lifecycle automation
