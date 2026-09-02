# PPM Field Pro

Android-installable PWA and desktop interface for programmed preventative maintenance of electronic security systems.

The app supports multiple sites. Lombard Building is an initial site record, not the application itself.

## Supabase cloud sync

PPM Field Pro uses an offline-first browser cache with a shared Supabase backend.

### One-time database setup

For a new Supabase project:

1. Open the Supabase project dashboard.
2. Open **SQL Editor**.
3. Run `supabase/setup.sql` to retain the original/legacy app-state table used for safe migration.
4. Run `supabase/shared-site-model.sql` to create the shared site and membership model.
5. Run `supabase/storage-policies.sql` to create/secure the private photo and backup buckets with site-aware policies.
6. In **Authentication > Providers**, leave Email enabled.
7. If email confirmation is enabled, new users must confirm their email before signing in.

For an existing PPM Field Pro Supabase project, do not delete `ppm_app_state`. Run `shared-site-model.sql` and then `storage-policies.sql`. On first sign-in after the update, the app can migrate the signed-in user's existing legacy state into shared site records without deleting the legacy row.

The browser uses the public publishable key in `supabase-config.js`. Database and Storage access are enforced by Row Level Security and site membership.

### Shared site access

Each site is stored in `ppm_sites` and authorised users are stored in `ppm_site_members` with `admin`, `technician`, or `viewer` roles.

Site admins can open **Account** in the app and grant access to the active site using another technician's existing Supabase account email.

- Admin: can edit the site and grant/manage access.
- Technician: can read and edit shared site data and files.
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

Only users who are members of the matching site can read those files. Admins and technicians can upload/update/delete them.
