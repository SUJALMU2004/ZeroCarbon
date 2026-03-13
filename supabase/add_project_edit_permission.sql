-- Add one-time project edit permission fields.
-- Run in Supabase SQL editor. Idempotent migration.

ALTER TABLE public.carbon_projects
  ADD COLUMN IF NOT EXISTS edit_permitted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS edit_token TEXT,
  ADD COLUMN IF NOT EXISTS edit_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edit_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edit_request_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS carbon_projects_edit_token_idx
  ON public.carbon_projects (edit_token)
  WHERE edit_token IS NOT NULL;

