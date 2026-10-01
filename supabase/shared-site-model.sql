-- PPM Field Pro - shared site-centric cloud model
-- Run AFTER the original supabase/setup.sql.
-- Requires Supabase's platform-provided storage.objects table (no bucket setup needed).
-- This is additive: it does not delete ppm_app_state, so legacy user data remains recoverable.

create table if not exists public.ppm_sites (
  id bigint primary key,
  name text not null default '',
  site_state jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing installations receive a baseline version without changing their state.
-- Reapplying the script must never reset a version that has already advanced.
alter table public.ppm_sites add column if not exists revision bigint not null default 1;

create table if not exists public.ppm_site_members (
  site_id bigint not null references public.ppm_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'technician' check (role in ('admin','technician','viewer')),
  created_at timestamptz not null default now(),
  primary key (site_id,user_id)
);

create index if not exists ppm_site_members_user_id_idx on public.ppm_site_members(user_id);
create index if not exists ppm_sites_updated_at_idx on public.ppm_sites(updated_at desc);

alter table public.ppm_sites enable row level security;
alter table public.ppm_site_members enable row level security;

create or replace function public.ppm_user_has_site_access(p_site_id bigint)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.ppm_site_members m where m.site_id=p_site_id and m.user_id=auth.uid());
$$;

create or replace function public.ppm_user_can_edit_site(p_site_id bigint)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.ppm_site_members m where m.site_id=p_site_id and m.user_id=auth.uid() and m.role in ('admin','technician'));
$$;

create or replace function public.ppm_user_is_site_admin(p_site_id bigint)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.ppm_site_members m where m.site_id=p_site_id and m.user_id=auth.uid() and m.role='admin');
$$;

revoke all on function public.ppm_user_has_site_access(bigint) from public;
revoke all on function public.ppm_user_can_edit_site(bigint) from public;
revoke all on function public.ppm_user_is_site_admin(bigint) from public;
grant execute on function public.ppm_user_has_site_access(bigint) to authenticated;
grant execute on function public.ppm_user_can_edit_site(bigint) to authenticated;
grant execute on function public.ppm_user_is_site_admin(bigint) to authenticated;

drop policy if exists "PPM shared sites select" on public.ppm_sites;
create policy "PPM shared sites select" on public.ppm_sites for select to authenticated using (public.ppm_user_has_site_access(id));

-- Site creation is only performed by the controlled SECURITY DEFINER RPC below.
drop policy if exists "PPM shared sites insert" on public.ppm_sites;

-- All creates/updates must carry a revision through ppm_save_site_state.
-- Both privileges and the old RLS write policy are removed, including grants
-- inherited through PUBLIC, so direct REST writes cannot bypass the comparison.
drop policy if exists "PPM shared sites update" on public.ppm_sites;
revoke insert, update, delete on public.ppm_sites from public, anon, authenticated;
grant select on public.ppm_sites to authenticated;

-- A physical site deletion leaves Storage objects under sites/<id>/ behind.
-- Keep the ID reserved: otherwise another user could create it and gain access
-- to those objects. Deletion needs a reviewed tombstone/storage lifecycle first.
drop policy if exists "PPM shared sites delete" on public.ppm_sites;

drop policy if exists "PPM memberships select" on public.ppm_site_members;
create policy "PPM memberships select" on public.ppm_site_members for select to authenticated
using (user_id=auth.uid() or public.ppm_user_is_site_admin(site_id));

-- Membership creation is only performed by controlled SECURITY DEFINER RPCs.
drop policy if exists "PPM memberships insert self creator" on public.ppm_site_members;

drop policy if exists "PPM memberships update admin" on public.ppm_site_members;
create policy "PPM memberships update admin" on public.ppm_site_members for update to authenticated
using (public.ppm_user_is_site_admin(site_id)) with check (public.ppm_user_is_site_admin(site_id));

drop policy if exists "PPM memberships delete admin" on public.ppm_site_members;
create policy "PPM memberships delete admin" on public.ppm_site_members for delete to authenticated using (public.ppm_user_is_site_admin(site_id));

-- Whole-site compare-and-swap. NULL means create only, never blind overwrite.
-- The revision predicate is in the UPDATE itself: after waiting for another
-- writer, PostgreSQL rechecks it against that writer's committed row version.
create or replace function public.ppm_save_site_state(
  p_site_id bigint,
  p_name text,
  p_site_state jsonb,
  p_expected_revision bigint
)
returns bigint language plpgsql security definer set search_path='' as $$
declare
  caller_id uuid := auth.uid();
  saved_revision bigint;
