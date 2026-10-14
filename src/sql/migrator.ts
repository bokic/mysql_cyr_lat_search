/**
 * @file migrator.ts
 * @description Schema migration loader, SQL statement parser, and stored function validator.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface MigrationFile {
  readonly id: string;
  readonly name: string;
  readonly upPath: string;
  readonly downPath: string;
  readonly upSql: string;
  readonly downSql: string;
}

export interface SqlReplacementRule {
  readonly find: string;
  readonly replace: string;
}

function stripComments(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map(line => line.trim().startsWith('--') ? '' : line)
    .join('\n')
    .trim();
}

/**
 * Parses a raw SQL script into discrete executable SQL statements,
 * taking MySQL custom DELIMITER commands into account.
 *
 * @param sqlContent The SQL file contents.
 * @returns Array of individual executable SQL statements.
 */
export function parseSqlScript(sqlContent: string): string[] {
  const statements: string[] = [];
  const lines = sqlContent.split(/\r?\n/);

  let currentDelimiter = ';';
  let buffer = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Handle delimiter switch
    const delimiterMatch = trimmed.match(/^DELIMITER\s+(.+)$/i);
    if (delimiterMatch) {
      const clean = stripComments(buffer);
      if (clean) {
        statements.push(clean);
      }
      buffer = '';
      currentDelimiter = delimiterMatch[1].trim();
      continue;
    }

    buffer += line + '\n';

    // Check if buffer ends with the current delimiter
    const trimmedBuffer = buffer.trimEnd();
    if (trimmedBuffer.endsWith(currentDelimiter)) {
      const stmt = trimmedBuffer.slice(0, trimmedBuffer.length - currentDelimiter.length);
      const clean = stripComments(stmt);
      if (clean) {
        statements.push(clean);
      }
      buffer = '';
    }
  }

  const remaining = stripComments(buffer);
  if (remaining) {
    statements.push(remaining);
  }

  return statements;
}

/**
 * Loads all versioned migration files from a directory, sorted numerically.
 *
 * @param migrationsDir Directory containing *.up.sql and *.down.sql files.
 * @returns Sorted array of MigrationFile descriptors.
 */
export function loadMigrations(migrationsDir: string = path.resolve('sql/migrations')): MigrationFile[] {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  const files = fs.readdirSync(migrationsDir);
  const upFiles = files.filter(f => f.endsWith('.up.sql')).sort();

  const migrations: MigrationFile[] = [];

  for (const upFile of upFiles) {
    const baseName = upFile.replace(/\.up\.sql$/, '');
    const downFile = `${baseName}.down.sql`;
    const id = baseName.split('_')[0];

    const upPath = path.join(migrationsDir, upFile);
    const downPath = path.join(migrationsDir, downFile);

    if (!fs.existsSync(downPath)) {
      throw new Error(`Missing corresponding down migration for: ${upFile}`);
    }

    migrations.push({
      id,
      name: baseName,
      upPath,
      downPath,
      upSql: fs.readFileSync(upPath, 'utf8'),
      downSql: fs.readFileSync(downPath, 'utf8'),
    });
  }

  return migrations;
}

/**
 * Generates a unified, single-file migration bundle for automated execution or CI/CD pipelines.
 *
 * @param direction 'up' (applied in numeric order) or 'down' (reverted in reverse numeric order).
 * @param migrationsDir Migrations directory path.
 * @returns Combined SQL string.
 */
export function generateUnifiedMigration(
  direction: 'up' | 'down' = 'up',
  migrationsDir: string = path.resolve('sql/migrations')
): string {
  const migrations = loadMigrations(migrationsDir);
  const ordered = direction === 'up' ? migrations : [...migrations].reverse();

  let output = `-- Auto-generated unified cross-script migration: ${direction.toUpperCase()}\n\n`;

  for (const m of ordered) {
    output += `-- =====================================================================\n`;
    output += `-- Migration: ${m.name} (${direction.toUpperCase()})\n`;
    output += `-- =====================================================================\n\n`;
    output += (direction === 'up' ? m.upSql : m.downSql).trim() + '\n\n';
  }

  return output;
}

/**
 * Parses the MySQL stored function SQL source code and extracts
 * all REPLACE(res, '...', '...') statements in their exact order of execution.
 *
 * @param sqlContent Content of shrink_cyr_lat.sql or 001_create_shrink_function.up.sql.
 * @param functionName Target function name (defaults to 'SHRINK_CYR_LAT').
 * @returns Array of { find, replace } rules extracted from the SQL code.
 */
export function extractStoredFunctionRules(sqlContent: string, functionName: string = 'SHRINK_CYR_LAT'): SqlReplacementRule[] {
  const funcRegex = new RegExp(`CREATE\\s+FUNCTION\\s+${functionName}[\\s\\S]*?END\\$\\$`, 'i');
  const funcMatch = funcRegex.exec(sqlContent);
  const targetContent = funcMatch ? funcMatch[0] : sqlContent;

  const rules: SqlReplacementRule[] = [];
  // Matches REPLACE(res, 'find', 'replace')
  const regex = /SET\s+res\s*=\s*REPLACE\s*\(\s*res\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)\s*;/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(targetContent)) !== null) {
    rules.push({
      find: match[1],
      replace: match[2],
    });
  }

  return rules;
}

/**
 * Simulates the exact execution of the MySQL SHRINK_CYR_LAT stored function
 * based on the REPLACE statements extracted directly from the SQL file.
 *
 * @param input Input string.
 * @param sqlContent Content of the SQL file containing SHRINK_CYR_LAT.
 * @returns Normalized shrunk string.
 */
export function simulateStoredFunction(input: string | null | undefined, sqlContent: string): string | null {
  if (input === null || input === undefined) {
    return null;
  }

  const rules = extractStoredFunctionRules(sqlContent, 'SHRINK_CYR_LAT');
  let res = input.toLowerCase();

  for (const rule of rules) {
    res = res.replaceAll(rule.find, rule.replace);
  }

  return res;
}

/**
 * Simulates the exact execution of MySQL SHRINK_FOR_LIKE stored function.
 *
 * @param input Input string.
 * @param sqlContent Content of SQL file containing SHRINK_FOR_LIKE.
 * @returns Escaped shrunk string for LIKE queries.
 */
export function simulateShrinkForLike(input: string | null | undefined, sqlContent: string): string | null {
  const shrunk = simulateStoredFunction(input, sqlContent);
  if (shrunk === null) {
    return null;
  }
  return shrunk
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_');
}
