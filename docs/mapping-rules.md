# Canonical Mapping Rules & Dialect Specifications

This document defines the comprehensive character reduction tables and regional dialect handling rules implemented across the MySQL stored function and TypeScript shrinker engine.

---

## 1. Pass 1: Latin Digraphs & Trigraphs

Processed before single-character substitutions so that multi-character phonetic clusters are collapsed cleanly. Digraphs are ordered longest-first.

| Input | Target Output | Phonetic Target / Slavic Equivalent | Dialect / Usage Context |
| :--- | :--- | :--- | :--- |
| `shch` | **`st`** | `щ` | Russian / Ukrainian transliteration (Universal mode folds to `st`) |
| `sht` | **`st`** | `щ` | Bulgarian standard transliteration |
| `dzh` | **`d`** | `џ` | South Slavic trigraph |
| `dž` | **`d`** | `џ` | Gaj's Latin alphabet digraph |
| `dj` | **`d`** | `ђ` / `џ` | Serbian / Macedonian informal Latin |
| `dz` | **`z`** | `ѕ` | Macedonian regional affricate |
| `gj` | **`g`** | `ѓ` | Macedonian regional voiced palatal plosive |
| `kj` | **`k`** | `ќ` | Macedonian regional voiceless palatal plosive |
| `lj` | **`l`** | `љ` | Serbian / Macedonian palatal lateral approximant |
| `nj` | **`n`** | `њ` | Serbian / Macedonian palatal nasal |
| `ch` | **`c`** | `ч` / `č` / `ć` | Universal Latin digraph for voiceless postalveolar affricate |
| `sh` | **`s`** | `ш` / `š` | Universal Latin digraph for voiceless postalveolar fricative |
| `zh` | **`z`** | `ж` / `ž` | Universal Latin digraph for voiced postalveolar fricative |
| `ts` | **`c`** | `ц` | Voiceless alveolar affricate |
| `tz` | **`c`** | `ц` | German-influenced transcription |
| `kh` | **`h`** | `х` | Voiceless velar fricative |
| `ya` | **`ja`** | `я` | Iotated vowel (matches `ја` and `ja`) |
| `yu` | **`ju`** | `ю` | Iotated vowel (matches `ју` and `ju`) |

---

## 2. Pass 2: Latin Diacritics & Extended Consonants

Normalizes accented Latin letters across Gaj's alphabet, Central European, and Western European alphabets to ASCII base consonants:

| Input Character | Base Output | Origin / Notes |
| :--- | :--- | :--- |
| `č`, `ć`, `ç` | **`c`** | South / West Slavic affricates |
| `š`, `ś`, `ş`, `ș` | **`s`** | Sibilant fricatives |
| `ž`, `ź`, `ż` | **`z`** | Voiced fricatives |
| `đ`, `ď` | **`d`** | Serbian `đ` / Czech `ď` |
| `ť` | **`t`** | Czech / Slovak palatal t |
| `ň`, `ñ` | **`n`** | Czech `ň` / Spanish `ñ` |
| `ľ`, `ĺ`, `ł` | **`l`** | Slovak / Polish lateral consonants |
| `ŕ`, `ř` | **`r`** | Slovak / Czech alveolar trills |
| `w` | **`v`** | Folds to `v` for Slavic alignment |
| `q` | **`k`** | Folds to base plosive `k` |
| `x` | **`ks`** | Folds to double consonant `ks` |
| `á`, `à`, `â`, `ä`, `å`, `ã`, `ā` | **`a`** | Vowel diacritic stripping |
| `é`, `è`, `ê`, `ë`, `ē`, `ě` | **`e`** | Vowel diacritic stripping |
| `í`, `ì`, `î`, `ï`, `ī` | **`i`** | Vowel diacritic stripping |
| `ó`, `ò`, `ô`, `ö`, `ő`, `õ`, `ø` | **`o`** | Vowel diacritic stripping |
| `ú`, `ù`, `û`, `ü`, `ű`, `ū` | **`u`** | Vowel diacritic stripping |
| `ý`, `ÿ` | **`y`** | Vowel diacritic stripping |

