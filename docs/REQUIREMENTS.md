# PPM Field Pro — Requirements

This document records the desired product requirements and their verified status against the active repository as inspected on 2026-09-04. Status meanings: **Implemented**, **Partial**, **Missing**, or **Needs live verification**.

## Product and platform
- **Implemented** — Existing PPM Field Pro application must be continued; do not create a new app.
- **Implemented** — Mobile/Android and desktop/PC interfaces exist and use the same codebase/backend.
- **Implemented** — Supabase is the shared backend.
- **Partial** — Offline-first local storage remains part of the architecture; shared cloud sync is implemented, but full cross-device behaviour still depends on deployed Supabase schema/policies and authentication being correctly configured.

## Main navigation
- **Implemented** — Sites-first navigation replaces a traditional dashboard as the primary working experience.
- **Implemented** — Searchable Sites list.
- **Implemented** — PPM Visits hidden from main navigation and attached to individual sites.
- **Implemented** — Faults hidden from main navigation.
- **Implemented** — Assets hidden from main navigation.

## Sites
Site records should expose:
- **Implemented** — Site name.
- **Implemented** — Address.
- **Implemented** — Contact names.
- **Implemented** — Contact phone numbers.
- **Implemented** — Monitoring centre.
- **Implemented** — Monitoring account number.
- **Implemented** — Date of last PPM, derived from site visits.
- **Implemented** — Date of last other work, currently a manually maintained site field.
- **Implemented** — Last technician onsite, derived from latest visit with a manual fallback.

Site areas:
- **Implemented** — Access Control.
- **Implemented** — Intrusion.
- **Implemented** — CCTV.
- **Implemented** — Batteries.
- **Partial** — Backups exist inside Head End rather than as a dedicated first-level site area.
- **Implemented** — PPM Visits.
- **Partial** — Site information exists; a richer chronological site/maintenance history view remains incomplete.

## Access Control
Door/device records should support:
- **Implemented** — Door number/name.
- **Implemented** — Reader In.
- **Implemented** — Reader Out.
- **Implemented** — Lock Type.
- **Implemented** — REX Yes/No.
- **Implemented** — EBG Yes/No.
- **Implemented** — Controller / Module free text.
- **Implemented** — Other free text.
- **Partial** — Notes support exists on some access-related records/controllers, but the current door form does not expose a dedicated Notes field.
- **Implemented/Partial** — Photos are supported for access devices, including labels/types relevant to readers, locks, door contacts, REX, controllers/modules, power supplies, cabling and defects. Cloud sharing currently maps access photos to `access-control` storage paths.
- **Implemented** — Current save override clears obsolete Reader Number and Reader Type fields.

## Intrusion
- **Implemented** — Inputs are displayed under Intrusion in the latest active override rather than as a primary Integriti-only feature.
- **Implemented** — Import source can identify Integriti, Bosch, Tecom or another source.
- **Implemented** — CSV import.
- **Implemented** — Excel XLS/XLSX import via SheetJS loaded from jsDelivr.
- **Implemented** — Imported fields include input name, input number/address, module, area, process group, programming/status and notes where source columns are available.
- **Implemented** — Imported records are stored as Intrusion/Input asset records and therefore can participate in site data, PPM generation and reporting logic.
- **Partial** — Obsolete Integriti-specific functions/code still remain in older loaded modules but are redirected/hidden by `field-updates-v10.js`.

## CCTV
Camera records should support:
- **Implemented** — Camera name.
- **Implemented** — Camera location.
- **Implemented** — Camera type.
- **Implemented** — Model number.
- **Implemented** — IP address.
- **Implemented** — Subnet mask.
- **Implemented** — Gateway.
- **Implemented** — MAC address through `mac-address-v32.js`.
- **Implemented** — User login.
- **Implemented** — Password.
- **Partial** — Notes are not exposed in the current CCTV edit form.
- **Implemented** — Photos and cloud storage.
- **Partial** — Password visibility behaviour has evolved across layered modules; current active form uses visible text input in `field-updates-v10.js`, while earlier UI masked display. A deliberate authorised reveal/hide control should replace this inconsistent behaviour.

## Batteries
- **Implemented** — Battery number.
- **Implemented** — Battery location.
- **Implemented** — Battery installation date.
- **Implemented** — Battery Type.
- **Implemented** — Battery voltage.
- **Implemented** — Voltage after load test.
- **Implemented** — Notes.
- **Partial** — Battery photo support exists through battery photo modules, but shared cloud storage behaviour should be verified and aligned with site-based storage requirements.
- **Implemented** — Battery Type options include 12V 7Ah, 12V 18Ah and Other with free-text custom type.
- **Implemented** — Old separate amp-hour field is cleared by current save logic.
- **Implemented** — Old install/replacement date field is cleared by current save logic.
- **Note** — Additional legacy fields remain visible/retained in the battery form (quantity, connected panel, charger voltage, physical condition, replacement due date). These do not conflict with the stated requirements but should be reviewed deliberately.

## Backups
- **Implemented** — Shared Backups area under Head End.
- **Implemented** — Upload/open/delete customer system backup files through private Supabase Storage.
- **Implemented** — Backup objects belong to the site path, not the user.
- **Partial** — System/type and description are captured into the generated storage filename.
- **Partial** — Uploaded date is available from Storage object metadata.
- **Missing** — Explicit backup date field.
- **Missing** — Explicit technician/user metadata attached to each backup record.
- **Partial** — Filename exists as Storage object name but there is no dedicated relational metadata record.

## Supabase and shared data
- **Implemented in repository / Needs live verification** — Shared site model using `ppm_sites` and `ppm_site_members`.
- **Implemented in repository / Needs live verification** — Site roles: admin, technician, viewer.
- **Implemented in repository / Needs live verification** — RLS and helper functions for site access/edit/admin.
- **Implemented** — Mobile and desktop both load `supabase-sync.js` and target the same backend.
- **Implemented** — Site data, system data, assets/inputs, visits and history arrays are serialised into site-scoped `site_state` JSON.

## Photo and file storage
- **Implemented in repository / Needs live verification** — `ppm-photos` and `ppm-backups` buckets configured private.
- **Implemented in repository / Needs live verification** — Storage policies derive site ID from `sites/<site-id>/...` and authorise via site membership.
- **Implemented** — Device photo paths are site-centric and follow the intended shape `sites/<site-id>/<section>/<record-id>/<photo-file>`.
- **Implemented** — Signed URLs are used for private file access.
- **Partial** — Cloud photo sections are currently focused on CCTV and Access Control. Other record types should use the same architecture consistently.

## Device networking
- **Implemented** — MAC Address supported for CCTV cameras and access controllers that have IP fields.
- **Partial** — Networking data is still embedded in generic asset JSON rather than represented in a normalised network-device schema/reporting model.

## Working rules
Before significant changes, developers/AI agents must read `PROJECT_BRAIN.md`, inspect active code, check this file, check `DATABASE.md` for backend work, check `DECISIONS.md`, make/test the smallest safe change, and update documentation/TODO/changelog accordingly.
