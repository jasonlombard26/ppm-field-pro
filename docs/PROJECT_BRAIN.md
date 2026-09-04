# PPM Field Pro — Project Brain

> **AI/Developer Instruction: Read this file and the linked documentation before modifying PPM Field Pro. Inspect the existing implementation before making changes. Do not recreate functionality that already exists.**

## Purpose
PPM Field Pro is an Android-installable web application and desktop browser interface for technicians performing Programmed Preventative Maintenance on electronic security systems. The working application covers multiple customer sites and security disciplines including access control, intrusion, CCTV, batteries/power, PPM visits, photos and customer-system backup files.

The existing repository is the source of truth for what is implemented. Requirements in `REQUIREMENTS.md` are the desired behaviour; they must be reconciled against code before changes are made.

## Repository
GitHub: `jasonlombard26/ppm-field-pro`
Default branch: `main`

## Current technology and architecture
- Static HTML/CSS/JavaScript application; there is no conventional React/Vue/Node build system in the current repository.
- PWA/mobile entry point: `index.html`, with `manifest.webmanifest` and `service-worker.js`.
- Desktop entry point: `pc.html`.
- Both entry points reconstruct a compressed legacy/core HTML payload from `app-payload-*.txt` / `fix2*.txt`, then progressively load active versioned JavaScript modules.
- The application is offline-first. Browser state is stored in `localStorage` under `ppmV3Data` and then synchronised to Supabase when authenticated.
- Supabase JS v2 is loaded from jsDelivr. Configuration is in `supabase-config.js`.
- Mobile and desktop use the same Supabase backend and the same site-oriented data model.

## Active module loading
`index.html` currently loads the following important active overlays/modules after the compressed core payload:
- `multisite-v5.js`
- `sites-v6.js`
- `latest-notes-v7.js`
- `field-updates-v10.js`
- `lock-dropdown-v11.js`
- `site-tabs-v8.js`
- `supabase-config.js`
- `supabase-sync.js`
- `cloud-photos-v8.js`
- `photo-viewer-v9.js`
- `pc-photo-viewer-v25.js`
- `photo-display-v12.js`
- `photo-actions-v15.js`
- `record-view-v23.js`
- `pc-device-cleanup-v27.js`
- `battery-photos-v28.js`
- `battery-photo-dedupe-v30.js`
- `backups-v34.js`
- `mac-address-v32.js`
- `diagnostics-v26.js`

`pc.html` loads substantially the same stack, plus `pc-ui-v1.js`. Older versioned JavaScript files remain in the repository and must not be assumed active merely because they exist.

## Current navigation
The modernised UI is site-first.
- Main navigation hides Dashboard, Assets, Visits, Faults, Photos and History entries.
- The Sites screen is the primary working screen and contains a searchable list of sites.
- Opening a site shows site information and system tabs.
- Current site tabs are assembled by layered modules. The effective set includes Site Information, Head End, Access Control, Intrusion, CCTV, Batteries and PPM Visits. Older code also contains an Integriti Inputs tab, but `field-updates-v10.js` redirects/removes that obsolete vendor-specific UI and adds Inputs under Intrusion.
- Backups are currently rendered inside Head End rather than as a separate first-level site tab.

## Supabase architecture
See `DATABASE.md` for detail.

Current repository-defined model:
- Legacy table `public.ppm_app_state` retains one JSON state row per user for migration/recovery.
- Shared site table `public.ppm_sites` stores one site row with `site_state jsonb` containing site-scoped application data.
- `public.ppm_site_members` maps authorised users to sites using roles `admin`, `technician` or `viewer`.
- SECURITY DEFINER helper/RPC functions enforce site access and perform controlled site creation/update and access grants.
- RLS is enabled for site and membership tables.

Important: the repository contains SQL representing the intended deployed Supabase schema. A live database connection was not available during this inspection, so whether every SQL script/policy has actually been executed in the live Supabase project must be verified before schema-affecting work.

## Authentication
- Supabase Email/Password authentication.
- Browser sessions are persisted and auto-refreshed.
- Unauthenticated users are offered sign-in, sign-up, or local/offline-only operation.
- Site admins can grant existing Supabase users access to the active site by email.

