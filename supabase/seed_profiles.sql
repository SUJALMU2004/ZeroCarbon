-- One-time seed for profile rows from existing auth users.
-- Run this in Supabase SQL Editor.

-- Create profiles table if it doesn't exist yet.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade
);

-- Verification status enum.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'verification_status_enum'
      and n.nspname = 'public'
  ) then
    create type public.verification_status_enum as enum (
      'not_submitted',
      'pending',
      'verified',
      'rejected',
      'resubmit_required'
    );
  end if;
end $$;

-- Ensure expected columns exist for profile rendering.
alter table public.profiles
  add column if not exists role text;

alter table public.profiles
  add column if not exists full_name text;

alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists verification_status public.verification_status_enum not null default 'not_submitted';

alter table public.profiles
  add column if not exists verification_document_url text;

alter table public.profiles
  add column if not exists verification_document_type text;

alter table public.profiles
  add column if not exists verification_submitted_at timestamptz;

alter table public.profiles
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles
  add column if not exists date_of_birth date;

alter table public.profiles
  add column if not exists phone_number text;

alter table public.profiles
  add column if not exists address_line1 text;

alter table public.profiles
  add column if not exists address_line2 text;

alter table public.profiles
  add column if not exists city text;

alter table public.profiles
  add column if not exists state text;

alter table public.profiles
  add column if not exists postal_code text;

alter table public.profiles
  add column if not exists country text;

alter table public.profiles
  add column if not exists phone_verified boolean not null default false;

alter table public.profiles
  add column if not exists phone_verified_at timestamptz;

alter table public.profiles
  add column if not exists profile_updated_at timestamptz not null default now();

-- RLS can be enabled safely even if already enabled.
alter table public.profiles enable row level security;

create or replace function public.handle_profile_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.profile_updated_at := now();
  return new;
end;
$$;

drop trigger if exists before_profiles_set_profile_updated_at on public.profiles;
create trigger before_profiles_set_profile_updated_at
before update on public.profiles
for each row execute function public.handle_profile_updated_at();

create or replace function public.enforce_profile_identity_locks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_phone text;
  v_phone_confirmed_at timestamptz;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if old.verification_status = 'verified'
    and (
      new.date_of_birth is distinct from old.date_of_birth
      or new.phone_number is distinct from old.phone_number
      or new.address_line1 is distinct from old.address_line1
      or new.address_line2 is distinct from old.address_line2
      or new.city is distinct from old.city
      or new.state is distinct from old.state
      or new.postal_code is distinct from old.postal_code
      or new.country is distinct from old.country
    ) then
    raise exception 'Identity details cannot be edited after verification.';
  end if;

  if new.phone_number is distinct from old.phone_number then
    new.phone_verified := false;
    new.phone_verified_at := null;
  end if;

  if coalesce(new.phone_verified, false) = false then
    new.phone_verified_at := null;
  end if;

  if coalesce(old.phone_verified, false) = false
    and coalesce(new.phone_verified, false) = true then
    if auth.uid() is null then
      raise exception 'Unauthorized request.';
    end if;

    select u.phone, u.phone_confirmed_at
    into v_auth_phone, v_phone_confirmed_at
    from auth.users u
    where u.id = auth.uid();

    if v_auth_phone is null
      or v_phone_confirmed_at is null
      or new.phone_number is null
      or v_auth_phone is distinct from new.phone_number then
      raise exception 'Phone verification mismatch. Save and verify again.';
    end if;

    if new.phone_verified_at is null then
      new.phone_verified_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists before_profiles_enforce_identity_locks on public.profiles;
create trigger before_profiles_enforce_identity_locks
before update on public.profiles
for each row execute function public.enforce_profile_identity_locks();

insert into public.profiles (id, role, email)
select u.id, 'user', u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Backfill missing email values from auth.users.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

-- Keep existing rows aligned with verification default.
update public.profiles
set verification_status = 'not_submitted'
where verification_status is null;

update public.profiles
set phone_verified_at = null
where phone_verified = false
  and phone_verified_at is not null;

-- Email is required in profiles.
alter table public.profiles
  alter column email set not null;

-- Minimal token table setup for verification links.
create table if not exists public.verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  action_taken text
);

create table if not exists public.verification_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  version integer not null,
  document_path text not null,
  document_type text not null,
  status public.verification_status_enum not null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_action text
);

create unique index if not exists verification_submissions_user_version_idx
  on public.verification_submissions (user_id, version);

create index if not exists verification_submissions_user_submitted_idx
  on public.verification_submissions (user_id, submitted_at desc);

alter table public.verification_submissions enable row level security;

drop policy if exists "Verification submissions select own" on public.verification_submissions;
drop policy if exists "Verification submissions insert own" on public.verification_submissions;

create policy "Verification submissions select own"
on public.verification_submissions
for select
to authenticated
using (user_id = auth.uid());

create policy "Verification submissions insert own"
on public.verification_submissions
for insert
to authenticated
with check (user_id = auth.uid());

create or replace function public.rotate_verification_token(
  p_user_id uuid,
  p_token text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized request.';
  end if;

  if p_user_id is null or auth.uid() <> p_user_id then
    raise exception 'Forbidden request.';
  end if;

  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'Token payload is invalid.';
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'Token expiry is invalid.';
  end if;

  update public.verification_tokens
  set used = true,
      used_at = now(),
      action_taken = 'superseded'
  where user_id = p_user_id
    and used = false;

  insert into public.verification_tokens (user_id, token, expires_at, used)
  values (p_user_id, p_token, p_expires_at, false);
end;
$$;

revoke all on function public.rotate_verification_token(uuid, text, timestamptz) from public;
grant execute on function public.rotate_verification_token(uuid, text, timestamptz) to authenticated;
