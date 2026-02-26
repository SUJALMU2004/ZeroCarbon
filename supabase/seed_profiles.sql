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

-- RLS can be enabled safely even if already enabled.
alter table public.profiles enable row level security;

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
