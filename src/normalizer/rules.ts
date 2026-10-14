/**
 * @file rules.ts
 * @description Canonical character reduction and charset shrinking tables for cross-script
 *              (Cyrillic & Latin) search normalization.
 *
 * This module defines:
 * 1. Sequential multi-pass replacement tables:
 *    - Pass 1: Multi-character Latin Trigraphs & Digraphs (ordered strictly by descending length)
 *    - Pass 2: Latin Accents & Diacritics
 *    - Pass 3: Cyrillic Sibilants, Affricates & Regional Consonants
 *    - Pass 4: Cyrillic Vowels & Standard Letters
 *    - Pass 5: Leet / SMS digit slang substitutions
 * 2. Dialect variation tables and presets for `щ`, `ъ`, `я`, `ю`:
 *    - BALKAN / UNIVERSAL (Default): Maximizes cross-script alignment between South & East Slavic
 *    - BULGARIAN: Official 2009 Romanization alignment (ъ -> a, щ -> st)
 *    - MACEDONIAN: Full coverage of Ѓ, Ќ, Ѕ, Џ, Љ, Њ and Latin digraph equivalents (gj, kj, dz, etc.)
 *    - EAST_SLAVIC / RUSSIAN: Strict hard sign dropping (ъ -> ''), soft sign (ь -> ''), and Russian phonetics
 */

export interface CharacterRule {
  readonly find: string;
  readonly replace: string;
  readonly description?: string;
}

export type DialectMode = 'universal' | 'balkan' | 'macedonian' | 'bulgarian' | 'east_slavic';

/**
 * Pass 1: Multi-Character Latin Digraphs & Trigraphs.
 * ORDER IS CRITICAL: Trigraphs must precede digraphs to avoid partial collisions
 * (e.g., 'shch' before 'sh' and 'ch'; 'dzh' before 'dz').
 */
export const LATIN_DIGRAPHS_AND_TRIGRAPHS: readonly CharacterRule[] = [
  // Trigraphs (Length 4 & 3)
  { find: 'shch', replace: 'st', description: 'Trigraph for щ (Russian/Slavic transliteration -> st)' },
  { find: 'sht',  replace: 'st', description: 'Trigraph for щ (Bulgarian transliteration -> st)' },
  { find: 'dzh',  replace: 'd',  description: 'Trigraph for џ (Balkan/Slavic transliteration -> d)' },

  // South Slavic Digraphs (Macedonian, Serbian, Croatian)
  { find: 'dž',   replace: 'd',  description: "Gaj's Latin digraph for џ -> d" },
  { find: 'dj',   replace: 'd',  description: 'Digraph for ђ/џ -> d' },
  { find: 'dz',   replace: 'z',  description: 'Digraph for Macedonian ѕ -> z' },
  { find: 'gj',   replace: 'g',  description: 'Digraph for Macedonian ѓ -> g' },
  { find: 'kj',   replace: 'k',  description: 'Digraph for Macedonian ќ -> k' },
  { find: 'lj',   replace: 'l',  description: 'Digraph for љ -> l' },
  { find: 'nj',   replace: 'n',  description: 'Digraph for њ -> n' },

  // Sibilants and Affricates Digraphs
  { find: 'ch',   replace: 'c',  description: 'Digraph for ч/č/ć -> c' },
  { find: 'sh',   replace: 's',  description: 'Digraph for ш/š -> s' },
  { find: 'zh',   replace: 'z',  description: 'Digraph for ж/ž -> z' },
  { find: 'ts',   replace: 'c',  description: 'Digraph for ц -> c' },
  { find: 'tz',   replace: 'c',  description: 'Digraph for ц (Germanic transliteration) -> c' },
  { find: 'kh',   replace: 'h',  description: 'Digraph for х -> h' },

  // Iotated Vowel Digraphs (matches Cyrillic я and ю symmetrically)
  { find: 'ya',   replace: 'ja', description: 'Transliteration of я -> ja (matches Macedonian/Serbian ја)' },
  { find: 'yu',   replace: 'ju', description: 'Transliteration of ю -> ju (matches Macedonian/Serbian ју)' },
] as const;

