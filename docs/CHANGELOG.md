# PPM Field Pro — Changelog

## 2026-10-05 - Original-report calibration, not deployed
- Read the six user-authorized originals without source writes or persisted customer imports.
- Added verified equipment-description/physical-location aliases and rejected placeholder identities; surfaced incomplete-row warnings.
- Checked real XLS/XLSX mappings and PDF extraction, then passed 156 automated regressions. No browser or live-sync claim.

## 2026-10-05 - Local importer checkpoint, not deployed
- Added bounded local XLS/XLSX parsing, configuration preview, selective confirmed apply, idempotent source identities and conflict blocking.
- Vendored approved SheetJS CE 0.20.3 and matching PDF.js 6.4.299 legacy library/worker with licenses and integrity manifest.
- PDF text extraction is review-only; Gallagher mapping, browser workers and live/device sync remain unverified. See [review](IMPORTER_REVIEW.md).


## 2026-10-05 — H3C-QLD-2202 local feature branch, not deployed
- Added flexible input module type/number and Contact ID reporting code.
- Added shared head-end asset applicability, explicit existing-record adoption, per-system terminology and backup references.
- Extended multi-photo access to every asset category on mobile and desktop with local pending uploads and permission/cache safeguards.
- Added synthetic regression coverage; see [feature review](H3C-QLD-2202.md). Customer-report importer remains separate and incomplete.


## 2026-10-01 — Local safety review patch, not deployed
- Added revision-checked whole-site writes and fail-closed legacy compatibility.
- Preserved pending offline edits, role-aware independent saves, explicit conflict/legacy recovery, owner-scoped logout caches and crash-replay safeguards.
- Added single-tab cache locking before application startup; old tabs must be closed during cutover.
- Made backup overwrite/move/delete admin-only and policy reapplication order-independent.
- Disabled physical site deletion pending a safe lifecycle and rejected new IDs with existing Storage files.
- Added core, fault-injection, mocked-DOM, PostgreSQL/WASM and loader regression checks. Chromium fixtures remain unrun in the review executor because browser local sockets are blocked.
- See `SYNC_ROLLOUT.md` for rollout and unverified live/device release gates.


## 2026-09-16
### Intrusion
- Added a site-scoped Devices section under Intrusion.
- Intrusion device records support Input Number, Device Type, Location and Area.
- Records use the existing asset JSON and shared Supabase site-state sync; no database migration is required.
- Added Intrusion Device photo upload, thumbnails, viewer/actions and private cloud discovery using `sites/<site-id>/intrusion/<device-id>/<photo-file>`.

## 2026-09-08
### Stability / Verification
- Added a JavaScript-packaged core payload and changed mobile/desktop startup to avoid fragile hidden-iframe payload reads.
- Fixed clean-start crashes when no site exists yet, allowing a new account to reach site creation.
- Added the Phase 1 Android ↔ PC synchronisation verification checklist.
- Recorded confirmed source-audit risks around reconnect order, whole-site last-write-wins updates, viewer writes, deletion/access reconciliation and error reporting.
- No product features were added.

## 2026-09-04 — Phase 1 security hardening (draft)
- Added `SECURITY.md` with production handling, disclosure and deployment requirements.
- Added an additive Supabase hardening script that reasserts least privilege, keeps Storage private, limits photo uploads, and restricts backup deletion to site admins.
- Escaped account/site values before inserting them into authentication/account HTML.
- Added weekly and pull-request CodeQL scanning for active JavaScript.
- Identified repository visibility and plaintext equipment passwords as unresolved critical risks; these require deployment/product decisions before production credentials are safe.

This changelog records meaningful application, architecture, database, Supabase, storage, feature and bug-fix changes from the Project Brain baseline onward. Do not add trivial formatting-only edits.

## 2026-09-04
### Documentation / Architecture
- Established the `/docs` Project Brain documentation set.
- Documented the existing static PWA/desktop architecture, active module-loading approach and Supabase integration.
- Reconciled current implementation against the stated PPM Field Pro requirements.
- Documented current repository-defined Supabase tables, RLS, RPCs, private Storage buckets and site-based file paths.
- Added architectural decisions and a prioritised development backlog.
- Made live Supabase verification and Android ↔ PC synchronisation a formal Phase 1 release gate.
- Defined Phase 2 architecture stabilisation and paused major feature work until both gates pass.

### Application changes
- No major application functionality was changed in this pass. The repository was inspected and documented only, as requested.