---

## 3. Pass 3 & 4: Cyrillic Regional Letters & Dialects

Slavic Cyrillic letters are reduced to match their Latin base counterparts.

### Affricates and Regional Consonants
| Cyrillic Letter | Target Output | Phonetic Context | Equivalent Latin Inputs |
| :--- | :--- | :--- | :--- |
| **ч** | **`c`** | Voiceless postalveolar affricate | `ch`, `c`, `č`, `4` |
| **ш** | **`s`** | Voiceless postalveolar fricative | `sh`, `s`, `š`, `6` |
| **ж** | **`z`** | Voiced postalveolar fricative | `zh`, `z`, `ž` |
| **ц** | **`c`** | Voiceless alveolar affricate | `ts`, `tz`, `c` |
| **х** | **`h`** | Voiceless velar fricative | `kh`, `h` |
| **џ** | **`d`** | Voiced postalveolar affricate | `dzh`, `dj`, `dž`, `d` |
| **ђ** | **`d`** | Serbian voiced palatal affricate | `dj`, `đ`, `d` |
| **ћ** | **`c`** | Serbian voiceless palatal affricate | `c`, `ć` |
| **ѓ** | **`g`** | Macedonian voiced palatal plosive | `gj`, `g` |
| **ќ** | **`k`** | Macedonian voiceless palatal plosive | `kj`, `k` |
| **ѕ** | **`z`** | Macedonian voiced alveolar affricate | `dz`, `z` |
| **љ** | **`l`** | Serbian/Macedonian palatal lateral | `lj`, `l` |
| **њ** | **`n`** | Serbian/Macedonian palatal nasal | `nj`, `n` |
| **ґ** | **`g`** | Ukrainian hard g | `g` |
| **ў** | **`u`** | Belarusian short u | `u`, `w` |

### Dialect Modes for Ambiguous Characters (`щ`, `ъ`, `я`, `ю`)

| Character | Mode: `universal` (Default) | Mode: `bulgarian` | Mode: `east_slavic` | Mode: `base_vowel` |
| :--- | :--- | :--- | :--- | :--- |
| **щ** | `st` | `st` | `sc` | `st` |
| **ъ** | `a` | `a` | `''` (omitted) | `a` |
| **я** | `ja` | `ja` | `ja` | `a` |
| **ю** | `ju` | `ju` | `ju` | `u` |

- **`щ` (Sht / Shch)**: In Bulgarian and South Slavic, `щ` is pronounced `[ʃt]` (`поща` -> `posta`, matching `poshta`). In East Slavic (Russian/Ukrainian), it is pronounced `[ɕː]` or `[ʃtʃ]`.
- **`ъ` (Hard sign / Yer Golyam)**: In Bulgarian, `ъ` is a distinct vowel `[ɤ]` mapped officially to `a` (e.g. `Кръстев` -> `krastev`). In Russian, it is a silent hard sign indicating iotated separation, omitted in East Slavic search.
- **`я` and `ю`**: In Universal mode, `я` -> `ja` and `ю` -> `ju`, ensuring that `Яна`, `Jana`, and `Yana` all resolve to `jana`.

---

## 4. Pass 5: Base Cyrillic to ASCII

Standard single-character Cyrillic mappings:

```
а -> a,  б -> b,  в -> v,  г -> g,  д -> d,  е -> e,  ё -> e,  є -> e,
з -> z,  и -> i,  і -> i,  ї -> i,  й -> j,  ј -> j,  к -> k,  л -> l,
м -> m,  н -> n,  о -> o,  п -> p,  р -> r,  с -> s,  т -> t,  у -> u,
ф -> f,  ы -> i,  э -> e,  ь -> '' (dropped)
```

---

## 5. Pass 6: SMS / Leet Digits

Slavic digital culture, gaming, and SMS shorthand frequently substitute numerals for Cyrillic letters that resemble them graphically or phonetically:
- **`4`** (represents `ч` / `c`): `Bor4e` → `borce`
- **`6`** (represents `ш` / `s`): `Pe6o` → `peso`
