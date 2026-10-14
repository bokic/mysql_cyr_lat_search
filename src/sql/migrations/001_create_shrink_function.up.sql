-- =====================================================================
-- MySQL Stored Function: SHRINK_CYR_LAT
-- Purpose: Symmetric cross-script charset shrinking for Cyrillic and Latin
--          collapsing digraphs (ch->c, sh->s, zh->z, gj->g, kj->k, ya->ja, etc.)
--          and Cyrillic (ч->c, ѓ->g, ќ->k, я->ja, ю->ju, etc.) down to base ASCII.
-- =====================================================================

DROP FUNCTION IF EXISTS SHRINK_CYR_LAT;

DELIMITER $$

CREATE FUNCTION SHRINK_CYR_LAT(input TEXT CHARACTER SET utf8mb4) 
RETURNS TEXT CHARACTER SET utf8mb4
DETERMINISTIC
NO SQL
BEGIN
    DECLARE res TEXT CHARACTER SET utf8mb4;
    IF input IS NULL THEN 
        RETURN NULL; 
    END IF;
    
    -- 1. Convert to lowercase
    SET res = LOWER(input);
    
    -- 2. Latin Multi-Character Digraphs & Trigraphs (Order matters: trigraphs before digraphs)
    SET res = REPLACE(res, 'shch', 'st');
    SET res = REPLACE(res, 'sht',  'st');
    SET res = REPLACE(res, 'dzh',  'd');
    SET res = REPLACE(res, 'dž',   'd');
    SET res = REPLACE(res, 'dj',   'd');
    SET res = REPLACE(res, 'dz',   'z');
    SET res = REPLACE(res, 'gj',   'g');
    SET res = REPLACE(res, 'kj',   'k');
    SET res = REPLACE(res, 'lj',   'l');
    SET res = REPLACE(res, 'nj',   'n');
    SET res = REPLACE(res, 'ch',   'c');
    SET res = REPLACE(res, 'sh',   's');
    SET res = REPLACE(res, 'zh',   'z');
    SET res = REPLACE(res, 'ts',   'c');
    SET res = REPLACE(res, 'tz',   'c');
    SET res = REPLACE(res, 'kh',   'h');
    SET res = REPLACE(res, 'ya',   'ja');
    SET res = REPLACE(res, 'yu',   'ju');
    
    -- 3. Latin Accented Letters & Diacritics (Gaj's alphabet, Central/South Slavic & European)
    SET res = REPLACE(res, 'č', 'c');
    SET res = REPLACE(res, 'ć', 'c');
    SET res = REPLACE(res, 'ç', 'c');
    SET res = REPLACE(res, 'š', 's');
    SET res = REPLACE(res, 'ś', 's');
    SET res = REPLACE(res, 'ş', 's');
    SET res = REPLACE(res, 'ș', 's');
    SET res = REPLACE(res, 'ž', 'z');
    SET res = REPLACE(res, 'ź', 'z');
    SET res = REPLACE(res, 'ż', 'z');
    SET res = REPLACE(res, 'đ', 'd');
    SET res = REPLACE(res, 'ď', 'd');
    SET res = REPLACE(res, 'ť', 't');
    SET res = REPLACE(res, 'ň', 'n');
    SET res = REPLACE(res, 'ñ', 'n');
    SET res = REPLACE(res, 'ľ', 'l');
    SET res = REPLACE(res, 'ĺ', 'l');
    SET res = REPLACE(res, 'ł', 'l');
    SET res = REPLACE(res, 'ŕ', 'r');
    SET res = REPLACE(res, 'ř', 'r');
    SET res = REPLACE(res, 'w', 'v');
    SET res = REPLACE(res, 'q', 'k');
    SET res = REPLACE(res, 'x', 'ks');

    -- 4. Cyrillic Digraphs / Affricates / Sibilants (Shrink to single base Latin character)
    SET res = REPLACE(res, 'ч', 'c');  -- ch -> c
    SET res = REPLACE(res, 'ш', 's');  -- sh -> s
    SET res = REPLACE(res, 'ж', 'z');  -- zh -> z
    SET res = REPLACE(res, 'ц', 'c');  -- ts -> c
    SET res = REPLACE(res, 'щ', 'st'); -- sht/shch -> st
    SET res = REPLACE(res, 'х', 'h');  -- kh -> h
    SET res = REPLACE(res, 'џ', 'd');  -- dzh -> d
    SET res = REPLACE(res, 'ђ', 'd');  -- Serbian dj -> d
    SET res = REPLACE(res, 'ћ', 'c');  -- Serbian soft c -> c
    SET res = REPLACE(res, 'ѓ', 'g');  -- Macedonian gj -> g
    SET res = REPLACE(res, 'ќ', 'k');  -- Macedonian kj -> k
    SET res = REPLACE(res, 'ѕ', 'z');  -- Macedonian dz -> z
    SET res = REPLACE(res, 'љ', 'l');  -- lj -> l
    SET res = REPLACE(res, 'њ', 'n');  -- nj -> n
    SET res = REPLACE(res, 'ґ', 'g');  -- Ukrainian ghe -> g
    SET res = REPLACE(res, 'ў', 'u');  -- Belarusian short u -> u

    -- 5. Standard Cyrillic Letters to Base Latin
    SET res = REPLACE(res, 'а', 'a');
    SET res = REPLACE(res, 'б', 'b');
    SET res = REPLACE(res, 'в', 'v');
    SET res = REPLACE(res, 'г', 'g');
    SET res = REPLACE(res, 'д', 'd');
    SET res = REPLACE(res, 'е', 'e');
    SET res = REPLACE(res, 'ё', 'e');
    SET res = REPLACE(res, 'є', 'e');
    SET res = REPLACE(res, 'з', 'z');
    SET res = REPLACE(res, 'и', 'i');
    SET res = REPLACE(res, 'і', 'i');
    SET res = REPLACE(res, 'ї', 'i');
    SET res = REPLACE(res, 'й', 'j');
    SET res = REPLACE(res, 'ј', 'j');
    SET res = REPLACE(res, 'к', 'k');
    SET res = REPLACE(res, 'л', 'l');
    SET res = REPLACE(res, 'м', 'm');
    SET res = REPLACE(res, 'н', 'n');
    SET res = REPLACE(res, 'о', 'o');
    SET res = REPLACE(res, 'п', 'p');
    SET res = REPLACE(res, 'р', 'r');
    SET res = REPLACE(res, 'с', 's');
    SET res = REPLACE(res, 'т', 't');
    SET res = REPLACE(res, 'у', 'u');
    SET res = REPLACE(res, 'ф', 'f');
    SET res = REPLACE(res, 'ъ', 'a');
    SET res = REPLACE(res, 'ь', '');
    SET res = REPLACE(res, 'ы', 'i');
    SET res = REPLACE(res, 'э', 'e');
    SET res = REPLACE(res, 'ю', 'ju');
    SET res = REPLACE(res, 'я', 'ja');

    -- 6. Informal SMS / Leet Slang (4 for ч/c, 6 for ш/s)
    SET res = REPLACE(res, '4', 'c');
    SET res = REPLACE(res, '6', 's');

    RETURN res;
END$$

DELIMITER ;

-- =====================================================================
-- MySQL Stored Function: SHRINK_FOR_LIKE
-- Purpose: Prepares a search parameter for SQL LIKE queries by
--          shrinking Cyrillic/Latin characters via SHRINK_CYR_LAT() and
--          escaping %, _, and \ to prevent accidental wildcard injection.
-- =====================================================================

DROP FUNCTION IF EXISTS SHRINK_FOR_LIKE;

DELIMITER $$

CREATE FUNCTION SHRINK_FOR_LIKE(input TEXT CHARACTER SET utf8mb4) 
RETURNS TEXT CHARACTER SET utf8mb4
DETERMINISTIC
NO SQL
BEGIN
    DECLARE res TEXT CHARACTER SET utf8mb4;
    IF input IS NULL THEN 
        RETURN NULL; 
    END IF;
    
    SET res = SHRINK_CYR_LAT(input);
    
    -- Escape backslash first to prevent double-escaping
    SET res = REPLACE(res, '\\', '\\\\');
    -- Escape SQL LIKE wildcards (% and _)
    SET res = REPLACE(res, '%', '\\%');
    SET res = REPLACE(res, '_', '\\_');
    
    RETURN res;
END$$

DELIMITER ;