/**
 * Extended Latin Digraphs (optional / western transliteration styles).
 */
export const EXTENDED_LATIN_DIGRAPHS: readonly CharacterRule[] = [
  { find: 'sch',  replace: 's',  description: 'German transliteration for ш -> s' },
  { find: 'tch',  replace: 'c',  description: 'French transliteration for ч -> c' },
  { find: 'cz',   replace: 'c',  description: 'Polish digraph for ч/c -> c' },
  { find: 'sz',   replace: 's',  description: 'Polish digraph for ш/s -> s' },
] as const;

/**
 * Pass 2: Latin Accents, Diacritics and Non-Standard Consonants.
 */
export const LATIN_DIACRITICS_AND_CONSONANTS: readonly CharacterRule[] = [
  // Gaj's Latin & South/Central European diacritics
  { find: 'č', replace: 'c', description: 'c with caron -> c' },
  { find: 'ć', replace: 'c', description: 'c with acute -> c' },
  { find: 'ç', replace: 'c', description: 'c with cedilla -> c' },
  { find: 'š', replace: 's', description: 's with caron -> s' },
  { find: 'ś', replace: 's', description: 's with acute -> s' },
  { find: 'ş', replace: 's', description: 's with cedilla -> s' },
  { find: 'ș', replace: 's', description: 's with comma -> s' },
  { find: 'ž', replace: 'z', description: 'z with caron -> z' },
  { find: 'ź', replace: 'z', description: 'z with acute -> z' },
  { find: 'ż', replace: 'z', description: 'z with dot above -> z' },
  { find: 'đ', replace: 'd', description: 'd with stroke -> d' },
  { find: 'ď', replace: 'd', description: 'd with caron -> d' },
  { find: 'ť', replace: 't', description: 't with caron -> t' },
  { find: 'ţ', replace: 't', description: 't with cedilla -> t' },
  { find: 'ț', replace: 't', description: 't with comma -> t' },
  { find: 'ň', replace: 'n', description: 'n with caron -> n' },
  { find: 'ñ', replace: 'n', description: 'n with tilde -> n' },
  { find: 'ľ', replace: 'l', description: 'l with caron -> l' },
  { find: 'ĺ', replace: 'l', description: 'l with acute -> l' },
  { find: 'ł', replace: 'l', description: 'l with stroke -> l' },
  { find: 'ŕ', replace: 'r', description: 'r with acute -> r' },
  { find: 'ř', replace: 'r', description: 'r with caron -> r' },

  // Non-standard Latin consonants folded to base ASCII
  { find: 'w', replace: 'v', description: 'Latin w folded to v' },
  { find: 'q', replace: 'k', description: 'Latin q folded to k' },
  { find: 'x', replace: 'ks', description: 'Latin x expanded to ks' },

  // Vowel Diacritics (Latin accented vowels folded to ASCII base vowels)
  { find: 'ä', replace: 'a' },
  { find: 'á', replace: 'a' },
  { find: 'à', replace: 'a' },
  { find: 'â', replace: 'a' },
  { find: 'ã', replace: 'a' },
  { find: 'å', replace: 'a' },
  { find: 'ā', replace: 'a' },
  { find: 'ă', replace: 'a' },
  { find: 'ą', replace: 'a' },

  { find: 'é', replace: 'e' },
  { find: 'è', replace: 'e' },
  { find: 'ê', replace: 'e' },
  { find: 'ë', replace: 'e' },
  { find: 'ē', replace: 'e' },
  { find: 'ė', replace: 'e' },
  { find: 'ę', replace: 'e' },
  { find: 'ě', replace: 'e' },

  { find: 'í', replace: 'i' },
  { find: 'ì', replace: 'i' },
  { find: 'î', replace: 'i' },
  { find: 'ï', replace: 'i' },
  { find: 'ī', replace: 'i' },
  { find: 'į', replace: 'i' },

  { find: 'ó', replace: 'o' },
  { find: 'ò', replace: 'o' },
  { find: 'ô', replace: 'o' },
  { find: 'ö', replace: 'o' },
  { find: 'õ', replace: 'o' },
  { find: 'ō', replace: 'o' },
  { find: 'ő', replace: 'o' },
  { find: 'ø', replace: 'o' },

  { find: 'ú', replace: 'u' },
  { find: 'ù', replace: 'u' },
  { find: 'û', replace: 'u' },
  { find: 'ü', replace: 'u' },
  { find: 'ū', replace: 'u' },
  { find: 'ű', replace: 'u' },
  { find: 'ů', replace: 'u' },

  { find: 'ý', replace: 'y' },
  { find: 'ÿ', replace: 'y' },
] as const;

