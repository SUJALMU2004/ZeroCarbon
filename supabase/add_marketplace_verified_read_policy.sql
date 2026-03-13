-- ZeroCarbon marketplace cross-account visibility policy.
-- Run manually in Supabase SQL Editor.
-- Idempotent migration: keeps owner policies unchanged.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'carbon_projects'
      and policyname = 'Projects select verified marketplace rows'
  ) then
    create policy "Projects select verified marketplace rows"
      on public.carbon_projects
      for select
      to authenticated
      using (status = 'verified');
  end if;
end $$;
