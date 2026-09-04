# PPM Field Pro — Architectural Decisions

## 2026-09-04 — Existing application is the source of truth
**Decision:** Continue the existing `jasonlombard26/ppm-field-pro` repository rather than recreating the application.

**Reason:** The application already contains working mobile, desktop, Supabase, PPM, equipment, photo and backup functionality.

**Consequences:** Future work must inspect active loaded modules before changing behaviour. Requirements are reconciled against implementation instead of assumed from chat history.

## 2026-09-04 — Sites-first navigation
**Decision:** The Sites list is the primary working screen rather than a dashboard.

**Reason:** Technicians normally begin by selecting the customer site they are attending.

**Consequences:** Dashboard-style navigation should not be reintroduced unless explicitly reconsidered. Search and site context remain central.

## 2026-09-04 — PPM Visits belong to Sites
**Decision:** PPM Visits are site-scoped and not a main-navigation destination.

**Reason:** Visits only make sense in the context of a specific site.

**Consequences:** Visit creation, history and reporting should retain `siteId` and be accessed from the selected site.

## 2026-09-04 — No separate Assets main-navigation tab
**Decision:** Assets/system equipment live inside site/system areas rather than as a global main tab.

**Reason:** Equipment is operationally site-specific.

**Consequences:** Global asset tools should not be exposed as primary navigation without a strong use case.

## 2026-09-04 — Supabase is the shared backend
**Decision:** Android/mobile and desktop use the same Supabase project/backend.

**Reason:** Data entered by one authorised device/user must be available to others.

**Consequences:** Local browser storage remains an offline cache, not an independent authoritative database.

## 2026-09-04 — Shared site membership model
**Decision:** Authorisation is site-based using `ppm_site_members` with admin, technician and viewer roles.

**Reason:** Access must follow customer/site permissions rather than the technician who originally created or uploaded data.

**Consequences:** RLS and Storage policies must use site membership. Site creation/access grants should remain controlled through RPCs or equivalent secure server-side logic.

## 2026-09-04 — Private site-based file storage
**Decision:** Supabase Storage buckets remain private. Files are organised under `sites/<site-id>/...` and accessed using authenticated/signed requests.

**Reason:** Security-system photos and backup files are sensitive customer data and must be shareable among authorised site users without becoming public.

**Consequences:** Never solve file sharing by making a bucket public. Storage policies must derive/validate the site ID from the object path.

## 2026-09-04 — Intrusion inputs are vendor-neutral
**Decision:** Inputs live under Intrusion and may be imported from Integriti or other systems.

**Reason:** PPM Field Pro must not be structurally tied to one intrusion platform.

**Consequences:** Import source should be recorded, but the data model/UI should use generic terms such as Input, Module, Area and Programming Status.

## 2026-09-04 — Preserve legacy state during migration
**Decision:** Keep `ppm_app_state` while using the newer shared `ppm_sites` model.

**Reason:** It provides a recovery/migration path for older user-local cloud data.

**Consequences:** Do not delete the legacy table until a deliberate data migration and rollback strategy exists.

## 2026-09-04 — Current JSON site-state model is transitional
**Decision:** Document the current `ppm_sites.site_state` JSON model accurately rather than pretending operational entities are already relational tables.

**Reason:** Most existing application data is still serialised as site-scoped JSON arrays.

**Consequences:** Future normalisation should be incremental and compatibility-conscious, not a big-bang rewrite.
