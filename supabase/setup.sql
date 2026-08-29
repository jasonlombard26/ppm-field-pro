-- PPM Field Pro - initial Supabase cloud sync schema
-- Run this in Supabase Dashboard > SQL Editor.

create table if not exists public.ppm_app_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.ppm_app_state enable row level security;

-- Each signed-in user can only see and change their own PPM data.
drop policy if exists "ppm_state_select_own" on public.ppm_app_state;
create policy "ppm_state_select_own"
on public.ppm_app_state for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "ppm_state_insert_own" on public.ppm_app_state;
create policy "ppm_state_insert_own"
on public.ppm_app_state for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "ppm_state_update_own" on public.ppm_app_state;
create policy "ppm_state_update_own"
on public.ppm_app_state for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "ppm_state_delete_own" on public.ppm_app_state;
create policy "ppm_state_delete_own"
on public.ppm_app_state for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists ppm_app_state_user_id_idx
on public.ppm_app_state (user_id);

comment on table public.ppm_app_state is
'Offline-first PPM Field Pro state. RLS restricts each row to its authenticated owner.';
