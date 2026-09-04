# PPM Field Pro — Database and Storage

This document distinguishes repository-defined/current implementation from proposed work. It was created from the existing application code and SQL in the repository on 2026-09-04.

## Important verification note
The repository contains the SQL and client code that define the intended Supabase implementation. During this inspection there was no direct live Supabase database connection available, so it is **not possible to prove from GitHub alone that every table, policy, RPC and bucket below has been executed/deployed exactly as written**. Treat repository-defined items as implemented in code but verify the live Supabase project before destructive or schema-dependent changes.

## Currently implemented — client/backend integration
Both `index.html` and `pc.html` load Supabase JS v2, `supabase-config.js` and `supabase-sync.js`.

The client:
- Creates a Supabase client with persisted auth sessions, token refresh and URL session detection.
- Supports Email/Password sign-in and sign-up.
- Allows offline-only use if the user is not signed in.
- Uses browser `localStorage` key `ppmV3Data` for offline-first state.
- Pushes site-scoped state to Supabase after local saves.
- Loads all sites the signed-in user can access.
- Preserves local photo cache separately from site JSON while shared photos are discovered via Storage.

## Currently implemented — legacy table
Source: `supabase/setup.sql`

### `public.ppm_app_state`
Purpose: original per-user JSON state retained for safe migration/recovery.

Columns:
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `state jsonb not null default '{}'::jsonb`
- `updated_at timestamptz not null default now()`
- unique constraint on `user_id`

RLS: enabled.

Policies:
- select own row when `auth.uid() = user_id`
- insert own row
- update own row
- delete own row

This table is deliberately retained by the shared-site migration. Do not remove it without a migration/recovery plan.

## Currently implemented — shared site model
Source: `supabase/shared-site-model.sql`

### `public.ppm_sites`
Columns:
- `id bigint primary key`
- `name text not null default ''`
- `site_state jsonb not null default '{}'::jsonb`
- `created_by uuid references auth.users(id) on delete set null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Purpose: one shared row per PPM site. Most feature data is currently serialised inside `site_state` rather than normalised into separate tables.

### `public.ppm_site_members`
Columns:
- `site_id bigint not null references public.ppm_sites(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `role text not null default 'technician'`
- `created_at timestamptz not null default now()`
- composite primary key `(site_id, user_id)`

Allowed roles:
- `admin`
- `technician`
- `viewer`

Indexes:
- `ppm_site_members_user_id_idx`
- `ppm_sites_updated_at_idx`

## Currently implemented — helper functions/RPCs
### `public.ppm_user_has_site_access(bigint)`
Returns true when the authenticated user is a member of the site.

### `public.ppm_user_can_edit_site(bigint)`
Returns true for site members with role `admin` or `technician`.

### `public.ppm_user_is_site_admin(bigint)`
Returns true only for site admins.

### `public.ppm_upsert_site_state(bigint,text,jsonb)`
SECURITY DEFINER RPC used by the client to create or update a site. On first creation, it inserts the current user as site admin. Existing sites require edit access.

### `public.ppm_grant_site_access(bigint,text,text)`
SECURITY DEFINER RPC used by site admins to grant/update another existing Supabase user's membership by email.

Function execution is revoked from `public` and granted to `authenticated` in the repository SQL.

## Currently implemented — RLS policies
### `ppm_sites`
- Select: authenticated user must have site access.
- Insert: no direct insert policy; creation is expected through `ppm_upsert_site_state`.
- Update: admin or technician via `ppm_user_can_edit_site`.
- Delete: admin only.

### `ppm_site_members`
- Select: user can read their own membership; admins can read memberships for sites they administer.
- Insert: no direct insert policy; membership creation is expected through controlled SECURITY DEFINER RPCs.
- Update: site admin only.
- Delete: site admin only.

## Currently implemented — application state shape
The browser exposes a global `db` object. Exact keys originate from the compressed core and active overlays, but verified arrays include:
- `sites`
- `assets`
- `visits`
- `photos`

Other arrays may also be present in the core. `supabase-sync.js` serialises any array containing `siteId` into the corresponding site's `site_state` JSON. `sites` and `photos` receive special handling.

For each site, `stateForSite(site)` writes:
- `site`: the site object itself
- each relevant site-scoped array filtered to the matching `siteId`

This design means operational entities such as cameras, doors, batteries and intrusion inputs are currently records inside JSON arrays rather than dedicated SQL tables.

## Currently implemented — Authentication assumptions
- Supabase Email provider is enabled.
- Users authenticate with email/password.
- New accounts may require email confirmation depending on Supabase project settings.
- The browser uses a publishable/anon client key from `supabase-config.js`; access control is expected to be enforced by RLS and Storage policies, not by keeping the client key secret.
- Users must already exist in Supabase Auth before an admin can grant them site membership by email.

## Currently implemented — Storage buckets
Source: `supabase/storage-policies.sql`

### `ppm-photos`
Configured with `public=false`.

### `ppm-backups`
Configured with `public=false`.

## Currently implemented — Storage path conventions
### Device photos
`cloud-photos-v8.js` uses:

`sites/<site-id>/<section>/<asset-id>/<photo-file>`

Current section mapping:
- CCTV -> `cctv`
- non-CCTV photo-capable access records -> `access-control`

Files include a timestamp and encoded label/name components.

### Backups
`backups-v34.js` uses:

`sites/<site-id>/head-end/backups/<backup-file>`

The generated filename contains timestamp, backup system/type and a description-derived component.

## Currently implemented — Storage policies
Policies apply to `storage.objects` for both `ppm-photos` and `ppm-backups`.

Common checks:
- object path must begin with `sites`
- second folder component must be numeric and is treated as the site ID
- read requires `ppm_user_has_site_access(site_id)`
- insert/update/delete require `ppm_user_can_edit_site(site_id)`

This allows any authorised site member to read files for that site regardless of who uploaded them, while admins/technicians can write. Buckets remain private.

## Currently implemented — Private file access
The client creates signed URLs:
- Photos: generally 1 hour, cached client-side for roughly 50 minutes.
- Backups: 15 minutes.

No requirement is satisfied by public bucket URLs; the intended implementation is authenticated/signed access.

## Migrations / SQL order
Repository instructions specify:
1. `supabase/setup.sql`
2. `supabase/shared-site-model.sql`
3. `supabase/storage-policies.sql`

The shared model is intentionally additive and does not delete the legacy `ppm_app_state` table.

## Proposed / not yet fully implemented
The following should **not** be described as current schema:
- Dedicated relational tables for access doors/controllers, CCTV cameras, intrusion inputs, batteries, visits, maintenance history, backups or photos.
- Dedicated backup metadata table with backup date, uploader/technician, description and original filename columns.
- Dedicated network-device table or reusable structured network-address object.
- Field-level encryption/vaulting for CCTV/device passwords.
- Full cloud-photo coverage for every equipment section using a uniform section strategy.
- Audit/history tables for changes to site records.

## Recommended next database work
Before adding new tables, first verify the live Supabase project against these SQL files and export/document the actual deployed schema/policies. Then decide whether to incrementally normalise high-value entities (especially backups, visits/history and networked devices) while preserving compatibility with the current `site_state` JSON model.
