-- =====================================================================
-- Migration: 002_add_search_column_and_indexes.up.sql
-- Description: Adds name_searched column, B-Tree index, and N-gram fulltext index
-- =====================================================================

-- 1. Create table users if it does not exist
CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    name_searched VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name_searched (name_searched),
    FULLTEXT INDEX ft_name_ngram (name_searched) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
