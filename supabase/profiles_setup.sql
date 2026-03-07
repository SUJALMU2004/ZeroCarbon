-- ZeroCarbon profiles setup for auth-linked user profiles.
-- Run this in Supabase SQL Editor for your active project.

-- Create profiles table when absent.
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

-- Ensure profile columns expected by account rendering exist.
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
  add column if not exists phone_otp_last_sent_at timestamptz;

alter table public.profiles
  add column if not exists profile_updated_at timestamptz not null default now();

-- Keep existing rows aligned with the default.
update public.profiles
set verification_status = 'not_submitted'
where verification_status is null;

update public.profiles
set phone_verified_at = null
where phone_verified = false
  and phone_verified_at is not null;

update public.profiles
set phone_otp_last_sent_at = null
where phone_verified = false
  and phone_otp_last_sent_at is not null;

-- Data consistency check for pending status.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_pending_requires_submitted_at'
  ) then
    alter table public.profiles
      add constraint profiles_pending_requires_submitted_at
      check (
        verification_status <> 'pending'
        or verification_submitted_at is not null
      );
  end if;
end $$;

-- Backfill missing profile emails from auth.users before NOT NULL.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

-- Email is required in profiles.
alter table public.profiles
  alter column email set not null;

alter table public.profiles enable row level security;

-- Keep policies idempotent.
drop policy if exists "Profiles select own row" on public.profiles;
drop policy if exists "Profiles update own row" on public.profiles;

create policy "Profiles select own row"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "Profiles update own row"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

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
    new.phone_otp_last_sent_at := null;
  end if;

  if coalesce(new.phone_verified, false) = false then
    new.phone_verified_at := null;
  end if;

  if coalesce(old.phone_verified, false) = false
    and coalesce(new.phone_verified, false) = true then
    if coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'Phone verification must be completed via server verification route.';
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

-- Verification tokens table for secure admin action links.
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

create index if not exists verification_tokens_user_id_idx
  on public.verification_tokens (user_id);

create index if not exists verification_tokens_expiry_used_idx
  on public.verification_tokens (expires_at, used);

alter table public.verification_tokens enable row level security;

drop policy if exists "Verification tokens insert own" on public.verification_tokens;

create policy "Verification tokens insert own"
on public.verification_tokens
for insert
to authenticated
with check (user_id = auth.uid());

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

-- Rotate verification tokens so old links are invalidated when user re-submits.
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

