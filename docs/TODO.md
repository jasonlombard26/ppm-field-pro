# PPM Field Pro — Development Backlog

Status values: `Not started`, `In progress`, `Needs verification`, `Blocked`, `Done`.

## Critical

### Phase 1 release gate — verify Supabase and Android ↔ PC synchronisation
- **Status:** In progress
- **Rule:** Pause major feature development until every acceptance criterion below is passed or an explicitly documented blocker is accepted.
- **Scope:** Validate the deployed system, not only the repository code.

#### 1. Live Supabase deployment and access controls
- Compare the live project with `supabase/setup.sql`, `supabase/shared-site-model.sql` and `supabase/storage-policies.sql`.
- Verify tables, RPCs, RLS, private buckets and Storage policies are deployed.
- Confirm admin, technician and viewer permissions, including denial for unauthorised users.
- Confirm legacy `ppm_app_state` recovery remains intact.
- **Status:** Needs verification
- **Dependencies:** Supabase project access.

#### 2. Two-way shared-data test matrix
Test Android → PC and PC → Android for:
- Site creation and site information edits.
- Access Control, Intrusion inputs, CCTV, Batteries and other current equipment records.
- PPM visit creation, edits and history.
- Private photo upload, display and deletion by another authorised session.
- Private backup upload, download and deletion by another authorised session.
- **Status:** Needs verification
- **Dependencies:** Android and PC sessions, at least two test accounts where role testing is required.
- **Relevant files:** `supabase-sync.js`, `index.html`, `pc.html`, cloud-photo and backup modules.

#### 3. Offline, reconnect and conflict behaviour
- Verify startup offline, editing offline, reconnect sync, stale local cache and simultaneous edits.
- Confirm failures are visible to the user and do not silently discard data.
- Determine and document the current conflict rule for `site_state` updates.
- **Status:** Needs verification
- **Dependencies:** Repeatable test site and controlled network interruption.

#### 4. Record evidence and defects
- Create a repeatable test checklist with device/browser, account/role, action, expected result, actual result and evidence.
- Log defects with reproduction steps and severity.
- Fix only the defects and safety gaps needed to pass this release gate before architecture consolidation.
- **Status:** Not started

### Phase 2 release gate — stabilise the existing architecture
- **Status:** Blocked by Phase 1
- Establish a canonical source and reduce versioned monkey-patch/load-order debt.
- Define one clear owner for local cache, remote state, sync state and conflict handling.
- Add automated checks where practical plus a repeatable Android/PC regression suite.
- Preserve existing data and behaviour through incremental changes; no big-bang rewrite.
- Major feature development remains paused until the stabilisation acceptance criteria are documented and passed.

### Security review of stored equipment passwords
- **Status:** Not started
- **What:** Replace inconsistent always-visible/masked CCTV password behaviour with an explicit authorised reveal/hide control and assess whether field-level encryption or a separate secured secret store is needed.
- **Dependencies:** Product/security decision.
- **Relevant files:** `field-updates-v10.js`, `latest-notes-v7.js`, record view modules.
- **Database changes:** Possibly, if encrypted/segregated storage is adopted.

## High

### Consolidate active source and remove override debt
- **Status:** Blocked by Phase 1 release gate
- **What:** Establish maintainable canonical source for the core app and reduce the chain of versioned monkey-patch modules. Preserve behaviour while eliminating obsolete loaded code paths.
- **Dependencies:** Regression test checklist for mobile and desktop.
- **Relevant files:** compressed payload files, `sites-v6.js`, `latest-notes-v7.js`, `field-updates-v10.js`, `site-tabs-v8.js` and other versioned modules.
- **Database changes:** None expected.

### Complete backup metadata
- **Status:** Not started
- **What:** Record System, original filename, backup date, uploaded date, technician/user and description/notes as structured metadata instead of relying mainly on generated filenames.
- **Dependencies:** Decide whether metadata lives in a new table or site JSON.
- **Relevant files:** `backups-v34.js`.
- **Database changes:** Recommended dedicated backup metadata table or equivalent structured model.

