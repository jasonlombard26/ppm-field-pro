# PPM Field Pro

Android-installable PWA and desktop interface for programmed preventative maintenance of electronic security systems.

The app supports multiple sites. the imported example site is an initial site record, not the application itself.

## Supabase cloud sync

PPM Field Pro uses an offline-first browser cache with a shared Supabase backend.

### One-time database setup

For a new Supabase project:

1. Open the Supabase project dashboard.
2. Open **SQL Editor**.
3. Run `supabase/setup.sql` to retain the original/legacy app-state table used for safe migration.
4. Run `supabase/shared-site-model.sql` to create the shared site and membership model.
5. Run `supabase/storage-policies.sql` to create/secure the private photo and backup buckets with site-aware policies.
6. Run `supabase/security-hardening.sql` to reassert grants, private bucket limits and backup protections.
7. In **Authentication > Providers**, leave Email enabled.
8. If email confirmation is enabled, new users must confirm their email before signing in.

For an existing project, keep `ppm_app_state`. Follow [the reviewed rollout and compatibility checklist](docs/SYNC_ROLLOUT.md), including local exports and closing all old tabs/PWAs. Upgrade the revised shared model before deploying the revised frontend. Old clients fail closed; there is no unversioned-write fallback. Legacy data is available through Account for explicit recovery/export rather than automatic publication.

**Physical site deletion is disabled pending a safe lifecycle.** Local deletion is not a server deletion. Shared saves now require an expected revision; conflicts require review. Sign-out preserves an owner-scoped plaintext recovery cache, so it is not secure erasure.

The browser uses the public publishable key in `supabase-config.js`. Database and Storage access are enforced by Row Level Security and site membership.

### Shared site access

Each site is stored in `ppm_sites` and authorised users are stored in `ppm_site_members` with `admin`, `technician`, or `viewer` roles.

Site admins can open **Account** in the app and grant access to the active site using another technician's existing Supabase account email.

- Admin: can edit the site and grant/manage access.
- Technician: can edit shared site data/photos and upload/read new backups. Backup overwrite/deletion is admin-only.
- Viewer: can read shared site data and files.

### Photos and backups

Storage buckets remain private.

Site photos use the `ppm-photos` bucket and site backups use `ppm-backups`.

Paths are site-centric and begin with:

`sites/<site-id>/...`

Device photos continue to use paths such as:

`sites/<site-id>/<section>/<record-id>/<photo-id>`

Head End backup files are stored under:

`sites/<site-id>/head-end/backups/<backup-file>`

Only site members can read these files. Admins and technicians can create files and update/delete photos. Only site admins can update, move or delete backups. New site IDs with existing PPM Storage files cannot be claimed.

## Local regression tests

Run `npm ci --ignore-scripts`, then `npm test`. Browser tests are separate: `npm run test:browser` with an installed Chromium. See [test evidence and unverified release gates](docs/SYNC_ROLLOUT.md).
