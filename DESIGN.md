# Cross-Script (Cyrillic & Latin) Reduction Specifications & Architecture

## 1. Overview & Problem Definition

Slavic digital communication features ubiquitous mixing of alphabets and orthographies:
- **Cyrillic**: `Борче`, `Пешо`, `Жарко`, `Ѓорѓи`, `Јулија`, `Поща`
- **Latin Digraphs / Trigraphs**: `Borche`, `Pesho`, `Zharko`, `Gjorgji`, `Julija`, `Poshta`, `Poshcha`
- **Plain ASCII**: `Borce`, `Peso`, `Zarko`, `Gorgi`, `Posta`
- **Accented / Gaj's Latin**: `Borče`, `Pešo`, `Žarko`
- **Informal / Leet**: `Bor4e`, `Pe6o`

Standard MySQL / MariaDB collations (e.g., `utf8mb4_0900_ai_ci` or `utf8mb4_uca1400_ai_ci`) cannot match multi-character digraphs with single Cyrillic or Latin letters (e.g., equating `ch` with `ч` or `c`).

### The Solution: Symmetric Charset Shrinking (Base Folding)
Both Cyrillic and Latin strings are shrunk down through an identical, deterministic pipeline to a common base ASCII representation (`[a-z0-9]`).

---

## 2. Character Reduction Pipeline & Ordering Guarantees

The reduction pipeline executes in strict sequential order. **Ordering is non-negotiable** to prevent destructive partial replacements:

```
+-------------------------------------------------------------------+
| Input String                                                      |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
| 0. Lowercase Normalization (res = LOWER(input))                   |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
| 1. Latin Digraphs & Trigraphs (ordered strictly longest first)    |
|    - Trigraphs (shch, sht, dzh)                                   |
|    - Regional Digraphs (dž, dj, dz, gj, kj, lj, nj)               |
|    - Sibilant/Affricate Digraphs (ch, sh, zh, ts, tz, kh)         |
|    - Iotated Vowel Digraphs (ya, yu)                              |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
| 2. Latin Diacritics & Extended Consonants                         |
|    - Gaj's alphabet: č, ć -> c; š -> s; ž -> z; đ -> d            |
|    - Extended Latin consonants: w -> v; q -> k; x -> ks           |
|    - Latin vowel diacritics: á, ä, à, etc. -> a                   |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
| 3. Cyrillic Sibilants, Affricates & Regional Letters              |
|    - ч -> c; ш -> s; ж -> z; ц -> c; х -> h                       |
|    - џ -> d; ђ -> d; ћ -> c; ѓ -> g; ќ -> k; ѕ -> z; љ -> l; њ -> n|
|    - ґ -> g; ў -> u                                               |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
| 4. Dialect Variations (щ, ъ, я, ю)                                |
|    - щ -> st (or sc in East Slavic)                               |
|    - ъ -> a (or '' in East Slavic)                                |
|    - я -> ja                                                      |
|    - ю -> ju                                                      |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
| 5. Standard Cyrillic Base Characters                              |
|    - а -> a, б -> b, в -> v, г -> g, д -> d, е/ё/є -> e           |
|    - з -> z, и/і/ї -> i, й/ј -> j, к -> k, л -> l, м -> m         |
|    - н -> n, о -> o, п -> p, р -> r, с -> s, т -> t, у -> u       |
|    - ф -> f, ы -> i, э -> e, ь -> ''                              |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
| 6. Informal SMS / Leet Slang                                      |
|    - 4 -> c                                                       |
|    - 6 -> s                                                       |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
| Output Shrunk Base ASCII Key                                      |
+-------------------------------------------------------------------+
```

---

## 3. Detailed Reduction Tables

### Pass 1: Latin Digraphs & Trigraphs
Processed before single-character substitutions so that sequences like `sh` are not broken by prior Latin replacements.

| Priority | Input Sequence | Target Shrunk Character | Sound / Rationale |
| :--- | :--- | :--- | :--- |
| 1 | `shch` | `st` | Russian/Ukrainian transliteration of `щ` |
| 2 | `sht` | `st` | Bulgarian transliteration of `щ` |
| 3 | `dzh` | `d` | Trigraph for `џ` |
| 4 | `dž` | `d` | Gaj's Latin digraph for `џ` |
| 5 | `dj` | `d` | Digraph for `ђ` and `џ` |
| 6 | `dz` | `z` | Digraph for Macedonian `ѕ` |
| 7 | `gj` | `g` | Digraph for Macedonian `ѓ` |
| 8 | `kj` | `k` | Digraph for Macedonian `ќ` |
| 9 | `lj` | `l` | Digraph for `љ` |
| 10 | `nj` | `n` | Digraph for `њ` |
| 11 | `ch` | `c` | Matches `ч`, `č`, `ć` |
| 12 | `sh` | `s` | Matches `ш`, `š` |
| 13 | `zh` | `z` | Matches `ж`, `ž` |
| 14 | `ts` | `c` | Matches `ц` |
| 15 | `tz` | `c` | Germanic transliteration for `ц` |
| 16 | `kh` | `h` | Matches `х` |
| 17 | `ya` | `ja` | Transliteration of `я` -> matches `ја` |
| 18 | `yu` | `ju` | Transliteration of `ю` -> matches `ју` |

