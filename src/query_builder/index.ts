/**
 * @file index.ts
 * @description SQL Query Builder helpers for cross-script search (LIKE and N-Gram fulltext).
 */

import { shrink, shrinkForLike } from '../normalizer/shrinker.ts';
import type { ShrinkOptions } from '../normalizer/shrinker.ts';

export type WildcardMode = 'both' | 'prefix' | 'suffix' | 'exact';

export interface QueryFragment {
  readonly sql: string;
  readonly param: string;
}

/**
 * Builds a parameterized SQL LIKE condition using application-level shrinking (Pattern 1).
 * Safely escapes any user-typed SQL wildcards (%, _) inside the search term.
 *
 * @param column Database column name (e.g. 'name_searched').
 * @param term User search term (e.g. 'Борче', 'Borche').
 * @param mode Wildcard placement mode ('both' for %term%, 'prefix' for term%, 'suffix' for %term, 'exact' for term).
 * @param options ShrinkOptions.
 * @returns Parameterized SQL fragment and parameter string.
 */
export function buildShrunkLike(
  column: string,
  term: string,
  mode: WildcardMode = 'both',
  options?: ShrinkOptions
): QueryFragment {
  const cleanTerm = shrinkForLike(term, options) ?? '';
  let param: string;

  switch (mode) {
    case 'both':
      param = `%${cleanTerm}%`;
      break;
    case 'prefix':
      param = `${cleanTerm}%`;
      break;
    case 'suffix':
      param = `%${cleanTerm}`;
      break;
    case 'exact':
      param = cleanTerm;
      break;
  }

  return {
    sql: `${column} LIKE ?`,
    param,
  };
}

/**
 * Builds a pure SQL query condition delegating shrinking and wildcard escaping
 * directly to the MySQL SHRINK_FOR_LIKE() stored function (Pattern 2).
 *
 * @param column Database column name (e.g. 'name_searched').
 * @param term Search term to be passed to the stored function.
 * @param mode Wildcard mode.
 * @returns Parameterized SQL fragment with CONCAT and SHRINK_FOR_LIKE call.
 */
export function buildSqlFunctionLike(
  column: string,
  term: string,
  mode: WildcardMode = 'both'
): QueryFragment {
  let sql: string;

  switch (mode) {
    case 'both':
      sql = `${column} LIKE CONCAT('%', SHRINK_FOR_LIKE(?), '%')`;
      break;
    case 'prefix':
      sql = `${column} LIKE CONCAT(SHRINK_FOR_LIKE(?), '%')`;
      break;
    case 'suffix':
      sql = `${column} LIKE CONCAT('%', SHRINK_FOR_LIKE(?))`;
      break;
    case 'exact':
      sql = `${column} LIKE SHRINK_FOR_LIKE(?)`;
      break;
  }

  return {
    sql,
    param: term,
  };
}

/**
 * Builds a MySQL N-Gram Fulltext MATCH ... AGAINST query condition (Pattern 3).
 *
 * @param column Column with fulltext index (e.g. 'name_searched').
 * @param term User search term.
 * @param modifier Fulltext modifier ('BOOLEAN MODE' or 'NATURAL LANGUAGE MODE').
 * @param options Shrink options.
 * @returns Parameterized SQL fragment.
 */
export function buildNgramMatch(
  column: string,
  term: string,
  modifier: 'BOOLEAN MODE' | 'NATURAL LANGUAGE MODE' = 'BOOLEAN MODE',
  options?: ShrinkOptions
): QueryFragment {
  const shrunk = shrink(term, options) ?? '';
  return {
    sql: `MATCH(${column}) AGAINST(? IN ${modifier})`,
    param: shrunk,
  };
}