## Data model in the browser/shared site JSON
The legacy/core app exposes a global `db` object with arrays such as `sites`, `assets`, `visits`, `photos` and other feature arrays. `supabase-sync.js` serialises site-scoped arrays into each `ppm_sites.site_state` JSON document according to `siteId`.

This is currently a hybrid model: relational Supabase tables are used for sites/membership/access control, while most application records remain denormalised inside `site_state jsonb`.

## Storage architecture
- Private bucket `ppm-photos` for device photos.
- Private bucket `ppm-backups` for customer system backup files.
- Storage access is site-membership-based; buckets are explicitly private.
- Device photos use site-centric paths of the form `sites/<site-id>/<section>/<record-id>/<photo-file>`.
- Current photo sections implemented by `cloud-photos-v8.js` are primarily `cctv` and `access-control`.
- Current backup path is `sites/<site-id>/head-end/backups/<backup-file>`.
- Signed URLs are used to display/open private files.

## Important implemented product decisions
- Sites-first instead of dashboard-first navigation.
- PPM visits belong to sites rather than top-level navigation.
- No separate Assets main-navigation item.
- Mobile and desktop share one Supabase backend.
- Site data can be shared between authorised users.
- Storage remains private and site-based.
- Intrusion Inputs are moving toward vendor-neutral imports rather than an Integriti-only feature.
- Access Control uses Reader In/Reader Out and no longer saves the obsolete Reader Number/Reader Type fields in the current override.
- Battery Type consolidates voltage/capacity labels into selectable values such as `12V 7Ah`, `12V 18Ah`, or custom Other.

## Current development state
The application is functional but architecturally layered. Newer requirements have frequently been implemented through successive JavaScript override modules rather than refactoring the underlying compressed core. This has preserved working behaviour but creates duplicated/obsolete code paths and increases regression risk.

Many requested features are already present. The next phase should focus on verification, hardening and consolidation rather than rebuilding the application.

## Known issues / architectural risks
- Active behaviour depends on script load order and monkey-patching global functions across many versioned files.
- The real core application is compressed/split into payload text files, making inspection and maintenance harder than a normal source tree.
- Older modules still contain obsolete field names and tabs; newer modules override them at runtime rather than removing the old implementation.
- Most operational data is stored as denormalised JSON in `ppm_sites.site_state`, limiting database-level validation, reporting and granular RLS.
- Live Supabase schema/policy deployment has not been independently verified from the repository alone.
- Passwords for CCTV equipment are stored as plaintext fields inside site JSON. Authorised display behaviour exists in UI evolution, but there is no field-level encryption documented in the current architecture.
- Backup metadata is encoded mainly into object filenames/storage metadata rather than a dedicated database table; requested metadata such as explicit backup date and technician is incomplete.
- Cloud photo support is strongest for CCTV and Access Control; the requirement calls for notes/photos for batteries and broader equipment coverage.
- A Head End area exists, but several Head End cards are placeholders and not fully structured data models.

## Outstanding work
See `TODO.md`. Highest priority themes are:
1. Verify the live Supabase project against the repository SQL and security assumptions.
2. Consolidate/normalise the active source so runtime overrides and obsolete versions do not remain the primary architecture.
3. Close remaining requirement gaps: richer backup metadata, complete photo coverage, password handling, site history/other-work data, and structured networking fields across applicable equipment.
4. Add repeatable validation/testing for both mobile and desktop flows.

## Working rules for future development
Before significant changes:
1. Read this file.
2. Inspect the relevant active implementation and confirm which loaded module owns the behaviour.
3. Read `REQUIREMENTS.md`.
4. Read `DATABASE.md` for any database/storage work.
5. Read `DECISIONS.md`.
6. Make the smallest safe change against the existing application.
7. Test/validate both mobile and desktop paths where applicable.
8. Update relevant documentation.
9. Update `TODO.md`.
10. Update `CHANGELOG.md` for meaningful changes.

Do not treat a requirement as implemented until it is verified against active code and, for backend features, the deployed Supabase environment where possible.

## Documentation index
- [Requirements](REQUIREMENTS.md)
- [Database and Storage](DATABASE.md)
- [Architectural Decisions](DECISIONS.md)
- [Development Backlog](TODO.md)
- [Changelog](CHANGELOG.md)
