-- PPM Field Pro - shared site-centric cloud model
-- Run AFTER the original supabase/setup.sql.
-- This is additive: it does not delete ppm_app_state, so legacy user data remains recoverable.

create table if not exists public.ppm_sites (
  id bigint primary key,
  name text not null default '',
  site_state jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

drop policy if exists "PPM shared sites update" on public.ppm_sites;
create policy "PPM shared sites update" on public.ppm_sites for update to authenticated
using (public.ppm_user_can_edit_site(id)) with check (public.ppm_user_can_edit_site(id));

drop policy if exists "PPM shared sites delete" on public.ppm_sites;
create policy "PPM shared sites delete" on public.ppm_sites for delete to authenticated using (public.ppm_user_is_site_admin(id));

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

create or replace function public.ppm_upsert_site_state(p_site_id bigint,p_name text,p_site_state jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from public.ppm_sites where id=p_site_id) then
    if not public.ppm_user_can_edit_site(p_site_id) then raise exception 'No edit access to site %',p_site_id; end if;
    update public.ppm_sites set name=coalesce(p_name,''),site_state=coalesce(p_site_state,'{}'::jsonb),updated_at=now() where id=p_site_id;
  else
    insert into public.ppm_sites(id,name,site_state,created_by,updated_at)
    values(p_site_id,coalesce(p_name,''),coalesce(p_site_state,'{}'::jsonb),auth.uid(),now());
    insert into public.ppm_site_members(site_id,user_id,role) values(p_site_id,auth.uid(),'admin') on conflict do nothing;
  end if;
end;
$$;
revoke all on function public.ppm_upsert_site_state(bigint,text,jsonb) from public;
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
comment on table public.ppm_site_members is 'Authorised PPM Field Pro users and roles for each site.';
