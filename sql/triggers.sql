-- =====================================================================
-- MySQL Triggers: trg_users_before_insert & trg_users_before_update
-- Purpose: Automatically synchronize the search column (name_searched)
--          on INSERT and UPDATE using the SHRINK_CYR_LAT() stored function.
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
    -- Only recompute if the name column has actually changed
    IF (NEW.name <=> OLD.name) = 0 THEN
        IF NEW.name IS NOT NULL THEN
            SET NEW.name_searched = SHRINK_CYR_LAT(NEW.name);
        ELSE
            SET NEW.name_searched = NULL;
        END IF;
    END IF;
END$$

DELIMITER ;
