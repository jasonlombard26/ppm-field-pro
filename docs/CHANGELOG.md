# PPM Field Pro — Changelog


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
