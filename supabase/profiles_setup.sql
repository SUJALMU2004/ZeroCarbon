-- ZeroCarbon profiles setup for auth-linked user profiles.
-- Run this in Supabase SQL Editor for your active project.

-- Create profiles table when absent.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade
);

-- Ensure profile columns expected by dashboard rendering exist.
alter table public.profiles
  add column if not exists role text;

alter table public.profiles
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles enable row level security;

-- Auto-create a profile row for each new auth user.
create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

-- Backfill existing auth users that do not yet have profiles.
insert into public.profiles (id, role)
select u.id, 'user'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
