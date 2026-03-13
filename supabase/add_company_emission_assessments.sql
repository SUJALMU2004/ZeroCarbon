-- ZeroCarbon corporate emissions assessments table
-- Run manually in Supabase SQL editor.
-- Idempotent migration.

CREATE TABLE IF NOT EXISTS public.company_emission_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  scope_1_tco2e numeric(18, 6),
  scope_2_tco2e numeric(18, 6),
  scope_3_tco2e numeric(18, 6),
  total_corporate_tco2e numeric(18, 6),
  audit_status text NOT NULL DEFAULT 'FAILED',
  failure_stage text,
  error_message text,
  provider_diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'company_emission_assessments_audit_status_check'
  ) THEN
    ALTER TABLE public.company_emission_assessments
      ADD CONSTRAINT company_emission_assessments_audit_status_check
      CHECK (audit_status IN ('SUCCESS_ZERO_TRUST_VERIFIED', 'FAILED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS company_emission_assessments_user_created_idx
  ON public.company_emission_assessments(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS company_emission_assessments_company_created_idx
  ON public.company_emission_assessments(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS company_emission_assessments_status_created_idx
  ON public.company_emission_assessments(audit_status, created_at DESC);

ALTER TABLE public.company_emission_assessments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_emission_assessments'
      AND policyname = 'Emission assessments select own rows'
  ) THEN
    CREATE POLICY "Emission assessments select own rows"
      ON public.company_emission_assessments
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_emission_assessments'
      AND policyname = 'Emission assessments insert own rows'
  ) THEN
    CREATE POLICY "Emission assessments insert own rows"
      ON public.company_emission_assessments
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
