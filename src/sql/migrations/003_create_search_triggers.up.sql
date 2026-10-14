-- =====================================================================
-- Migration: 003_create_search_triggers.up.sql
-- Description: Creates BEFORE INSERT and BEFORE UPDATE triggers
--              to automatically synchronize name_searched using SHRINK_CYR_LAT()
-- =====================================================================

DELIMITER $$

-- 1. Trigger executed before inserting a new user
DROP TRIGGER IF EXISTS trg_users_before_insert$$
CREATE TRIGGER trg_users_before_insert
BEFORE INSERT ON users 
FOR EACH ROW
BEGIN
    IF NEW.name IS NOT NULL THEN
        SET NEW.name_searched = SHRINK_CYR_LAT(NEW.name);
    END IF;
END$$

-- 2. Trigger executed before updating an existing user
DROP TRIGGER IF EXISTS trg_users_before_update$$
CREATE TRIGGER trg_users_before_update
BEFORE UPDATE ON users 
FOR EACH ROW
BEGIN
    -- Performance optimization: Only recalculate if 'name' was modified
    IF (NEW.name <=> OLD.name) = 0 THEN
        IF NEW.name IS NOT NULL THEN
            SET NEW.name_searched = SHRINK_CYR_LAT(NEW.name);
        ELSE
            SET NEW.name_searched = NULL;
        END IF;
    END IF;
END$$

DELIMITER ;
