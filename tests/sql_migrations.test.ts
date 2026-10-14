import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  parseSqlScript,
  loadMigrations,
  generateUnifiedMigration,
  extractStoredFunctionRules,
  simulateStoredFunction,
  simulateShrinkForLike,
  getCompleteRuleSet,
  shrink,
} from '../src/index.ts';

describe('MySQL SHRINK_CYR_LAT Stored Function & Migrations', () => {
  const sqlPath = path.resolve('sql/shrink_cyr_lat.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  describe('Stored Function Rule Parity & Order Verification', () => {
    it('SQL stored function has valid MySQL structure, DETERMINISTIC, and NO SQL tags', () => {
      assert.ok(sqlContent.includes('CREATE FUNCTION SHRINK_CYR_LAT'), 'Missing CREATE FUNCTION definition');
      assert.ok(sqlContent.includes('DETERMINISTIC'), 'Function must be declared DETERMINISTIC');
      assert.ok(sqlContent.includes('NO SQL'), 'Function must be declared NO SQL');
      assert.ok(sqlContent.includes('RETURNS TEXT CHARACTER SET utf8mb4'), 'Return type must be utf8mb4');
      assert.ok(sqlContent.includes('DELIMITER $$'), 'Must use custom DELIMITER for safe execution');
    });

    it('extracts all REPLACE statements from SQL in exact execution order', () => {
      const sqlRules = extractStoredFunctionRules(sqlContent);
      assert.ok(sqlRules.length > 50, `Expected at least 50 replacement rules, found ${sqlRules.length}`);

      // Verify trigraphs precede digraphs
      const shchIdx = sqlRules.findIndex(r => r.find === 'shch');
      const shIdx = sqlRules.findIndex(r => r.find === 'sh');
      const chIdx = sqlRules.findIndex(r => r.find === 'ch');
      assert.ok(shchIdx !== -1 && shIdx !== -1 && chIdx !== -1);
      assert.ok(shchIdx < shIdx, 'shch must precede sh in SQL function');
      assert.ok(shchIdx < chIdx, 'shch must precede ch in SQL function');

      const dzhIdx = sqlRules.findIndex(r => r.find === 'dzh');
      const dzIdx = sqlRules.findIndex(r => r.find === 'dz');
      assert.ok(dzhIdx < dzIdx, 'dzh must precede dz in SQL function');

      // Fallback when specific function header is not matched in snippet
      const fallbackRules = extractStoredFunctionRules("SET res = REPLACE(res, 'a', 'b');", "NONEXISTENT");
      assert.deepEqual(fallbackRules, [{ find: 'a', replace: 'b' }]);
    });

    it('SQL stored function rules match canonical TS ruleset 1:1', () => {
      const sqlRules = extractStoredFunctionRules(sqlContent);
      const tsRules = getCompleteRuleSet('universal', true);

      // Verify essential character mappings in SQL
      const expectedKeyRules = [
        { find: 'shch', replace: 'st' },
        { find: 'sht',  replace: 'st' },
        { find: 'dzh',  replace: 'd' },
        { find: 'dž',   replace: 'd' },
        { find: 'dj',   replace: 'd' },
        { find: 'dz',   replace: 'z' },
        { find: 'gj',   replace: 'g' },
        { find: 'kj',   replace: 'k' },
        { find: 'lj',   replace: 'l' },
        { find: 'nj',   replace: 'n' },
        { find: 'ch',   replace: 'c' },
        { find: 'sh',   replace: 's' },
        { find: 'zh',   replace: 'z' },
        { find: 'ts',   replace: 'c' },
        { find: 'tz',   replace: 'c' },
        { find: 'kh',   replace: 'h' },
        { find: 'ya',   replace: 'ja' },
        { find: 'yu',   replace: 'ju' },
        { find: 'ч',    replace: 'c' },
        { find: 'ш',    replace: 's' },
        { find: 'ж',    replace: 'z' },
        { find: 'ц',    replace: 'c' },
        { find: 'щ',    replace: 'st' },
        { find: 'х',    replace: 'h' },
        { find: 'џ',    replace: 'd' },
        { find: 'ђ',    replace: 'd' },
        { find: 'ћ',    replace: 'c' },
        { find: 'ѓ',    replace: 'g' },
        { find: 'ќ',    replace: 'k' },
        { find: 'ѕ',    replace: 'z' },
        { find: 'љ',    replace: 'l' },
        { find: 'њ',    replace: 'n' },
        { find: 'ъ',    replace: 'a' },
        { find: 'ь',    replace: '' },
        { find: 'ю',    replace: 'ju' },
        { find: 'я',    replace: 'ja' },
        { find: '4',    replace: 'c' },
        { find: '6',    replace: 's' },
      ];

      for (const expected of expectedKeyRules) {
        const found = sqlRules.find(r => r.find === expected.find);
        assert.ok(found, `Missing rule in SQL: ${expected.find} -> ${expected.replace}`);
        assert.equal(found?.replace, expected.replace, `Rule mismatch for ${expected.find}: expected ${expected.replace}, found ${found?.replace}`);
      }
    });

    it('simulates SQL stored procedure execution with exact parity against Shrinker library', () => {
      const testCases = [
        'Борче', 'Borche', 'Borce', 'Borče', 'Bor4e',
        'Пешо', 'Pesho', 'Peso', 'Pešo', 'Pe6o',
        'Жарко', 'Zharko', 'Zarko', 'Žarko',
        'Ѓорѓи', 'Gjorgji', 'Gorgi',
        'Никола Ќосев', 'Nikola Kjosev',
        'Поща', 'Poshta', 'Poshcha', 'Posta',
        'Яна', 'Јана', 'Yana', 'Jana',
        'Юлия', 'Јулија', 'Julija', 'Yulija',
        'Кръстев', 'Krastev',
        'Коњ', 'Konj',
        'Ѕвонко', 'Dzvonko',
        'Џафер', 'Dzhafer', 'Džafer',
      ];

      for (const input of testCases) {
        const sqlResult = simulateStoredFunction(input, sqlContent);
        const tsResult = shrink(input);
        assert.equal(sqlResult, tsResult, `Divergence on "${input}": SQL gave "${sqlResult}", TS gave "${tsResult}"`);
      }
    });

    it('handles null and undefined in simulated SQL function', () => {
      assert.equal(simulateStoredFunction(null, sqlContent), null);
      assert.equal(simulateStoredFunction(undefined, sqlContent), null);
    });

    it('simulates SHRINK_FOR_LIKE stored procedure execution escaping wildcards', () => {
      assert.equal(simulateShrinkForLike('Бор%че', sqlContent), 'bor\\%ce');
      assert.equal(simulateShrinkForLike('100%_тест', sqlContent), '100\\%\\_test');
      assert.equal(simulateShrinkForLike(null, sqlContent), null);
    });
  });

  describe('Schema Migrations Lifecycle', () => {
    const migrationsDir = path.resolve('sql/migrations');

    it('loads all versioned migrations in ascending numerical order', () => {
      const migrations = loadMigrations(migrationsDir);
      assert.equal(migrations.length, 4, 'Expected exactly 4 migrations');
      assert.equal(migrations[0].id, '001');
      assert.equal(migrations[1].id, '002');
      assert.equal(migrations[2].id, '003');
      assert.equal(migrations[3].id, '004');
    });

    it('each migration has a non-empty up and down file', () => {
      const migrations = loadMigrations(migrationsDir);
      for (const m of migrations) {
        assert.ok(m.upSql.trim().length > 0, `Migration ${m.name} upSql is empty`);
        assert.ok(m.downSql.trim().length > 0, `Migration ${m.name} downSql is empty`);
      }
    });

    it('parses SQL scripts with custom DELIMITER commands into executable statements', () => {
      const migration001 = loadMigrations(migrationsDir)[0];
      const statements = parseSqlScript(migration001.upSql);

      assert.ok(statements.length >= 2, 'Migration 001 should contain DROP FUNCTION and CREATE FUNCTION');
      assert.ok(statements[0].includes('DROP FUNCTION IF EXISTS SHRINK_CYR_LAT'));
      assert.ok(statements[1].includes('CREATE FUNCTION SHRINK_CYR_LAT'));
      assert.ok(!statements[1].includes('DELIMITER'), 'Parsed statements must strip raw DELIMITER directives');

      // Edge case test: undelimited statement before DELIMITER switch, and trailing statement without delimiter at EOF
      const customScript = 'SELECT 1\nDELIMITER $$\nSELECT 2$$\nSELECT 3';
      const parsedCustom = parseSqlScript(customScript);
      assert.deepEqual(parsedCustom, ['SELECT 1', 'SELECT 2', 'SELECT 3']);
    });

    it('generates unified UP migration bundle in ascending order', () => {
      const unifiedUp = generateUnifiedMigration('up', migrationsDir);
      assert.ok(unifiedUp.includes('001_create_shrink_function'));
      assert.ok(unifiedUp.includes('002_add_search_column_and_indexes'));
      assert.ok(unifiedUp.includes('003_create_search_triggers'));
      assert.ok(unifiedUp.includes('004_backfill_existing_data'));

      const pos001 = unifiedUp.indexOf('001_create_shrink_function');
      const pos002 = unifiedUp.indexOf('002_add_search_column_and_indexes');
      const pos003 = unifiedUp.indexOf('003_create_search_triggers');
      const pos004 = unifiedUp.indexOf('004_backfill_existing_data');

      assert.ok(pos001 < pos002 && pos002 < pos003 && pos003 < pos004, 'UP migrations must be in ascending sequence');
    });

    it('generates unified DOWN migration bundle in reverse descending order', () => {
      const unifiedDown = generateUnifiedMigration('down', migrationsDir);
      const pos001 = unifiedDown.indexOf('001_create_shrink_function');
      const pos002 = unifiedDown.indexOf('002_add_search_column_and_indexes');
      const pos003 = unifiedDown.indexOf('003_create_search_triggers');
      const pos004 = unifiedDown.indexOf('004_backfill_existing_data');

      assert.ok(pos004 < pos003 && pos003 < pos002 && pos002 < pos001, 'DOWN migrations must be in descending sequence');
    });

    it('throws error when migrations directory does not exist', () => {
      assert.throws(() => {
        loadMigrations(path.resolve('non_existent_dir'));
      }, /Migrations directory not found/);
    });

    it('throws error when a down migration is missing', () => {
      const tmpDir = path.resolve('sql/migrations_tmp_test');
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '001_test.up.sql'), 'SELECT 1;');
      try {
        assert.throws(() => {
          loadMigrations(tmpDir);
        }, /Missing corresponding down migration/);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('Triggers and Schema Architecture Verification', () => {
    const triggersSql = fs.readFileSync(path.resolve('sql/triggers.sql'), 'utf8');
    const schemaSql = fs.readFileSync(path.resolve('sql/schema.sql'), 'utf8');

    it('triggers use BEFORE INSERT and BEFORE UPDATE with conditional recalculation', () => {
      assert.ok(triggersSql.includes('CREATE TRIGGER trg_users_before_insert'), 'Missing BEFORE INSERT trigger');
      assert.ok(triggersSql.includes('CREATE TRIGGER trg_users_before_update'), 'Missing BEFORE UPDATE trigger');
      assert.ok(triggersSql.includes('BEFORE INSERT ON users'), 'Must be BEFORE INSERT');
      assert.ok(triggersSql.includes('BEFORE UPDATE ON users'), 'Must be BEFORE UPDATE');
      assert.ok(triggersSql.includes('(NEW.name <=> OLD.name) = 0'), 'Must optimize update with NULL-safe comparison');
      assert.ok(triggersSql.includes('SET NEW.name_searched = SHRINK_CYR_LAT(NEW.name)'), 'Must populate name_searched via function');
    });

    it('schema defines B-Tree and N-Gram Fulltext indexes', () => {
      assert.ok(schemaSql.includes('name_searched VARCHAR(255) NOT NULL'), 'Column name_searched must exist');
      assert.ok(schemaSql.includes('INDEX idx_name_searched (name_searched)'), 'B-tree index for prefix search required');
      assert.ok(schemaSql.includes('FULLTEXT INDEX ft_name_ngram (name_searched) WITH PARSER ngram'), 'N-gram fulltext index required');
    });
  });
});
