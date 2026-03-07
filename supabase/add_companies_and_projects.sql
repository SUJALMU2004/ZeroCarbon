-- ZeroCarbon additional verification entities
-- Run manually in Supabase SQL Editor before deploying API/page changes.
-- Idempotent and safe for repeated runs.

-- PART A: companies table
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  registration_number text not null,
  country text not null,
  industry_type text not null,
  website_url text,
  status public.verification_status_enum not null default 'not_submitted',
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists companies_user_id_idx
  on public.companies(user_id);

alter table public.companies enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'companies'
      and policyname = 'Companies select own row'
  ) then
    create policy "Companies select own row"
      on public.companies
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'companies'
      and policyname = 'Companies insert own row'
  ) then
    create policy "Companies insert own row"
      on public.companies
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'companies'
      and policyname = 'Companies update own row'
  ) then
    create policy "Companies update own row"
      on public.companies
      for update
      to authenticated
      using (user_id = auth.uid() and status <> 'verified')
      with check (user_id = auth.uid());
  end if;
end $$;

create or replace function public.handle_companies_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists on_companies_updated on public.companies;
create trigger on_companies_updated
before update on public.companies
for each row execute function public.handle_companies_updated_at();

-- PART B: carbon_projects table

do $$
begin
  create type public.carbon_project_type_enum as enum (
    'forestry',
    'solar',
    'methane',
    'other'
  );
exception
  when duplicate_object then
    null;
end $$;

create table if not exists public.carbon_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_name text not null,
  project_type public.carbon_project_type_enum not null,
  latitude numeric(10, 6) not null,
  longitude numeric(10, 6) not null,
  land_area_hectares numeric(12, 2) not null,
  estimated_co2_per_year numeric(14, 2) not null,
  project_start_date date not null,
  document_path text,
  document_type text,
  status public.verification_status_enum not null default 'not_submitted',
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists carbon_projects_user_id_idx
  on public.carbon_projects(user_id);

create index if not exists carbon_projects_status_idx
  on public.carbon_projects(status);

alter table public.carbon_projects enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'carbon_projects'
      and policyname = 'Projects select own rows'
  ) then
    create policy "Projects select own rows"
      on public.carbon_projects
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'carbon_projects'
      and policyname = 'Projects insert own row'
  ) then
    create policy "Projects insert own row"
      on public.carbon_projects
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'carbon_projects'
      and policyname = 'Projects update own row'
  ) then
    create policy "Projects update own row"
      on public.carbon_projects
      for update
      to authenticated
      using (user_id = auth.uid() and status <> 'verified')
      with check (user_id = auth.uid());
  end if;
end $$;

create or replace function public.handle_carbon_projects_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists on_carbon_projects_updated on public.carbon_projects;
create trigger on_carbon_projects_updated
before update on public.carbon_projects
for each row execute function public.handle_carbon_projects_updated_at();

-- PART C: project document storage policies
-- Uses existing verification-documents bucket.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Project documents upload own folder'
  ) then
    create policy "Project documents upload own folder"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'verification-documents'
        and (storage.foldername(name))[1] = 'projects'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Project documents read own folder'
  ) then
    create policy "Project documents read own folder"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'verification-documents'
        and (storage.foldername(name))[1] = 'projects'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
  end if;
end $$;