/**
 * Pass 3: Cyrillic Sibilants, Affricates and Regional Consonants.
 * Collapses complex sounds down to base Latin letters.
 */
export const CYRILLIC_REGIONAL_CONSONANTS: readonly CharacterRule[] = [
  // Sibilants and Affricates
  { find: 'ч', replace: 'c',  description: 'Cyrillic che -> c (matches ch, c, č, ć)' },
  { find: 'ш', replace: 's',  description: 'Cyrillic sha -> s (matches sh, s, š)' },
  { find: 'ж', replace: 'z',  description: 'Cyrillic zhe -> z (matches zh, z, ž)' },
  { find: 'ц', replace: 'c',  description: 'Cyrillic tse -> c (matches ts, tz, c)' },
  { find: 'х', replace: 'h',  description: 'Cyrillic ha -> h (matches kh, h)' },

  // Balkan & Regional Consonants
  { find: 'џ', replace: 'd',  description: 'Macedonian/Serbian dzhe -> d (matches dzh, dj, dž)' },
  { find: 'ђ', replace: 'd',  description: 'Serbian dje -> d (matches dj, đ)' },
  { find: 'ћ', replace: 'c',  description: 'Serbian tje -> c (matches c, ć)' },
  { find: 'ѓ', replace: 'g',  description: 'Macedonian gje -> g (matches gj, g)' },
  { find: 'ќ', replace: 'k',  description: 'Macedonian kje -> k (matches kj, k)' },
  { find: 'ѕ', replace: 'z',  description: 'Macedonian dze -> z (matches dz, z)' },
  { find: 'љ', replace: 'l',  description: 'Macedonian/Serbian lje -> l (matches lj, l)' },
  { find: 'њ', replace: 'n',  description: 'Macedonian/Serbian nje -> n (matches nj, n)' },
  { find: 'ґ', replace: 'g',  description: 'Ukrainian ghe with upturn -> g' },
  { find: 'ў', replace: 'u',  description: 'Belarusian short u -> u' },
] as const;

/**
 * Pass 4: Standard Base Cyrillic Characters to Base Latin.
 */
export const CYRILLIC_BASE_CHARACTERS: readonly CharacterRule[] = [
  { find: 'а', replace: 'a' },
  { find: 'б', replace: 'b' },
  { find: 'в', replace: 'v' },
  { find: 'г', replace: 'g' },
  { find: 'д', replace: 'd' },
  { find: 'е', replace: 'e' },
  { find: 'ё', replace: 'e' },
  { find: 'є', replace: 'e' },
  { find: 'з', replace: 'z' },
  { find: 'и', replace: 'i' },
  { find: 'і', replace: 'i' },
  { find: 'ї', replace: 'i' },
  { find: 'й', replace: 'j' },
  { find: 'ј', replace: 'j' },
  { find: 'к', replace: 'k' },
  { find: 'л', replace: 'l' },
  { find: 'м', replace: 'm' },
  { find: 'н', replace: 'n' },
  { find: 'о', replace: 'o' },
  { find: 'п', replace: 'p' },
  { find: 'р', replace: 'r' },
  { find: 'с', replace: 's' },
  { find: 'т', replace: 't' },
  { find: 'у', replace: 'u' },
  { find: 'ф', replace: 'f' },
  { find: 'ы', replace: 'i' },
  { find: 'э', replace: 'e' },
  { find: 'ь', replace: '', description: 'Cyrillic soft sign dropped' },
] as const;

