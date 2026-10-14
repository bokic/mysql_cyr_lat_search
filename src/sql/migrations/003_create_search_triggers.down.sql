-- =====================================================================
-- Migration: 003_create_search_triggers.down.sql
-- Description: Reverts 003 by dropping before insert and before update triggers
-- =====================================================================

DROP TRIGGER IF EXISTS trg_users_before_insert;
DROP TRIGGER IF EXISTS trg_users_before_update;
