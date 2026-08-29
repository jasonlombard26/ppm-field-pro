# PPM Field Pro

Android-installable PWA for programmed preventative maintenance of Alarm, Access Control, CCTV and Intercom systems.

Initial site dataset: Lombard Building.

## Supabase cloud sync

The app is being migrated from browser-only storage to an offline-first Supabase-backed database.

### One-time database setup

1. Open the Supabase project dashboard.
2. Open **SQL Editor**.
3. Create a new query.
4. Copy all SQL from `supabase/setup.sql` into the editor and run it.
5. In **Authentication > Providers**, leave Email enabled.
6. If email confirmation is enabled, new users must confirm their email before signing in.

The browser app uses the public publishable key in `supabase-config.js`. This is intentional. Database security is enforced by Supabase Row Level Security, so authenticated users can only access their own app-state row.

### Current sync scope

Sites, equipment/assets, PPM visits, faults and maintenance history are synced to Supabase. Local browser storage remains as an offline cache. Photos remain device-local during this first cloud phase; a Supabase Storage migration will add cross-device photo sync next.
