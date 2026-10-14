# MySQL & MariaDB Setup Guide

This guide covers database schema design, stored function deployment, trigger automation, indexing strategies, and query patterns for **`mysql-cyr-lat-search`**.

---

## 1. Complete Database Schema

To support cross-script search, add a dedicated search column (e.g. `name_searched`) alongside your original column (`name`):

```sql
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    
    -- Dedicated search column storing the base-folded ASCII key
    name_searched VARCHAR(255) NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- 1. B-Tree index for prefix searches (e.g. WHERE name_searched LIKE 'borce%')
    INDEX idx_name_searched (name_searched),
    
    -- 2. N-Gram fulltext index for arbitrary substring searches (LIKE '%borce%')
    FULLTEXT INDEX ft_name_ngram (name_searched) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

---

## 2. Stored Functions: `SHRINK_CYR_LAT` vs. `SHRINK_FOR_LIKE`

Two distinct stored functions are provided, serving two different purposes:

### 2.1 `SHRINK_CYR_LAT(input)` — For DB Storage & Ingestion
- **Usage**: Called inside triggers or data backfills.
- **Behavior**: Deterministically collapses Cyrillic, digraphs, accents, and leet slang into base ASCII.
- **Wildcard Invariant**: **Does NOT escape `%` or `_`**. (A product named `"100% Pure"` is stored as `"100% pure"` on disk, NOT `"100\% pure"`).

### 2.2 `SHRINK_FOR_LIKE(input)` — For Safe Query Filters
- **Usage**: Called when building dynamic SQL `WHERE` clauses directly in the database.
- **Behavior**: Runs `SHRINK_CYR_LAT()` and safely escapes SQL wildcards (`%` → `\%`, `_` → `\_`, `\` → `\\`).
- **Example**: Searching for `100%` shrinks to `100\%`, ensuring `%` is matched literally rather than matching all subsequent characters.

### Installation
Deploy the stored functions by applying [sql/shrink_cyr_lat.sql](file:///home/boris/projects/mysql_cyr_lat_search/sql/shrink_cyr_lat.sql):
```bash
mysql -u root -p database_name < sql/shrink_cyr_lat.sql
```

---

## 3. Automated Synchronization via Triggers

Using `BEFORE` triggers guarantees zero application-layer code changes. Any `INSERT` or `UPDATE` automatically keeps `name_searched` in sync.

```sql
DELIMITER $$

-- Trigger on INSERT
DROP TRIGGER IF EXISTS trg_users_before_insert$$
CREATE TRIGGER trg_users_before_insert
BEFORE INSERT ON users 
FOR EACH ROW
BEGIN
    IF NEW.name IS NOT NULL THEN
        SET NEW.name_searched = SHRINK_CYR_LAT(NEW.name);
    END IF;
END$$

-- Trigger on UPDATE
DROP TRIGGER IF EXISTS trg_users_before_update$$
CREATE TRIGGER trg_users_before_update
BEFORE UPDATE ON users 
FOR EACH ROW
BEGIN
    -- Only recalculate if 'name' was actually modified
    IF (NEW.name <=> OLD.name) = 0 THEN
        IF NEW.name IS NOT NULL THEN
            SET NEW.name_searched = SHRINK_CYR_LAT(NEW.name);
        ELSE
            SET NEW.name_searched = NULL;
        END IF;
    END IF;
END$$

DELIMITER ;
```

### Why `BEFORE` Triggers Are Optimal:
1. **Direct In-Memory Mutation**: Mutates `NEW.name_searched` directly before InnoDB writes the row to disk. No second `UPDATE` statement or row lock is needed.
2. **Conditional Optimization**: `(NEW.name <=> OLD.name) = 0` detects changes. If another query modifies `email` or `status`, MySQL bypasses the stored function entirely.
3. **ORM & Tool Independent**: Works transparently whether rows are written by Prisma, TypeORM, raw SQL, Sequelize, or direct CLI imports.

---

## 4. Alternative: Stored Generated Columns (MySQL 8.0.13+)

If your MySQL server allows deterministic stored functions in generated columns:

```sql
ALTER TABLE users 
ADD COLUMN name_searched VARCHAR(255) 
GENERATED ALWAYS AS (SHRINK_CYR_LAT(name)) STORED;
```

> **Note on Compatibility**: In standard MySQL 8.0, user-defined functions (UDFs) in generated columns may be restricted depending on server security configurations. Triggers are universally supported on all MySQL and MariaDB versions.

---

## 5. Indexing & Query Patterns

### Pattern 1: Application-Level Parameter Escaping (Fastest)
The backend / API shrinks the query parameter and escapes wildcards before executing the prepared statement:

```sql
-- Client inputs: "Борче"
-- App backend: shrinkForLike("Борче") -> "borce"
SELECT * FROM users 
WHERE name_searched LIKE '%borce%';
```
*Index usage: If prefix search `borce%`, utilizes B-Tree `idx_name_searched` directly.*

### Pattern 2: Pure SQL Stored Function Query
If you cannot or do not want to run shrinking on the application layer:

```sql
SELECT * FROM users 
WHERE name_searched LIKE CONCAT('%', SHRINK_FOR_LIKE('Борче'), '%');
```

### Pattern 3: Substring Search with N-Gram Index (Large Tables)
Standard `LIKE '%term%'` cannot use regular B-Tree indexes because of the leading `%`. For million-row datasets, an N-Gram fulltext index provides instant substring matching:

```sql
SELECT * FROM users 
WHERE MATCH(name_searched) AGAINST(SHRINK_CYR_LAT('Борче') IN BOOLEAN MODE);
```

---

## 6. Migration Guide (Versioned SQL Migrations)

The repository provides ordered, reversible migrations in [sql/migrations/](file:///home/boris/projects/mysql_cyr_lat_search/sql/migrations):

1. **`001_create_shrink_function.up.sql`**: Deploys `SHRINK_CYR_LAT()` and `SHRINK_FOR_LIKE()` functions.
2. **`002_add_search_column_and_indexes.up.sql`**: Adds `name_searched` with B-Tree and N-Gram fulltext indexes.
3. **`003_create_search_triggers.up.sql`**: Installs `BEFORE INSERT` and `BEFORE UPDATE` triggers.
4. **`004_backfill_existing_data.up.sql`**: Backfills `name_searched = SHRINK_CYR_LAT(name)` for existing rows.