### Complete photo coverage across equipment types
- **Status:** Not started
- **What:** Apply the same private site-based cloud-photo model consistently to batteries and other relevant equipment, not only CCTV/access-control paths.
- **Dependencies:** Agree section naming/path convention.
- **Relevant files:** `cloud-photos-v8.js`, battery photo modules, photo display/action modules.
- **Database changes:** Storage policies likely already generic enough; verify live policies.

### Improve Site Information / History
- **Status:** Not started
- **What:** Provide a clear site history/maintenance view combining PPM visits and other work, rather than relying on manual `lastOtherWorkDate` and fallback technician fields.
- **Dependencies:** Define how non-PPM work is recorded.
- **Relevant files:** `sites-v6.js`, visit/history modules.
- **Database changes:** May require structured maintenance-history records.

### Add Notes to current CCTV and Access door forms
- **Status:** Not started
- **What:** Expose dedicated Notes fields on the current active CCTV and Access door/device forms so the documented requirement is complete.
- **Dependencies:** None.
- **Relevant files:** `field-updates-v10.js`.
- **Database changes:** None; existing asset JSON supports notes.

## Medium

### Review Head End data model
- **Status:** Not started
- **What:** Replace current placeholder Head End cards with structured records where useful for access system, intruder system, CCTV server, network switches and intercom.
- **Dependencies:** Define required fields per head-end type.
- **Relevant files:** `sites-v6.js`, `head-end-v31.js`, `backups-v34.js`.
- **Database changes:** Likely remain in site JSON initially; normalisation optional.

### Standardise structured networking fields
- **Status:** In progress
- **What:** Extend IP/subnet/gateway/MAC handling consistently to all networked device types and make the data easy to report/troubleshoot.
- **Dependencies:** Identify all network-capable record types.
- **Relevant files:** `field-updates-v10.js`, `mac-address-v32.js`, head-end/controller modules.
- **Database changes:** None required initially; future normalised network model possible.

### Remove obsolete Integriti-specific UI/code paths
- **Status:** In progress
- **What:** The current override hides/redirects Integriti Inputs. Remove or refactor obsolete vendor-specific loaded code after regression testing.
- **Dependencies:** Source consolidation work.
- **Relevant files:** `latest-notes-v7.js`, `field-updates-v10.js`.
- **Database changes:** None.

### Battery field review
- **Status:** Needs verification
- **What:** Confirm which extra battery fields should remain (quantity, connected panel/power supply, charger voltage, physical condition, replacement due date) and ensure obsolete date/amp-hour fields never reappear.
- **Dependencies:** Product decision.
- **Relevant files:** `field-updates-v10.js`, battery modules.
- **Database changes:** None.

### Add repeatable regression tests/checklist
- **Status:** Not started
- **What:** Cover sign-in/offline, site search/create/edit, access, intrusion import, CCTV, batteries, PPM visits, photos, backups and PC/mobile rendering.
- **Dependencies:** Stable test site/account.
- **Relevant files:** Whole app.
- **Database changes:** None.

## Future ideas

### Incremental relational normalisation
- **Status:** Not started
- **What:** Consider dedicated tables for devices, visits/history, backups and other high-value entities instead of storing nearly all operational data inside `site_state jsonb`.
- **Dependencies:** Migration/versioning strategy and tests.
- **Relevant files:** `supabase-sync.js`, `supabase/*.sql`.
- **Database changes:** Significant; future architecture decision required.

### Reporting-oriented network inventory
- **Status:** Not started
- **What:** Produce network-device reports using structured IP, subnet, gateway and MAC data.
- **Dependencies:** Networking field standardisation.
- **Database changes:** Optional.

### Vendor-specific import adapters
- **Status:** Not started
- **What:** Add import mappings for other intrusion/access platforms while retaining the vendor-neutral Input model.
- **Dependencies:** Sample exports from each vendor.
- **Database changes:** None expected initially.
