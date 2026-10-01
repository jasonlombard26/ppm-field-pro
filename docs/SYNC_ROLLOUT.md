# Safe sync and backup permissions: review and rollout

**Status: local review patch, not deployed.** Based on main `c4be793c94c0c1c6ff6e349d2e1af0754b5c09fe`.

## Behavior changes to review

- Shared site JSON is still the storage model. Saves use `ppm_save_site_state(..., p_expected_revision)` and return a monotonically increasing revision. An existing site's full JSON is only replaced when the supplied revision still matches. NULL means create a new ID, never overwrite.
- Old `ppm_upsert_site_state` clients fail closed with an upgrade-required error. Direct table INSERT/UPDATE is denied. Do not roll back to the unversioned writer.
- **Physical site deletion is disabled**, including for admins, until a controlled lifecycle/tombstone design can preserve storage ownership. Deleting a site only in the old UI is not a server deletion; Account displays a local-deletion issue and offers the cloud copy. Existing IDs cannot be claimed while any private PPM photo/backup objects remain at that site's path. This prevents historical orphaned-file takeover.
- Only changed, editable sites are saved. Viewer, denied, conflicted, and unavailable sites cannot block unrelated editable saves.
- Reconnection reads revisions/roles first, preserves local edits, and uploads only when the saved baseline is current. It never blindly reloads over dirty data. Concurrent edits produce a visible conflict, even if the edited fields differ. There is no automatic field merge.
- Account offers a plaintext recovery export and explicit per-site resolution. “Replace cloud with local copy” intentionally replaces the reviewed version of the entire site; another intervening write is rejected. “Use cloud copy” deliberately discards that site's active local edits after confirmation. Review/export before choosing.
- Sites no longer returned by the server disappear from active views. Pending data and local photos move into recovery metadata; they are not recreated. Restored access can restore pending data or expose a conflict. Server-side access removal cannot erase offline data that a browser already received.
- Pre-upgrade/unassigned local sites have no trustworthy version history. They require explicit review/approval before new-site creation. Matching local/cloud state can safely establish a baseline.
- Legacy `ppm_app_state` remains untouched. Account offers export when a legacy row exists, including partially migrated accounts. An empty, untracked device can explicitly restore it locally for review; each new shared site still needs approval. Existing active/recovery sites require manual review rather than a destructive merge.
- Signing out archives the account cache before clearing active records and reloads the page to dispose of dialogs, async photo requests, and signed-URL caches. A matching sign-in restores the account archive. New unassigned offline work is preserved separately and can be exported from Account when an existing account archive is restored.
- **Logout is not secure erasure.** Active, archived, unassigned, legacy and exported recovery data are plaintext. A person with browser profile/device access can inspect them. Never use this as a credentials vault or rely on it for a shared/untrusted device.
- New clients acquire a Web Lock before loading application code. Only one tab/PWA per origin can edit its offline cache. Unsupported browsers or a second tab show a blocked-startup message. This does not lock out an already-open old client that lacks the protocol.
- A local write-ahead recovery record pairs cache and journal changes. It replays before the app starts if a write is interrupted. A quota/storage error freezes editing and sync; late callbacks cannot overwrite the recovery record. Free space and reload; do not clear browser data. Recovery exports are offered only for the matching signed-in owner or unassigned data.
- Technicians may create/read new backup files. Only site admins may overwrite, move or delete backups. Technicians retain photo editing/deletion. Both Storage scripts install the same policies, including restrictive backup guards.

## Required cutover order

Do not execute this checklist without deployment approval. Use a staging/test Supabase project first.