/**
 * Dialect Variations for the 4 Key Dialect Characters: щ, ъ, я, ю.
 *
 * Analysis & Rationale:
 * ---------------------
 * 1. `щ` (Sht / Shch):
 *    - Bulgarian: pronounced [ʃt] (sht). Shrunk: 'st'.
 *    - Russian/Ukrainian: pronounced [ɕː] (shch). Transliterated 'shch'.
 *    - Universal / Balkan Mode: 'щ' -> 'st'. When paired with 'shch' -> 'st' and 'sht' -> 'st',
 *      all representations (поща, poshta, poshcha, posta) collapse to identical 'posta'.
 *    - East Slavic Mode: 'щ' -> 'sc' (or 's'), 'shch' -> 'sc'.
 *
 * 2. `ъ` (Yer Golyam / Hard Sign):
 *    - Bulgarian: core vowel /ɤ/. Official 2009 romanization standard is 'a' (e.g. Кръстев -> Krastev,
 *      България -> Balgaria). Colloquially sometimes 'u'.
 *    - Russian: silent hard sign (e.g. объект -> obekt). Dropped -> ''.
 *    - Balkan / Universal Default: 'ъ' -> 'a'.
 *    - East Slavic: 'ъ' -> ''.
 *
 * 3. `я` (Ya / Ja):
 *    - Phonetically [ja].
 *    - In South Slavic (Macedonian & Serbian), written natively with two letters: `ја` (Јана, Бојан).
 *    - Universal / Balkan Mode: 'я' -> 'ja' (with digraph 'ya' -> 'ja').
 *      Ensures: Cyrillic 'Яна' = Cyrillic 'Јана' = Latin 'Jana' = Latin 'Yana' => 'jana'.
 *    - Base Vowel Folding Mode: 'я' -> 'a', 'ya' -> 'a'.
 *
 * 4. `ю` (Yu / Ju):
 *    - Phonetically [ju].
 *    - In South Slavic (Macedonian & Serbian), written natively with two letters: `ју` (Јулија).
 *    - Universal / Balkan Mode: 'ю' -> 'ju' (with digraph 'yu' -> 'ju').
 *      Ensures: Cyrillic 'Юлия' = Cyrillic 'Јулија' = Latin 'Julija' = Latin 'Yulija' => 'julija'.
 *    - Base Vowel Folding Mode: 'ю' -> 'u', 'yu' -> 'u'.
 */
