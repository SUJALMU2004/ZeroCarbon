-- One-time seed for profile rows from existing auth users.
-- Run this in Supabase SQL Editor.

-- Create profiles table if it doesn't exist yet.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade
);

-- Ensure expected columns exist for dashboard rendering.
alter table public.profiles
  add column if not exists role text;

alter table public.profiles
  add column if not exists created_at timestamptz not null default now();

-- RLS can be enabled safely even if already enabled.
alter table public.profiles enable row level security;

insert into public.profiles (id, role)
select u.id, 'user'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