1. Export a recovery copy from every device with unconfirmed work. Record accounts/site roles. Take an operator-controlled database/storage backup using an approved procedure.
2. **Close every old PPM browser tab and installed PWA on every device.** An old tab does not participate in the new Web Lock and can still overwrite local cache keys. Do not mix old and new tabs.
3. Review existing `pg_policies`, grants, functions and storage objects. Unknown permissive policies, inherited role grants and service-role/admin access require separate review. Restrictive backup guards cover authenticated backup UPDATE/DELETE even when another permissive grant exists, but they are not a general audit of arbitrary custom policies.
4. For a fresh Supabase project run `setup.sql`; retain this legacy table on existing projects. Supabase's platform-provided `storage.objects` must exist.
5. Run the revised `shared-site-model.sql` in one transaction. Existing `site_state` is retained and receives revision 1; rerunning does not reset revisions. It installs the CAS writer, disables the old writer/direct mutation/deletion, and guards IDs with old files. Keep legacy recovery rows.
6. Run the revised `storage-policies.sql` and `security-hardening.sql` in transactions. After the shared model is upgraded, these two files may be reapplied in either order without broadening backup permissions. Do not mix an old script revision into the set. They make the buckets private; hardening also sets size/MIME limits.
7. Verify explicit least-privilege table/function grants. The scripts do not depend on automatic grants for newly created `ppm_sites`/`ppm_site_members` tables. No new production tables are introduced by this patch.
8. Deploy `index.html`, `pc.html`, `sync-core.js`, `sync-bootstrap.js`, and `supabase-sync.js` together. The script query versions are updated. A new frontend against the old schema reports an upgrade requirement and retains local changes; an old frontend against the new schema cannot save. There is intentionally no unsafe write fallback.
9. Reopen current browser/PWA versions, sign in, export/review conflicts and unconfirmed local sites, then execute the complete staging role/device matrix before production approval.

**Rollback:** preserve upgraded data, revisions and restrictive policies. Fix the new frontend forward or keep writes paused. Reinstalling the old whole-site writer, restoring broad grants, or clearing browser storage is not a safe rollback. Recover/export pending local data before any operator repair.

## Automated local checks

All fixtures use synthetic data. No test calls the live Supabase service.

Use Node 20+:

```sh
npm ci --ignore-scripts
npm test
npx playwright install chromium
npm run test:browser
```

A system Chromium can be used with `CHROMIUM_PATH=/path/to/chromium npm run test:browser`. Do not bypass executor security restrictions to launch it.

- Core tests exercise dirty baselines, reconnect, stale revisions, lost acknowledgements, in-flight edits, role isolation, access loss/restoration, preserved photos, explicit choices, new-creation retries, and unsupported metadata.
- Storage fault-injection tests interrupt every write stage, including revoked-data recovery and interrupted replay.
- DOM integration uses LinkeDOM plus a mocked Supabase client. It exercises UI actions, RPC queues, identity changes during startup, account archives, quota failure, legacy recovery and late-write freeze. It does not exercise actual browser layout, Web Locks, auth networking or Supabase JS.
- SQL tests execute PostgreSQL semantics via PGlite. They exercise revision CAS, permissions, transactional creation, orphan-path guards, repeatability, RLS, backup upsert/move/delete and permissive-policy bypass resistance. PGlite is single-connection; queued contenders do not prove truly overlapping database sessions.
- Loader checks parse both inline entrypoint scripts and verify core/bootstrap ordering, lock gate and script versions.
- Chromium fixtures are supplied separately. In the review executor Chromium could not initialize required local sockets (`Operation not permitted`), including the approved escalation attempt. **No Chromium assertions ran.** This is not a passing browser test.

Optional test dependencies are explicitly skipped if absent; a run with skips is not full coverage. The recorded review run installed all dependencies required by `npm test` and reported no skips.

## Remaining release gates and risks

- Run actual Android/desktop startup, offline reopening, photo/backup flows and login/logout with this full layered app. The service worker currently unregisters itself; this patch does not guarantee offline app-shell availability.
- Run true two-client simultaneous saves and auth/permission changes against staging PostgreSQL/Supabase, including the installed Supabase JS version. Verify membership snapshots and post-response failures.
- Test browser quota failures, cache replay, two-tab/Web Lock behavior, screenshots/layout, repeated clicks and same/different-account transitions in real supported browsers.
- Run admin/technician/viewer/outsider/anonymous direct-table, RPC and Storage checks against the actual deployed policies. Inventory any orphaned storage paths; do not delete them blindly.
- Review site-deletion UI expectations and adopt a controlled lifecycle before re-enabling physical site deletion. All trusted/operator workflows must honor that lifecycle; database owners/service-role clients can bypass user grants.
- Unsafe numeric API revisions fail closed rather than rounding a version; decimal-string revisions remain exact. Numeric site IDs remain constrained by the browser's existing JavaScript safe-integer model. RPC accepts bigint; foreign/malformed/unsupported IDs fail closed in the client. A future identifier migration is separate work.
- Records, photos and backups are not one atomic cross-service transaction. This patch does not add an offline upload queue, storage rollback, encrypted local database or field-level merge.
- Historical source exposure and plaintext customer/device passwords are not repaired by these changes. Rotate exposed credentials through approved owner-controlled flows; address repository history/visibility and secret storage separately. No credentials were rotated, history rewritten, or repository visibility changed in this review.