-- Auto-create a profile row for each new auth user.
create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, email)
  values (new.id, 'user', new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

-- Backfill existing auth users that do not yet have profiles.
insert into public.profiles (id, role, email)
select u.id, 'user', u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Secure admin verification action processor.
create or replace function public.admin_apply_verification_action(p_token text, p_action text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.verification_tokens%rowtype;
  v_current_status public.verification_status_enum;
  v_next_status public.verification_status_enum;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return 'invalid';
  end if;

  if p_action not in ('approve', 'reject', 'resubmit') then
    return 'invalid';
  end if;

  select *
  into v_token
  from public.verification_tokens
  where token = p_token
  for update;

  if not found then
    return 'invalid';
  end if;

  if v_token.used then
    return 'used';
  end if;

  if v_token.expires_at < now() then
    return 'expired';
  end if;

  select verification_status
  into v_current_status
  from public.profiles
  where id = v_token.user_id
  for update;

  if not found then
    update public.verification_tokens
    set used = true, used_at = now(), action_taken = 'invalid_profile'
    where id = v_token.id;

    return 'invalid';
  end if;

  if v_current_status = 'verified' then
    update public.verification_tokens
    set used = true, used_at = now(), action_taken = 'already_verified'
    where id = v_token.id;

    return 'already_verified';
  end if;

  if p_action = 'approve' then
    v_next_status := 'verified';
  elsif p_action = 'reject' then
    v_next_status := 'rejected';
  else
    v_next_status := 'resubmit_required';
  end if;

  update public.profiles
  set verification_status = v_next_status
  where id = v_token.user_id;

  update public.verification_submissions
  set status = v_next_status,
      reviewed_at = now(),
      review_action = p_action
  where id = (
    select id
    from public.verification_submissions
    where user_id = v_token.user_id
      and status = 'pending'
    order by version desc
    limit 1
  );

  update public.verification_tokens
  set used = true, used_at = now(), action_taken = p_action
  where id = v_token.id;

  if v_next_status = 'verified' then
    return 'approved';
  elsif v_next_status = 'rejected' then
    return 'rejected';
  end if;

  return 'resubmit_required';
end;
$$;

revoke all on function public.admin_apply_verification_action(text, text) from public;
grant execute on function public.admin_apply_verification_action(text, text) to anon, authenticated;

-- Ensure avatar storage bucket exists and is correctly configured.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies: user can write only their own deterministic avatar path.
drop policy if exists "Avatar images are public" on storage.objects;
drop policy if exists "Avatar upload own file" on storage.objects;
drop policy if exists "Avatar update own file" on storage.objects;
drop policy if exists "Avatar delete own file" on storage.objects;

create policy "Avatar images are public"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

create policy "Avatar upload own file"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = 'avatars'
  and split_part(name, '/', 2) = auth.uid()::text
  and split_part(name, '/', 3) like 'profile.%'
  and split_part(name, '/', 4) = ''
);

create policy "Avatar update own file"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = 'avatars'
  and split_part(name, '/', 2) = auth.uid()::text
  and split_part(name, '/', 3) like 'profile.%'
  and split_part(name, '/', 4) = ''
)
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = 'avatars'
  and split_part(name, '/', 2) = auth.uid()::text
  and split_part(name, '/', 3) like 'profile.%'
  and split_part(name, '/', 4) = ''
);

create policy "Avatar delete own file"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = 'avatars'
  and split_part(name, '/', 2) = auth.uid()::text
  and split_part(name, '/', 3) like 'profile.%'
  and split_part(name, '/', 4) = ''
);

-- Ensure private verification documents bucket exists.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-documents',
  'verification-documents',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Verification docs read own file" on storage.objects;
drop policy if exists "Verification docs upload own file" on storage.objects;
drop policy if exists "Verification docs update own file" on storage.objects;
drop policy if exists "Verification docs delete own file" on storage.objects;

create policy "Verification docs read own file"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'verification-documents'
  and split_part(name, '/', 1) = 'verification-documents'
  and split_part(name, '/', 2) = auth.uid()::text
  and (
    split_part(name, '/', 3) like 'document.%'
    or split_part(name, '/', 3) like 'document_v%.%'
  )
  and split_part(name, '/', 4) = ''
);

create policy "Verification docs upload own file"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'verification-documents'
  and split_part(name, '/', 1) = 'verification-documents'
  and split_part(name, '/', 2) = auth.uid()::text
  and (
    split_part(name, '/', 3) like 'document.%'
    or split_part(name, '/', 3) like 'document_v%.%'
  )
  and split_part(name, '/', 4) = ''
);

create policy "Verification docs update own file"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'verification-documents'
  and split_part(name, '/', 1) = 'verification-documents'
  and split_part(name, '/', 2) = auth.uid()::text
  and (
    split_part(name, '/', 3) like 'document.%'
    or split_part(name, '/', 3) like 'document_v%.%'
  )
  and split_part(name, '/', 4) = ''
)
with check (
  bucket_id = 'verification-documents'
  and split_part(name, '/', 1) = 'verification-documents'
  and split_part(name, '/', 2) = auth.uid()::text
  and (
    split_part(name, '/', 3) like 'document.%'
    or split_part(name, '/', 3) like 'document_v%.%'
  )
  and split_part(name, '/', 4) = ''
);

create policy "Verification docs delete own file"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'verification-documents'
  and split_part(name, '/', 1) = 'verification-documents'
  and split_part(name, '/', 2) = auth.uid()::text
  and (
    split_part(name, '/', 3) like 'document.%'
    or split_part(name, '/', 3) like 'document_v%.%'
  )
  and split_part(name, '/', 4) = ''
);
