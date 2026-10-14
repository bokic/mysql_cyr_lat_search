-- =====================================================================
-- Verification & Demo Script
-- Run: mysql -u <user> -p <database> < sql/demo.sql
-- =====================================================================

-- 1. Insert records using normal application syntax (zero mention of name_searched)
INSERT INTO users (name, email) VALUES
('Борче Николов', 'borce.nikolov@example.com'),
('Borche Trajkov', 'borche.t@example.com'),
('Borce Stojanov', 'borce.s@example.com'),
('Borče Iliev', 'borce.i@example.com'),
('Пешо Петров', 'pesho@example.com'),
('Pesho Ivanov', 'pesho.i@example.com'),
('Peso Georgiev', 'peso.g@example.com'),
('Жарко Коцев', 'zharko@example.com'),
('Zharko Dimov', 'zharko.d@example.com');

-- 2. Inspect the table to verify triggers automatically populated name_searched
SELECT id, name, name_searched FROM users;

-- 3. Query using Cyrillic "Борче" -> matches all 4 variations (Борче, Borche, Borce, Borče)
SELECT * FROM users 
WHERE name_searched LIKE CONCAT('%', SHRINK_CYR_LAT('Борче'), '%');

-- 4. Query using Latin with digraph "pesho" -> matches Пешо, Pesho, Peso
SELECT * FROM users 
WHERE name_searched LIKE CONCAT('%', SHRINK_CYR_LAT('pesho'), '%');

-- 5. Query using Latin plain "peso" -> matches Пешо, Pesho, Peso
SELECT * FROM users 
WHERE name_searched LIKE CONCAT('%', SHRINK_CYR_LAT('peso'), '%');
