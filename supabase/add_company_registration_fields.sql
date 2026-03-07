-- ZeroCarbon company registration field extension
-- Run manually in Supabase SQL Editor before deploying code changes.

-- Part A: company_size enum
DO $$ BEGIN
  CREATE TYPE public.company_size_enum AS ENUM
    ('1–10', '10–50', '50–200', '200–1000', '1000+');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Part B: add new columns
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS legal_company_name text,
  ADD COLUMN IF NOT EXISTS business_email text,
  ADD COLUMN IF NOT EXISTS official_website text,
  ADD COLUMN IF NOT EXISTS company_size public.company_size_enum,
  ADD COLUMN IF NOT EXISTS custom_industry_text text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS rejection_reason_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_token text,
  ADD COLUMN IF NOT EXISTS admin_token_expires_at timestamptz;

-- Part C: backfill legal_company_name
UPDATE public.companies
SET legal_company_name = company_name
WHERE legal_company_name IS NULL
  AND company_name IS NOT NULL;

-- Part D: partial unique index on admin_token
CREATE UNIQUE INDEX IF NOT EXISTS companies_admin_token_idx
  ON public.companies(admin_token)
  WHERE admin_token IS NOT NULL;

-- Part E: custom industry length guard
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'companies_custom_industry_text_length'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_custom_industry_text_length
      CHECK (
        custom_industry_text IS NULL OR
        char_length(custom_industry_text) <= 100
      );
  END IF;
END $$;

-- Part F: blocked free-domain guard
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'companies_business_email_not_free_domain'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_business_email_not_free_domain
      CHECK (
        business_email IS NULL OR (
          lower(split_part(business_email, '@', 2)) NOT IN
          ('gmail.com', 'yahoo.com')
        )
      );
  END IF;
END $$;

