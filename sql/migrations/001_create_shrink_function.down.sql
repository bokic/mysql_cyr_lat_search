-- =====================================================================
-- Migration: 001_create_shrink_function.down.sql
-- Description: Reverts 001 by dropping the SHRINK_FOR_LIKE and SHRINK_CYR_LAT functions
-- =====================================================================

DROP FUNCTION IF EXISTS SHRINK_FOR_LIKE;
DROP FUNCTION IF EXISTS SHRINK_CYR_LAT;
