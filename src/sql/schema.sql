-- =====================================================================
-- Full Demo Schema: users table with shrunk cross-script search index
-- =====================================================================

DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    
    -- Dedicated search column storing the base-folded representation
    name_searched VARCHAR(255) NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- B-Tree Index for prefix search (WHERE name_searched LIKE 'borce%')
    INDEX idx_name_searched (name_searched),
    
    -- N-Gram Fulltext index for arbitrary substring search (WHERE name_searched LIKE '%borce%')
    FULLTEXT INDEX ft_name_ngram (name_searched) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
