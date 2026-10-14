/**
 * @file shrinker.ts
 * @description High-performance standalone Charset Shrinker library for cross-script
 *              (Cyrillic & Latin) base folding and search normalization.
 *
 * Provides exact 1:1 behavioral parity with the MySQL/MariaDB SHRINK_CYR_LAT() stored function.
 */

import type { CharacterRule, DialectMode } from './rules.ts';
import { getCompleteRuleSet } from './rules.ts';

/**
 * Configuration options for string reduction.
 */
export interface ShrinkOptions {
  /**
   * Regional dialect preset for handling ambiguous phonetic letters (щ, ъ, я, ю).
   * Defaults to 'universal' (maximizes cross-script alignment across Slavic languages).
   */
  dialect?: DialectMode;

  /**
   * Whether to fold informal digital/SMS slang numbers (4 -> c, 6 -> s).
   * Defaults to true.
   */
  includeLeet?: boolean;

  /**
   * Whether to preserve original letter casing where applicable.
   * Defaults to false (collapses to lowercase).
   */
  preserveCase?: boolean;

  /**
   * Whether to strip punctuation and non-alphanumeric characters.
   * Defaults to false (preserves whitespace and symbols).
   */
  cleanPunctuation?: boolean;

  /**
   * If true, passing null or undefined returns null.
   * If false, null or undefined returns an empty string.
   * Defaults to true (matching MySQL SQL NULL semantics).
   */
  allowNull?: boolean;

  /**
   * Optional custom transformation rules prepended or appended to the reduction pipeline.
   */
  customRules?: readonly CharacterRule[];
}

/**
 * Default options matching MySQL stored function behavior.
 */
export const DEFAULT_SHRINK_OPTIONS: Readonly<Required<Omit<ShrinkOptions, 'customRules'>>> = {
  dialect: 'universal',
  includeLeet: true,
  preserveCase: false,
  cleanPunctuation: false,
  allowNull: true,
};

/**
 * Standalone Shrinker engine for cross-script string normalization.
 */
export class Shrinker {
  private readonly defaultOptions: Required<Omit<ShrinkOptions, 'customRules'>>;
  private readonly cachedRules: Map<string, readonly CharacterRule[]>;
  private readonly customRules?: readonly CharacterRule[];

  /**
   * Creates a new Shrinker instance.
   * @param options Default options for this instance.
   */
  constructor(options?: ShrinkOptions) {
    this.defaultOptions = {
      dialect: options?.dialect ?? DEFAULT_SHRINK_OPTIONS.dialect,
      includeLeet: options?.includeLeet ?? DEFAULT_SHRINK_OPTIONS.includeLeet,
      preserveCase: options?.preserveCase ?? DEFAULT_SHRINK_OPTIONS.preserveCase,
      cleanPunctuation: options?.cleanPunctuation ?? DEFAULT_SHRINK_OPTIONS.cleanPunctuation,
      allowNull: options?.allowNull ?? DEFAULT_SHRINK_OPTIONS.allowNull,
    };
    this.customRules = options?.customRules;
    this.cachedRules = new Map();
  }

  /**
   * Retrieves the reduction rules for a specified dialect mode and leet setting.
   */
  public getRules(dialect: DialectMode = this.defaultOptions.dialect, includeLeet: boolean = this.defaultOptions.includeLeet): readonly CharacterRule[] {
    const key = `${dialect}_${includeLeet ? '1' : '0'}`;
    let baseRules = this.cachedRules.get(key);
    if (!baseRules) {
      baseRules = getCompleteRuleSet(dialect, includeLeet);
      this.cachedRules.set(key, baseRules);
    }

    if (this.customRules && this.customRules.length > 0) {
      return [...this.customRules, ...baseRules];
    }
    return baseRules;
  }

  /**
   * Shrinks an input string down to its canonical base ASCII representation.
   *
   * @param input The input string (in Cyrillic, Latin, mixed scripts, or slang).
   * @param overrideOptions Optional overrides for this specific execution.
   * @returns Shrunk string, or null if input was null/undefined and allowNull is true.
   */
  public shrink(input: string | null | undefined, overrideOptions?: ShrinkOptions): string | null {
    const allowNull = overrideOptions?.allowNull ?? this.defaultOptions.allowNull;
    if (input === null || input === undefined) {
      return allowNull ? null : '';
    }

    const dialect = overrideOptions?.dialect ?? this.defaultOptions.dialect;
    const includeLeet = overrideOptions?.includeLeet ?? this.defaultOptions.includeLeet;
    const preserveCase = overrideOptions?.preserveCase ?? this.defaultOptions.preserveCase;
    const cleanPunctuation = overrideOptions?.cleanPunctuation ?? this.defaultOptions.cleanPunctuation;
    const customRules = overrideOptions?.customRules ?? this.customRules;

    let res = preserveCase ? input : input.toLowerCase();

    // Fetch active ruleset
    let rules = this.getRules(dialect, includeLeet);
    if (customRules && customRules.length > 0) {
      rules = [...customRules, ...rules];
    }

    // Apply sequential rules
    const len = rules.length;
    for (let i = 0; i < len; i++) {
      const rule = rules[i];
      if (res.includes(rule.find)) {
        res = res.replaceAll(rule.find, rule.replace);
      }
    }

    // Optional punctuation cleaning
    if (cleanPunctuation) {
      res = res.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ').trim();
    }

    return res;
  }

