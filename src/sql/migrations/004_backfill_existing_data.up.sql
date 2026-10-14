-- =====================================================================
-- Migration: 004_backfill_existing_data.up.sql
-- Description: Backfills name_searched for any pre-existing records
-- =====================================================================

UPDATE users 
SET name_searched = SHRINK_CYR_LAT(name)
WHERE name IS NOT NULL 
  AND (name_searched IS NULL OR name_searched = '');