### Pass 2: Latin Diacritics & Accents

| Input | Output | Category |
| :--- | :--- | :--- |
| `č`, `ć`, `ç` | `c` | Sibilants / Affricates |
| `š`, `ś`, `ş`, `ș` | `s` | Sibilants |
| `ž`, `ź`, `ż` | `z` | Sibilants |
| `đ`, `ď` | `d` | Dental stops |
| `ť`, `ţ`, `ț` | `t` | Dental stops |
| `ň`, `ñ` | `n` | Nasals |
| `ľ`, `ĺ`, `ł` | `l` | Laterals |
| `ŕ`, `ř` | `r` | Rhotics |
| `w` | `v` | Loanword consonant folding |
| `q` | `k` | Loanword consonant folding |
| `x` | `ks` | Latin ligature consonant |
| `ä`, `á`, `à`, `â`, `ã`, `å`, `ā`, `ă`, `ą` | `a` | Vowel diacritics |
| `é`, `è`, `ê`, `ë`, `ē`, `ė`, `ę`, `ě` | `e` | Vowel diacritics |
| `í`, `ì`, `î`, `ï`, `ī`, `į` | `i` | Vowel diacritics |
| `ó`, `ò`, `ô`, `ö`, `õ`, `ō`, `ő`, `ø` | `o` | Vowel diacritics |
| `ú`, `ù`, `û`, `ü`, `ū`, `ű`, `ů` | `u` | Vowel diacritics |
| `ý`, `ÿ` | `y` | Vowel diacritics |

### Pass 3: Cyrillic Regional Consonants & Sibilants

| Cyrillic Letter | Shrunk Output | Equivalent Sound & Latin Match |
| :--- | :--- | :--- |
| **ч** | `c` | Matches `ch`, `c`, `č`, `ć` |
| **ш** | `s` | Matches `sh`, `s`, `š` |
| **ж** | `z` | Matches `zh`, `z`, `ž` |
| **ц** | `c` | Matches `ts`, `tz`, `c` |
| **х** | `h` | Matches `kh`, `h` |
| **џ** | `d` | Matches `dzh`, `dj`, `dž`, `d` |
| **ђ** | `d` | Matches Serbian `dj`, `đ`, `d` |
| **ћ** | `c` | Matches Serbian `ć`, `c` |
| **ѓ** | `g` | Matches Macedonian `gj`, `g` |
| **ќ** | `k` | Matches Macedonian `kj`, `k` |
| **ѕ** | `z` | Matches Macedonian `dz`, `z` |
| **љ** | `l` | Matches `lj`, `l` |
| **њ** | `n` | Matches `nj`, `n` |
| **ґ** | `g` | Ukrainian hard g |
| **ў** | `u` | Belarusian short u |

---

## 4. Dialect Variations for `щ`, `ъ`, `я`, `ю`

The characters `щ`, `ъ`, `я`, `ю` carry different phonetic values across Slavic languages:

```
               +--------------------------------------------------------+
               | Dialect Handling Matrix                                |
+--------------+------------------+------------------+------------------+
| Character    | Balkan / South   | Bulgarian        | East Slavic      |
|              | Slavic (Default) | (Official Law)   | (Russian/Ukr)    |
+--------------+------------------+------------------+------------------+
| щ            | st               | st               | sc (or st)       |
| ъ            | a                | a                | '' (dropped)     |
| я            | ja               | ja               | ja               |
| ю            | ju               | ju               | ju               |
+--------------+------------------+------------------+------------------+
```

### Detailed Rationale:

#### 1. `щ` (Sht / Shch)
- **Bulgarian**: Pronounced [ʃt] ("шт"). Example: `поща` (poshta) -> shrunk to `posta`.
- **Russian / Ukrainian**: Pronounced [ɕː] (long shch). Transliterated as `shch`.
- **Cross-Script Resolution**: In the default Universal/Balkan pipeline, `щ` -> `st`, `sht` -> `st`, and `shch` -> `st`.
  - Stored: `Поща` -> `posta`
  - Query: `poshta` -> `posta` (MATCH)
  - Query: `poshcha` -> `posta` (MATCH)
  - Query: `posta` -> `posta` (MATCH)