  /**
   * Shrinks an array of strings in bulk.
   *
   * @param inputs Array of input strings.
   * @param overrideOptions Optional configuration overrides.
   * @returns Array of shrunk strings.
   */
  public shrinkBatch(inputs: readonly (string | null | undefined)[], overrideOptions?: ShrinkOptions): (string | null)[] {
    const results: (string | null)[] = new Array(inputs.length);
    for (let i = 0; i < inputs.length; i++) {
      results[i] = this.shrink(inputs[i], overrideOptions);
    }
    return results;
  }

  /**
   * Determines whether two strings are equivalent under cross-script reduction.
   * Example: matches('Борче', 'Borche') === true.
   *
   * @param a First string.
   * @param b Second string.
   * @param overrideOptions Optional configuration overrides.
   * @returns True if both strings shrink to the identical canonical key.
   */
  public matches(a: string | null | undefined, b: string | null | undefined, overrideOptions?: ShrinkOptions): boolean {
    const shrunkA = this.shrink(a, overrideOptions);
    const shrunkB = this.shrink(b, overrideOptions);
    if (shrunkA === null || shrunkB === null) {
      return shrunkA === shrunkB;
    }
    return shrunkA === shrunkB;
  }

  /**
   * Determines whether a haystack string contains a search query needle under cross-script reduction.
   * Example: contains('Борче Николов', 'borche') === true.
   *
   * @param haystack The text to search within.
   * @param needle The search term.
   * @param overrideOptions Optional configuration overrides.
   * @returns True if the shrunk needle is a substring of the shrunk haystack.
   */
  public contains(haystack: string | null | undefined, needle: string | null | undefined, overrideOptions?: ShrinkOptions): boolean {
    const shrunkHaystack = this.shrink(haystack, overrideOptions);
    const shrunkNeedle = this.shrink(needle, overrideOptions);

    if (shrunkHaystack === null || shrunkNeedle === null) {
      return false;
    }

    return shrunkHaystack.includes(shrunkNeedle);
  }

  /**
   * Shrinks an input string and safely escapes SQL LIKE wildcards (%, _, \)
   * so that it can be safely injected into LIKE CONCAT('%', ?, '%') queries
   * without risk of wildcard injection.
   *
   * @param input Input string.
   * @param overrideOptions Optional overrides.
   * @returns Escaped shrunk string, or null if input was null/undefined.
   */
  public shrinkForLike(input: string | null | undefined, overrideOptions?: ShrinkOptions): string | null {
    const shrunk = this.shrink(input, overrideOptions);
    if (shrunk === null) {
      return null;
    }
    return escapeLikeWildcards(shrunk);
  }
}

/**
 * Escapes SQL LIKE wildcards (% and _) and backslash escape characters.
 */
export function escapeLikeWildcards(str: string): string {
  return str
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_');
}

/**
 * Singleton default instance for direct functional usage.
 */
const defaultShrinker = new Shrinker();

/**
 * Functional shorthand: Shrinks a single string using default or provided options.
 */
export function shrink(input: string | null | undefined, options?: ShrinkOptions): string | null {
  return defaultShrinker.shrink(input, options);
}

/**
 * Functional shorthand: Shrinks a string and escapes SQL LIKE wildcards (%, _, \).
 */
export function shrinkForLike(input: string | null | undefined, options?: ShrinkOptions): string | null {
  return defaultShrinker.shrinkForLike(input, options);
}

/**
 * Functional shorthand: Compares two strings for cross-script equivalence.
 */
export function matches(a: string | null | undefined, b: string | null | undefined, options?: ShrinkOptions): boolean {
  return defaultShrinker.matches(a, b, options);
}

/**
 * Functional shorthand: Checks if haystack contains needle under cross-script reduction.
 */
export function contains(haystack: string | null | undefined, needle: string | null | undefined, options?: ShrinkOptions): boolean {
  return defaultShrinker.contains(haystack, needle, options);
}

