# TypeScript & Node.js SDK Guide

The **`mysql-cyr-lat-search`** TypeScript SDK provides a high-performance, standalone shrinker engine, SQL query builders, and database migration utilities.

---

## 1. Installation & Imports

```bash
npm install mysql-cyr-lat-search
```

### ES Module Import
```typescript
import {
  shrink,
  shrinkForLike,
  matches,
  contains,
  Shrinker,
  buildShrunkLike,
  buildSqlFunctionLike,
  buildNgramMatch,
} from 'mysql-cyr-lat-search';
```

---

## 2. Core Functional API

### `shrink(text, options?)`
Collapses any Cyrillic or Latin string into its canonical base ASCII representation:

```typescript
import { shrink } from 'mysql-cyr-lat-search';

shrink('Борче');   // 'borce'
shrink('Borche');  // 'borce'
shrink('Borče');   // 'borce'
shrink('Bor4e');   // 'borce'
shrink('Пешо');    // 'peso'
shrink('Pesho');   // 'peso'
shrink('Жарко');   // 'zarko'
shrink('Zharko');  // 'zarko'
```

### `shrinkForLike(text, options?)`
Shrinks the input and **safely escapes SQL wildcards** (`%` → `\%`, `_` → `\_`, `\` → `\\`). Use this whenever preparing parameters for SQL `LIKE` queries:

```typescript
import { shrinkForLike } from 'mysql-cyr-lat-search';

shrinkForLike('100%');        // '100\\%'
shrinkForLike('user_name');   // 'user\\_name'
shrinkForLike('Борче%');      // 'borce\\%'
```

### `matches(strA, strB, options?)`
Checks if two strings are equivalent across scripts and spellings:

```typescript
import { matches } from 'mysql-cyr-lat-search';

matches('Борче', 'Borche'); // true
matches('Borče', 'Bor4e');  // true
matches('Борче', 'Borko');  // false
```

### `contains(haystack, needle, options?)`
Checks if `haystack` contains `needle` regardless of alphabet variations:

```typescript
import { contains } from 'mysql-cyr-lat-search';

contains('Здраво Борче, како си?', 'borche'); // true
contains('Hello Borche!', 'Борче');          // true
```

---

## 3. `Shrinker` Class (Batch & High-Performance)

For high-throughput applications, instantiate a reusable `Shrinker` instance. Rules are pre-compiled and cached per dialect:

```typescript
import { Shrinker } from 'mysql-cyr-lat-search';

const shrinker = new Shrinker({
  dialect: 'universal',
  includeLeet: true,
  cleanPunctuation: false,
});

// Single string
const key = shrinker.shrink('Ѓорѓи'); // 'gorgi'

// Batch processing (ideal for ETL pipelines and data seeding)
const batch = shrinker.shrinkBatch(['Борче', 'Borche', 'Borce']);
// Returns: ['borce', 'borce', 'borce']
```

---

## 4. Configuration Options (`ShrinkOptions`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dialect` | `'universal' \| 'bulgarian' \| 'east_slavic' \| 'base_vowel'` | `'universal'` | Dialect handling for `щ`, `ъ`, `я`, `ю`. |
| `includeLeet` | `boolean` | `true` | Folds SMS/Leet digits (`4` → `c`, `6` → `s`). |
| `preserveCase`| `boolean` | `false` | Preserves letter casing where applicable. |
| `cleanPunctuation` | `boolean` | `false` | Strips all non-alphanumeric punctuation. |
| `allowNull` | `boolean` | `true` | Returns `null` if input is `null` (matches SQL NULL semantics). |
| `customRules` | `readonly CharacterRule[]` | `[]` | Optional custom search rules appended to the pipeline. |

---

## 5. SQL Query Builders

Construct safe, parameterized SQL conditions easily:

### `buildShrunkLike(column, term, mode, options)`
Generates parameterized SQL with application-level shrinking:

```typescript
import { buildShrunkLike } from 'mysql-cyr-lat-search';

const query = buildShrunkLike('name_searched', 'Борче', 'both');
// query.sql   -> 'name_searched LIKE ?'
// query.param -> '%borce%'

// Execute with MySQL2 / Knex / TypeORM
await db.query(`SELECT * FROM users WHERE ${query.sql}`, [query.param]);
```

**Supported Wildcard Modes**:
- `'both'`: `'%term%'`
- `'prefix'`: `'term%'` (uses B-Tree index)
- `'suffix'`: `'%term'`
- `'exact'`: `'term'`

### `buildSqlFunctionLike(column, term, mode)`
Generates SQL using the `SHRINK_FOR_LIKE` stored function:

```typescript
import { buildSqlFunctionLike } from 'mysql-cyr-lat-search';

const query = buildSqlFunctionLike('name_searched', 'Борче', 'both');
// query.sql   -> "name_searched LIKE CONCAT('%', SHRINK_FOR_LIKE(?), '%')"
// query.param -> 'Борче'
```

### `buildNgramMatch(column, term, booleanMode)`
Generates SQL for fulltext N-Gram substring queries:

```typescript
import { buildNgramMatch } from 'mysql-cyr-lat-search';

const query = buildNgramMatch('name_searched', 'Борче', true);
// query.sql   -> 'MATCH(name_searched) AGAINST(? IN BOOLEAN MODE)'
// query.param -> 'borce'
```

---

## 6. Migration Runner Utility (`SqlMigrator`)

Programmatically apply and roll back SQL migrations:

```typescript
import { SqlMigrator } from 'mysql-cyr-lat-search';

const migrator = new SqlMigrator('./sql/migrations');

// Inspect migrations
const migrations = migrator.loadMigrations();

// Generate unified UP migration SQL script
const upScript = migrator.generateBundleSql('up');

// Generate reverse DOWN migration SQL script (rolls back 004 -> 001)
const downScript = migrator.generateBundleSql('down');
```
