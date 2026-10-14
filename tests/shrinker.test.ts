import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Shrinker,
  shrink,
  shrinkForLike,
  matches,
  contains,
  DEFAULT_SHRINK_OPTIONS,
  LATIN_DIGRAPHS_AND_TRIGRAPHS,
  EXTENDED_LATIN_DIGRAPHS,
  LATIN_DIACRITICS_AND_CONSONANTS,
  CYRILLIC_REGIONAL_CONSONANTS,
  CYRILLIC_BASE_CHARACTERS,
  DIALECT_VARIATION_RULES,
  LEET_SLANG_RULES,
  getCompleteRuleSet,
} from '../src/index.ts';

describe('Standalone Shrinker Library', () => {
  describe('Canonical User Walkthrough: Borche Group', () => {
    const borcheVariants = ['Борче', 'Borche', 'Borce', 'Borče', 'Bor4e'];

    it('all variations of "Борче" shrink to identical "borce"', () => {
      for (const variant of borcheVariants) {
        assert.equal(shrink(variant), 'borce', `Failed for variant: ${variant}`);
      }
    });

    it('matches() confirms cross-equivalence for all pairs of "Борче"', () => {
      for (const v1 of borcheVariants) {
        for (const v2 of borcheVariants) {
          assert.equal(matches(v1, v2), true, `Failed matching "${v1}" with "${v2}"`);
        }
      }
    });

    it('does not match non-equivalent names (e.g. Borko)', () => {
      assert.equal(matches('Борче', 'Borko'), false);
      assert.equal(shrink('Borko'), 'borko');
    });
  });

  describe('Canonical User Walkthrough: Pesho and Zharko Groups', () => {
    it('all variations of "Пешо" shrink to "peso"', () => {
      const peshoVariants = ['Пешо', 'Pesho', 'Peso', 'Pešo', 'Pe6o'];
      for (const variant of peshoVariants) {
        assert.equal(shrink(variant), 'peso', `Failed for variant: ${variant}`);
      }
    });

    it('all variations of "Жарко" shrink to "zarko"', () => {
      const zharkoVariants = ['Жарко', 'Zharko', 'Zarko', 'Žarko'];
      for (const variant of zharkoVariants) {
        assert.equal(shrink(variant), 'zarko', `Failed for variant: ${variant}`);
      }
    });
  });

  describe('South Slavic / Macedonian Regional Special Characters', () => {
    it('handles Macedonian Ѓ / gj properly ("Ѓорѓи" == "Gjorgji" == "Gorgi")', () => {
      assert.equal(shrink('Ѓорѓи'), 'gorgi');
      assert.equal(shrink('Gjorgji'), 'gorgi');
      assert.equal(shrink('Gorgi'), 'gorgi');
      assert.equal(matches('Ѓорѓи', 'Gjorgji'), true);
      assert.equal(matches('Ѓорѓи', 'Gorgi'), true);
    });

    it('handles Macedonian Ќ / kj properly ("Никола Ќосев" == "Nikola Kjosev")', () => {
      assert.equal(shrink('Никола Ќосев'), 'nikola kosev');
      assert.equal(shrink('Nikola Kjosev'), 'nikola kosev');
      assert.equal(matches('Никола Ќосев', 'Nikola Kjosev'), true);
    });

    it('handles Macedonian Ѕ / dz properly ("Ѕвонко" == "Dzvonko" == "Zvonko")', () => {
      assert.equal(shrink('Ѕвонко'), 'zvonko');
      assert.equal(shrink('Dzvonko'), 'zvonko');
      assert.equal(shrink('Zvonko'), 'zvonko');
      assert.equal(matches('Ѕвонко', 'Dzvonko'), true);
    });

    it('handles Џ / dzh / dj / dž properly ("Џафер" == "Dzhafer" == "Dzafer")', () => {
      assert.equal(shrink('Џафер'), 'dafer');
      assert.equal(shrink('Dzhafer'), 'dafer');
      assert.equal(shrink('Džafer'), 'dafer');
      assert.equal(shrink('Djafer'), 'dafer');
      assert.equal(matches('Џафер', 'Dzhafer'), true);
    });

    it('handles Љ / lj and Њ / nj properly ("Коњ" == "Konj" -> "kon")', () => {
      assert.equal(shrink('Коњ'), 'kon');
      assert.equal(shrink('Konj'), 'kon');
      assert.equal(matches('Коњ', 'Konj'), true);

      assert.equal(shrink('Љупчо'), 'lupco');
      assert.equal(shrink('Ljupcho'), 'lupco');
      assert.equal(matches('Љупчо', 'Ljupcho'), true);
    });

    it('handles Serbian Ђ and Ћ ("Ђорђе" -> "dorde", "Ћосић" -> "cosic")', () => {
      assert.equal(shrink('Ђорђе'), 'dorde');
      assert.equal(shrink('Djordje'), 'dorde');
      assert.equal(matches('Ђорђе', 'Djordje'), true);

      assert.equal(shrink('Ћосић'), 'cosic');
      assert.equal(shrink('Ćosić'), 'cosic');
      assert.equal(matches('Ћосић', 'Ćosić'), true);
    });
  });

  describe('Dialect Handling for щ, ъ, я, ю', () => {
    describe('Character щ (Sht / Shch)', () => {
      it('universal/balkan mode: collapses поща, poshta, poshcha, posta to "posta"', () => {
        assert.equal(shrink('Поща'), 'posta');
        assert.equal(shrink('Poshta'), 'posta');
        assert.equal(shrink('Poshcha'), 'posta');
        assert.equal(shrink('Posta'), 'posta');
        assert.equal(matches('Поща', 'Poshta'), true);
        assert.equal(matches('Поща', 'Poshcha'), true);
      });

      it('east_slavic mode: maps щ to sc', () => {
        assert.equal(shrink('борщ', { dialect: 'east_slavic' }), 'borsc');
      });
    });

    describe('Character ъ (Hard Sign / Yer Golyam)', () => {
      it('bulgarian/balkan mode: maps ъ to a (Кръстев -> krastev)', () => {
        assert.equal(shrink('Кръстев', { dialect: 'bulgarian' }), 'krastev');
        assert.equal(shrink('Krastev'), 'krastev');
        assert.equal(matches('Кръстев', 'Krastev', { dialect: 'bulgarian' }), true);
        assert.equal(shrink('България', { dialect: 'bulgarian' }), 'balgarija');
      });

      it('east_slavic mode: drops silent hard sign ъ (объект -> obekt)', () => {
        assert.equal(shrink('объект', { dialect: 'east_slavic' }), 'obekt');
        assert.equal(shrink('подъезд', { dialect: 'east_slavic' }), 'podezd');
      });
    });

    describe('Character я (Ya / Ja)', () => {
      it('unifies Cyrillic Яна, South Slavic Јана, Latin Jana, and Latin Yana', () => {
        assert.equal(shrink('Яна'), 'jana');
        assert.equal(shrink('Јана'), 'jana');
        assert.equal(shrink('Jana'), 'jana');
        assert.equal(shrink('Yana'), 'jana');
        assert.equal(matches('Яна', 'Јана'), true);
        assert.equal(matches('Яна', 'Yana'), true);
        assert.equal(matches('Јана', 'Jana'), true);
      });
    });

    describe('Character ю (Yu / Ju)', () => {
      it('unifies Cyrillic Юлия, South Slavic Јулија, Latin Julija, and Latin Yulija', () => {
        assert.equal(shrink('Юлия'), 'julija');
        assert.equal(shrink('Јулија'), 'julija');
        assert.equal(shrink('Julija'), 'julija');
        assert.equal(shrink('Yulija'), 'julija');
        assert.equal(matches('Юлия', 'Јулија'), true);
        assert.equal(matches('Юлия', 'Yulija'), true);
        assert.equal(matches('Јулија', 'Julija'), true);
      });
    });
  });

  describe('Exhaustive Pass Testing', () => {
    it('covers all Latin Digraphs and Trigraphs in order', () => {
      for (const rule of LATIN_DIGRAPHS_AND_TRIGRAPHS) {
        const input = `test_${rule.find}_end`;
        const expected = `test_${rule.replace}_end`;
        assert.equal(shrink(input), expected, `Failed for digraph: ${rule.find}`);
      }
    });

    it('covers all Latin Diacritics and Consonants', () => {
      for (const rule of LATIN_DIACRITICS_AND_CONSONANTS) {
        const input = `pre_${rule.find}_post`;
        const expected = `pre_${rule.replace}_post`;
        assert.equal(shrink(input), expected, `Failed for diacritic: ${rule.find}`);
      }
    });

    it('covers all Cyrillic Regional Consonants', () => {
      for (const rule of CYRILLIC_REGIONAL_CONSONANTS) {
        const input = `а_${rule.find}_б`;
        const expected = `a_${rule.replace}_b`;
        assert.equal(shrink(input), expected, `Failed for Cyrillic regional consonant: ${rule.find}`);
      }
    });

    it('covers all Base Cyrillic Characters', () => {
      for (const rule of CYRILLIC_BASE_CHARACTERS) {
        const input = `x_${rule.find}_y`;
        const expected = `ks_${rule.replace}_y`;
        assert.equal(shrink(input), expected, `Failed for base Cyrillic character: ${rule.find}`);
      }
    });

    it('covers Leet / SMS digit slang', () => {
      for (const rule of LEET_SLANG_RULES) {
        const input = `test${rule.find}test`;
        const expected = `test${rule.replace}test`;
        assert.equal(shrink(input), expected, `Failed for leet rule: ${rule.find}`);
      }
    });

    it('disables Leet when includeLeet is false', () => {
      assert.equal(shrink('Bor4e', { includeLeet: false }), 'bor4e');
      assert.equal(shrink('Pe6o', { includeLeet: false }), 'pe6o');
    });

    it('supports extended digraphs via customRules', () => {
      const customShrinker = new Shrinker({
        customRules: EXTENDED_LATIN_DIGRAPHS,
      });
      assert.equal(customShrinker.shrink('Schubert'), 'subert');
      assert.equal(customShrinker.shrink('Tchaikovsky'), 'caikovsky');
    });

    it('top-level functional contains() helper works', () => {
      assert.equal(contains('Борче Николов', 'borche'), true);
      assert.equal(contains('Борче Николов', 'трајко'), false);
    });

    it('top-level functional shrinkForLike() helper works', () => {
      assert.equal(shrinkForLike('Бор%че'), 'bor\\%ce');
      assert.equal(shrinkForLike(null), null);
      assert.equal(shrinkForLike(undefined), null);
      assert.equal(shrinkForLike('100%_тест'), '100\\%\\_test');
    });
  });

  describe('Null, Undefined and Edge Case Handling', () => {
    it('returns null for null or undefined when allowNull is true', () => {
      assert.equal(shrink(null), null);
      assert.equal(shrink(undefined), null);
      assert.equal(shrink(null, { allowNull: true }), null);
      assert.equal(shrink(undefined, { allowNull: true }), null);
    });

    it('returns empty string for null or undefined when allowNull is false', () => {
      assert.equal(shrink(null, { allowNull: false }), '');
      assert.equal(shrink(undefined, { allowNull: false }), '');
    });

    it('handles empty string properly', () => {
      assert.equal(shrink(''), '');
    });

    it('handles strings with only spaces or symbols', () => {
      assert.equal(shrink('   '), '   ');
      assert.equal(shrink('!@#$%^&*()'), '!@#$%^&*()');
    });

    it('handles cleanPunctuation option', () => {
      assert.equal(shrink('Борче, Николов! #1', { cleanPunctuation: true }), 'borce nikolov 1');
    });

    it('handles preserveCase option', () => {
      const customShrinker = new Shrinker({ preserveCase: true });
      assert.equal(customShrinker.shrink('BOR4E'), 'BORcE');
    });
  });

  describe('Shrinker Class API & Methods', () => {
    it('creates Shrinker with default options matching DEFAULT_SHRINK_OPTIONS', () => {
      const s = new Shrinker();
      assert.equal(s.shrink('Борче'), 'borce');
      assert.deepEqual(s.getRules(), getCompleteRuleSet('universal', true));
    });

    it('supports batch shrinkage via shrinkBatch()', () => {
      const s = new Shrinker();
      const inputs = ['Борче', 'Пешо', 'Жарко', null, undefined];
      const expected = ['borce', 'peso', 'zarko', null, null];
      assert.deepEqual(s.shrinkBatch(inputs), expected);
    });

    it('supports contains() search helper', () => {
      const s = new Shrinker();
      assert.equal(s.contains('Борче Николов', 'borche'), true);
      assert.equal(s.contains('Pesho Ivanov', 'Пешо'), true);
      assert.equal(s.contains('Zharko Dimov', 'Жарко'), true);
      assert.equal(s.contains('Борче Николов', 'трајко'), false);
      assert.equal(s.contains(null, 'test'), false);
      assert.equal(s.contains('test', null), false);
    });

    it('matches() correctly evaluates null handling', () => {
      assert.equal(matches(null, null), true);
      assert.equal(matches(null, 'borce'), false);
      assert.equal(matches('borce', null), false);
      assert.equal(matches('borce', 'borce'), true);
    });

    it('tests all dialect presets via getCompleteRuleSet', () => {
      const dialects = ['universal', 'balkan', 'macedonian', 'bulgarian', 'east_slavic'] as const;
      for (const d of dialects) {
        const rules = getCompleteRuleSet(d, true);
        assert.ok(rules.length > 50, `Rules for ${d} should be populated`);
      }

      // Fallback for unknown dialect
      const fallback = getCompleteRuleSet('unknown' as any, false);
      assert.ok(fallback.length > 50);
    });

    it('supports customRules passed directly to shrink() overrides', () => {
      const res = shrink('foo bar', {
        customRules: [{ find: 'foo', replace: 'baz' }],
      });
      assert.equal(res, 'baz bar');
    });

    it('caches rules per dialect mode', () => {
      const s = new Shrinker();
      const rules1 = s.getRules('macedonian');
      const rules2 = s.getRules('macedonian');
      assert.equal(rules1, rules2, 'Cached rules should return the same reference');
    });
  });
});