begin
  if caller_id is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;
  if p_site_id is null or p_site_id <= 0 then
    raise exception using errcode='22023', message='A positive site ID is required';
  end if;
  if p_expected_revision is not null and p_expected_revision <= 0 then
    raise exception using errcode='22023', message='Expected revision must be positive or NULL for creation';
  end if;
  if p_site_state is null or jsonb_typeof(p_site_state) <> 'object'
     or jsonb_typeof(p_site_state->'site') is distinct from 'object'
     or (p_site_state->'site'->>'id') is distinct from p_site_id::text then
    raise exception using errcode='22023', message='Site state must be an object with a matching site.id';
  end if;

  if p_expected_revision is null then
    -- Older physical deletions may have left private objects under this ID.
    -- Never let a new creator claim that namespace, even if no site row exists.
    if exists (
      select 1 from storage.objects o
      where o.bucket_id in ('ppm-photos','ppm-backups')
        and o.name like 'sites/%/%'
        and split_part(o.name,'/',2) ~ '^[0-9]+$'
        -- Storage policies interpret zero-padded folder IDs as the same bigint.
        -- Normalize as text so malformed/oversized names cannot raise overflow.
        and ltrim(split_part(o.name,'/',2),'0') = p_site_id::text
    ) then
      raise exception using errcode='40001', message='Site revision conflict; reload before saving';
    end if;
    -- DO NOTHING, rather than an upsert, protects existing sites even when two
    -- creators use the same ID. Only the successful insert creates membership.
    insert into public.ppm_sites(id,name,site_state,created_by,revision,updated_at)
    values(p_site_id,coalesce(p_name,''),p_site_state,caller_id,1,now())
    on conflict (id) do nothing
    returning revision into saved_revision;
    if saved_revision is null then
      raise exception using errcode='40001', message='Site revision conflict; reload before saving';
    end if;
    insert into public.ppm_site_members(site_id,user_id,role)
    values(p_site_id,caller_id,'admin');
    return saved_revision;
  end if;

  update public.ppm_sites s
  set name=coalesce(p_name,''), site_state=p_site_state,
      revision=s.revision+1, updated_at=now()
  where s.id=p_site_id and s.revision=p_expected_revision
    and exists (
      select 1 from public.ppm_site_members m
      where m.site_id=s.id and m.user_id=caller_id
        and m.role in ('admin','technician')
    )
  returning s.revision into saved_revision;
  if saved_revision is not null then return saved_revision; end if;

  -- Do not expose state, current revision, or existence to a non-editor.
  if not exists (
    select 1 from public.ppm_site_members m
    where m.site_id=p_site_id and m.user_id=caller_id
      and m.role in ('admin','technician')
  ) then
    raise exception using errcode='42501', message='No edit access to site';
  end if;
  raise exception using errcode='40001', message='Site revision conflict; reload before saving';
end;
$$;
revoke all on function public.ppm_save_site_state(bigint,text,jsonb,bigint) from public, anon;
grant execute on function public.ppm_save_site_state(bigint,text,jsonb,bigint) to authenticated;

-- Old clients must upgrade rather than silently bypass optimistic concurrency.
-- Keep the exact signature so deployed old clients receive an actionable error.
create or replace function public.ppm_upsert_site_state(p_site_id bigint,p_name text,p_site_state jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  raise exception using errcode='55000',
    message='Client upgrade required: use ppm_save_site_state with an expected revision';
end;
$$;
revoke all on function public.ppm_upsert_site_state(bigint,text,jsonb) from public, anon;
grant execute on function public.ppm_upsert_site_state(bigint,text,jsonb) to authenticated;

create or replace function public.ppm_grant_site_access(p_site_id bigint,p_email text,p_role text default 'technician')
returns void language plpgsql security definer set search_path=public,auth as $$
declare target_user uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.ppm_user_is_site_admin(p_site_id) then raise exception 'Only a site admin can grant access'; end if;
  if p_role not in ('admin','technician','viewer') then raise exception 'Invalid role'; end if;
  select id into target_user from auth.users where lower(email)=lower(trim(p_email)) limit 1;
  if target_user is null then raise exception 'No Supabase user exists for that email'; end if;
  insert into public.ppm_site_members(site_id,user_id,role) values(p_site_id,target_user,p_role)
  on conflict(site_id,user_id) do update set role=excluded.role;
end;
$$;
revoke all on function public.ppm_grant_site_access(bigint,text,text) from public;
grant execute on function public.ppm_grant_site_access(bigint,text,text) to authenticated;

comment on table public.ppm_sites is 'Shared site records for PPM Field Pro. site_state contains data scoped to one site.';
comment on column public.ppm_sites.revision is 'Monotonic version for whole-site compare-and-swap saves; NULL expected revision is create-only.';
comment on table public.ppm_site_members is 'Authorised PPM Field Pro users and roles for each site.';
