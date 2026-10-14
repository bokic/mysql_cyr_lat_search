-- =====================================================================
-- Migration: 002_add_search_column_and_indexes.down.sql
-- Description: Reverts 002 by dropping the users table
-- =====================================================================

DROP TABLE IF EXISTS users;
