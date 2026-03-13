-- Add new project types to carbon_project_type_enum.
-- Run each statement separately in Supabase SQL editor.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block.

ALTER TYPE carbon_project_type_enum
  ADD VALUE IF NOT EXISTS 'agricultural';

ALTER TYPE carbon_project_type_enum
  ADD VALUE IF NOT EXISTS 'windmill';
