# PPM Field Pro — Supabase and Android ↔ PC Verification

This is the Phase 1 release-gate checklist. Do not resume major feature development until the critical tests pass and defects are recorded.

## Safety rules
- Use a dedicated test site, for example `SYNC TEST — DO NOT USE`.
- Do not test deletion, access removal or conflict handling against real customer data.
- Before starting, export a local backup from each device if it contains information not yet confirmed in Supabase.
- Record the exact Android browser/PWA version, PC browser version, account email/role, time and result.

## Current source-audit findings
| ID | Severity | Finding | Required result |
|---|---|---|---|
| SYNC-01 | Critical | Reconnect loads cloud before pushing local changes. Offline edits may be overwritten. | No silent loss; use an explicit merge/conflict strategy. |
| SYNC-02 | Critical | Each update replaces the complete site JSON with no expected-version check. | A stale device must not silently overwrite a newer revision. |
| SYNC-03 | High | Saving loops through every local site and can stop on a viewer-only site. | Viewer sessions stay read-only without blocking unrelated editable sites. |
| SYNC-04 | High | Missing/revoked remote sites are retained locally and deletion is not synchronised. | Deletion and access removal have explicit, safe behaviour. |
| SYNC-05 | Medium | Different database, permission and network failures all appear as “Cloud: setup needed”. | Status identifies the failure and preserves retry guidance. |
| LOAD-01 | Critical | Live verification browser reported `app-payload-1.txt unavailable` before Supabase initialised. | Mobile and PC entry points load reliably without fetch/iframe payload reads. |

## Test setup
| Item | Value |
|---|---|
| Test site | |
| Android device/browser/PWA version | |
| PC/browser version | |
| Admin account | |
| Technician account | |
| Viewer account | |
| Test started | |
| App commit/version | |

## A. Startup and authentication
| Test | Android | PC | Pass criteria |
|---|---|---|---|
| Open mobile entry point | ☐ | N/A | App loads; no payload error. |
| Open `pc.html` | N/A | ☐ | App loads; no payload error. |
| Sign in and restore session | ☐ | ☐ | Correct account and Cloud status appear. |
| Sign out | ☐ | ☐ | Session is removed; protected cloud data is unavailable. |
| Invalid credentials | ☐ | ☐ | Clear error; no local/cloud corruption. |

## B. Two-way record synchronisation
Perform each test in both directions and refresh/reopen the receiving device before marking it passed.

| Data | Android → PC | PC → Android | Pass criteria |
|---|---|---|---|
| Create test site | ☐ | ☐ | One matching site appears. |
| Edit Site Information | ☐ | ☐ | Latest saved fields match exactly. |
| Access Control record | ☐ | ☐ | Create/edit fields match. |
| Intrusion Input record | ☐ | ☐ | Create/edit/imported fields match. |
| CCTV record | ☐ | ☐ | Create/edit fields match. |
| Battery record | ☐ | ☐ | Create/edit fields match. |
| PPM visit/history | ☐ | ☐ | Visit and results match. |

## C. Photos and backups
| Test | Result | Pass criteria |
|---|---|---|
| Android uploads photo; PC opens it | ☐ | Authorised PC session can list and open signed URL. |
| PC uploads photo; Android opens it | ☐ | Authorised Android session can list and open signed URL. |
| Technician deletes photo | ☐ | Allowed and disappears on both devices. |
| Viewer tries photo upload/delete | ☐ | Denied without misleading success. |
| Android uploads backup; PC opens it | ☐ | Authorised PC session can list/download it. |
| PC uploads backup; Android opens it | ☐ | Authorised Android session can list/download it. |
| Technician tries backup deletion | ☐ | Denied by hardened policy. |
| Admin deletes test backup | ☐ | Allowed and disappears on both devices. |

## D. Roles and isolation
| Test | Result | Pass criteria |
|---|---|---|
| Admin grants technician access | ☐ | Technician sees only authorised sites and can edit. |
| Admin grants viewer access | ☐ | Viewer can read but cannot alter site records/files. |
| Unauthorised account opens app | ☐ | No test-site rows, photos or backups are visible. |
| Admin removes test access | ☐ | Site becomes unavailable and is not recreated from stale local cache. |

## E. Offline, reconnect and conflicts
| Test | Result | Pass criteria |
|---|---|---|
| Open app with network unavailable | ☐ | Existing local data opens with clear offline status. |
| Edit Android offline, then reconnect | ☐ | Edit is preserved or conflict is shown; never silently lost. |
| Edit PC offline, then reconnect | ☐ | Edit is preserved or conflict is shown; never silently lost. |
| Edit different fields on both devices | ☐ | Both changes survive or a conflict is shown. |
| Edit the same field on both devices | ☐ | Deterministic conflict resolution; no silent overwrite. |
| Close during pending save and reopen | ☐ | Pending state is recoverable and status is accurate. |

## F. Live Supabase verification
Run in the Supabase Dashboard with the repository SQL beside it.

- [ ] `ppm_app_state`, `ppm_sites` and `ppm_site_members` exist.
- [ ] RLS is enabled on all three public tables.
- [ ] Helper and RPC functions exist with expected execute grants.
- [ ] Anonymous role has no table/function access.
- [ ] `ppm-photos` and `ppm-backups` are private.
- [ ] Storage policies derive site membership from `sites/<site-id>/...`.
- [ ] Photo bucket has intended size/MIME limits.
- [ ] Backup deletion is admin-only after `security-hardening.sql`.
- [ ] Results match `setup.sql`, `shared-site-model.sql`, `storage-policies.sql` and `security-hardening.sql`.

## Defect log
| ID | Date/time | Device/account/role | Steps | Expected | Actual | Severity | Evidence/status |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Release-gate result
- [ ] Critical tests passed.
- [ ] High-severity defects fixed and retested.
- [ ] Offline/conflict behaviour is documented and safe.
- [ ] Android and PC evidence is recorded.
- [ ] Project Brain, TODO and Changelog updated.
