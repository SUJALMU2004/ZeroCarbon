-- ZeroCarbon satellite verification extension for carbon_projects.
-- Run manually in Supabase SQL Editor before deploying code changes.

ALTER TABLE public.carbon_projects
  ADD COLUMN IF NOT EXISTS satellite_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS satellite_ndvi_current numeric(6,4),
  ADD COLUMN IF NOT EXISTS satellite_ndvi_2020 numeric(6,4),
  ADD COLUMN IF NOT EXISTS satellite_ndvi_2022 numeric(6,4),
  ADD COLUMN IF NOT EXISTS satellite_ndvi_2024 numeric(6,4),
  ADD COLUMN IF NOT EXISTS satellite_ndvi_trend text,
  ADD COLUMN IF NOT EXISTS satellite_confidence_score integer,
  ADD COLUMN IF NOT EXISTS satellite_confidence_badge text,
  ADD COLUMN IF NOT EXISTS satellite_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS satellite_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS satellite_raw_response jsonb,
  ADD COLUMN IF NOT EXISTS satellite_error_message text,
  ADD COLUMN IF NOT EXISTS satellite_last_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_token text,
  ADD COLUMN IF NOT EXISTS admin_token_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS carbon_projects_satellite_status_idx
  ON public.carbon_projects(satellite_status);

CREATE UNIQUE INDEX IF NOT EXISTS carbon_projects_admin_token_idx
  ON public.carbon_projects(admin_token)
  WHERE admin_token IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'carbon_projects_satellite_status_check'
  ) THEN
    ALTER TABLE public.carbon_projects
      ADD CONSTRAINT carbon_projects_satellite_status_check
      CHECK (satellite_status IN ('pending', 'processing', 'completed', 'failed'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'carbon_projects_satellite_ndvi_trend_check'
  ) THEN
    ALTER TABLE public.carbon_projects
      ADD CONSTRAINT carbon_projects_satellite_ndvi_trend_check
      CHECK (satellite_ndvi_trend IS NULL OR satellite_ndvi_trend IN ('positive', 'flat', 'negative'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'carbon_projects_satellite_confidence_badge_check'
  ) THEN
    ALTER TABLE public.carbon_projects
      ADD CONSTRAINT carbon_projects_satellite_confidence_badge_check
      CHECK (satellite_confidence_badge IS NULL OR satellite_confidence_badge IN ('High', 'Medium', 'Low'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'carbon_projects_satellite_confidence_score_check'
  ) THEN
    ALTER TABLE public.carbon_projects
      ADD CONSTRAINT carbon_projects_satellite_confidence_score_check
      CHECK (
        satellite_confidence_score IS NULL
        OR (satellite_confidence_score >= 0 AND satellite_confidence_score <= 100)
      );
  END IF;
END $$;
