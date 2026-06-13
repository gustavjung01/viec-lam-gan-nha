-- Migration: Affiliate Campaign Refactor & Push Logic
-- Date: 2026-06-03

-- 1. Alter companies table
ALTER TABLE companies ADD COLUMN trust_level TEXT DEFAULT 'normal';
ALTER TABLE companies ADD COLUMN deposit_status TEXT DEFAULT 'none';
ALTER TABLE companies ADD COLUMN lead_trial_limit INTEGER DEFAULT 2;
ALTER TABLE companies ADD COLUMN free_job_posts_limit INTEGER DEFAULT 5;
ALTER TABLE companies ADD COLUMN weekly_push_limit INTEGER DEFAULT 5;
ALTER TABLE companies ADD COLUMN require_deposit_after_leads INTEGER DEFAULT 2;
ALTER TABLE companies ADD COLUMN plan_code TEXT DEFAULT 'free';
ALTER TABLE companies ADD COLUMN plan_expired_at TEXT;
ALTER TABLE companies ADD COLUMN is_featured INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN used_job_posts_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN used_push_count INTEGER DEFAULT 0;

-- 2. Alter campaigns table
ALTER TABLE campaigns ADD COLUMN is_public INTEGER DEFAULT 1;
ALTER TABLE campaigns ADD COLUMN ctv_enabled INTEGER DEFAULT 1;
ALTER TABLE campaigns ADD COLUMN promoted_until TEXT;

-- 3. Data Migration for campaigns visibility
UPDATE campaigns 
SET 
  is_public = CASE 
    WHEN visibility = 'public_candidate' THEN 1 
    WHEN visibility = 'internal' THEN 0 
    ELSE 1 
  END, 
  ctv_enabled = CASE 
    WHEN visibility = 'ctv_private' THEN 1 
    WHEN visibility = 'internal' THEN 0 
    ELSE 1 
  END;

-- Optional: You can drop visibility column later if desired, SQLite requires table recreation for DROP COLUMN natively depending on version.