#### 2. `ъ` (Yer Golyam / Hard Sign)
- **Bulgarian**: A standard back vowel /ɤ/. Bulgarian State Law on Transliteration (2009) maps `ъ` to `a` (`България` -> `Balgaria`, `Кръстев` -> `Krastev`, `Търново` -> `Tarnovo`).
- **Russian**: Silent hard sign (твёрдый знак) indicating non-palatalization (`объект` -> `obekt`).
- **Resolution**:
  - In Balkan/Bulgarian mode: `ъ` -> `a`.
  - In East Slavic mode: `ъ` -> `''` (omitted).

#### 3. `я` (Ya / Ja)
- Phonetically [ja].
- In Macedonian and Serbian, written natively as two letters: `ја` (e.g. `Јана`, `Бојан`).
- In Bulgarian and Russian, written as a single ligature `я` (e.g. `Яна`).
- **Resolution**:
  - By setting `я` -> `ja` and Latin digraph `ya` -> `ja`:
    - `Яна` (Cyrillic) -> `jana`
    - `Јана` (Macedonian Cyrillic) -> `jana`
    - `Jana` (Latin) -> `jana`
    - `Yana` (Latin) -> `jana`
  - **All 4 representations converge to identical `jana`!**

#### 4. `ю` (Yu / Ju)
- Phonetically [ju].
- In Macedonian and Serbian, written natively as two letters: `ју` (e.g. `Јулија`).
- In Bulgarian and Russian, written as `ю` (e.g. `Юлия`).
- **Resolution**:
  - By setting `ю` -> `ju` and Latin digraph `yu` -> `ju`:
    - `Юлия` -> `julija`
    - `Јулија` -> `julija`
    - `Julija` -> `julija`
    - `Yulija` -> `julija`
  - **All converge to identical `julija`!**

---

## 5. Pass 5: Leet / SMS Slang

In informal texting across the Balkans:
- `4` represents `ч`, `č`, or `c` (e.g., `Bor4e` -> `borce`, `4ovek` -> `covek`).
- `6` represents `ш`, `š`, or `s` (e.g., `Pe6o` -> `peso`, `6kola` -> `skola`).

---

## 6. End-to-End Equivalence Table

| Search Query | Stored Record Variant | Shrunk Output | Match Status |
| :--- | :--- | :--- | :--- |
| `Борче` | `Borche` | `borce` | **MATCH** |
| `Borče` | `Borce` | `borce` | **MATCH** |
| `Bor4e` | `Борче` | `borce` | **MATCH** |
| `Ѓорѓи` | `Gjorgji` | `gorgi` | **MATCH** |
| `Gorgi` | `Ѓорѓи` | `gorgi` | **MATCH** |
| `Пешо` | `Pesho` | `peso` | **MATCH** |
| `Pešo` | `Pe6o` | `peso` | **MATCH** |
| `Жарко` | `Zharko` | `zarko` | **MATCH** |
| `Žarko` | `Жарко` | `zarko` | **MATCH** |
| `Поща` | `Poshta` | `posta` | **MATCH** |
| `Poshcha` | `Поща` | `posta` | **MATCH** |
| `Јана` | `Яна` | `jana` | **MATCH** |
| `Yana` | `Jana` | `jana` | **MATCH** |
| `Јулија` | `Юлия` | `julija` | **MATCH** |
| `Yulija` | `Julija` | `julija` | **MATCH** |
| `Кръстев` | `Krastev` | `krastev` | **MATCH** |
| `Коњ` | `Konj` | `kon` | **MATCH** |
| `Ѕвонко` | `Dzvonko` | `zvonko` | **MATCH** |
| `Џафер` | `Dzhafer` | `dafer` | **MATCH** |

---

## 7. SQL LIKE Wildcard Safety: Storage vs Query-Time Escaping

### The Architecture Rule
- **Storage Normalization (`SHRINK_CYR_LAT`)**: Runs in `BEFORE INSERT` and `BEFORE UPDATE` triggers. Preserves literal characters `%`, `_`, and `\` so that persistent columns are not polluted with artificial backslashes on disk.
- **Query-Time Escaping (`SHRINK_FOR_LIKE`)**: Runs in search queries. Wraps `SHRINK_CYR_LAT()` and escapes `\` to `\\`, `%` to `\%`, and `_` to `\_`. This prevents user-typed percent signs (e.g. searching `"100%"` or `"Бор%че"`) from acting as accidental SQL wildcards.

### Usage in MySQL Queries:
```sql
-- Safe from wildcard injection:
SELECT * FROM users 
WHERE name_searched LIKE CONCAT('%', SHRINK_FOR_LIKE(?), '%');
```