export const DIALECT_VARIATION_RULES: Record<DialectMode, readonly CharacterRule[]> = {
  /**
   * Universal / Balanced Cross-Slavic Preset (Recommended default).
   * Unifies South Slavic (Macedonian, Serbian, Bulgarian) with East Slavic.
   */
  universal: [
    { find: 'щ', replace: 'st', description: 'Balkan/Universal: щ -> st (matches sht/shch/st)' },
    { find: 'ъ', replace: 'a',  description: 'Bulgarian/Balkan: ъ -> a (official 2009 transliteration standard)' },
    { find: 'я', replace: 'ja', description: 'Universal: я -> ja (matches Macedonian/Serbian ја and Latin ja/ya)' },
    { find: 'ю', replace: 'ju', description: 'Universal: ю -> ju (matches Macedonian/Serbian ју and Latin ju/yu)' },
  ],

  /**
   * Balkan / South Slavic Preset (Macedonian, Serbian, Croatian, Bulgarian).
   */
  balkan: [
    { find: 'щ', replace: 'st', description: 'Balkan: щ -> st' },
    { find: 'ъ', replace: 'a',  description: 'Balkan: ъ -> a' },
    { find: 'я', replace: 'ja', description: 'Balkan: я -> ja' },
    { find: 'ю', replace: 'ju', description: 'Balkan: ю -> ju' },
  ],

  /**
   * Macedonian Preset.
   * Tailored for Macedonian phonology where ъ, я, ю do not exist in modern standard orthography,
   * but appear in historic/dialect texts and cross-border names.
   */
  macedonian: [
    { find: 'щ', replace: 'st', description: 'Macedonian dialect: щ -> st' },
    { find: 'ъ', replace: 'a',  description: 'Macedonian historic/dialect: ъ -> a' },
    { find: 'я', replace: 'ja', description: 'Macedonian cross-script: я -> ja' },
    { find: 'ю', replace: 'ju', description: 'Macedonian cross-script: ю -> ju' },
  ],

  /**
   * Bulgarian Preset.
   * Full alignment with Bulgarian 2009 Law on Transliteration.
   */
  bulgarian: [
    { find: 'щ', replace: 'st', description: 'Bulgarian: щ -> st (matches поща -> posta)' },
    { find: 'ъ', replace: 'a',  description: 'Bulgarian: ъ -> a (matches България -> Balgarija, Кръстев -> Krastev)' },
    { find: 'я', replace: 'ja', description: 'Bulgarian: я -> ja (matches я -> ja)' },
    { find: 'ю', replace: 'ju', description: 'Bulgarian: ю -> ju (matches ю -> ju)' },
  ],

  /**
   * East Slavic / Russian / Ukrainian Preset.
   * Drops silent hard sign ъ and treats soft sign ь as null.
   */
  east_slavic: [
    { find: 'щ', replace: 'sc', description: 'East Slavic: щ -> sc (matches shch -> sc)' },
    { find: 'ъ', replace: '',   description: 'East Slavic: ъ silent hard sign dropped (объект -> obekt)' },
    { find: 'я', replace: 'ja', description: 'East Slavic: я -> ja (matches ya/ja)' },
    { find: 'ю', replace: 'ju', description: 'East Slavic: ю -> ju (matches yu/ju)' },
  ],
} as const;

/**
 * Pass 5: Informal SMS / Leet Slang.
 * Ubiquitous numbers used in informal digital communication for Slavic affricates/sibilants.
 */
export const LEET_SLANG_RULES: readonly CharacterRule[] = [
  { find: '4', replace: 'c', description: 'Slang: 4 represents ч/č/c' },
  { find: '6', replace: 's', description: 'Slang: 6 represents ш/š/s' },
] as const;

/**
 * Helper to build the complete, flattened list of rules for a given dialect mode.
 * Sequential execution order is strictly guaranteed:
 * 1. Multi-character Latin Digraphs & Trigraphs (longest first)
 * 2. Latin Accents & Diacritics
 * 3. Cyrillic Sibilants & Regional Consonants
 * 4. Dialect-specific rules (щ, ъ, я, ю)
 * 5. Cyrillic Base Characters
 * 6. Leet Slang
 */
export function getCompleteRuleSet(dialect: DialectMode = 'universal', includeLeet: boolean = true): readonly CharacterRule[] {
  const dialectRules = DIALECT_VARIATION_RULES[dialect] ?? DIALECT_VARIATION_RULES.universal;

  const rules: CharacterRule[] = [
    ...LATIN_DIGRAPHS_AND_TRIGRAPHS,
    ...LATIN_DIACRITICS_AND_CONSONANTS,
    ...CYRILLIC_REGIONAL_CONSONANTS,
    ...dialectRules,
    ...CYRILLIC_BASE_CHARACTERS,
  ];

  if (includeLeet) {
    rules.push(...LEET_SLANG_RULES);
  }

  return rules;
}
