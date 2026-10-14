import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  shrink,
  shrinkForLike,
  buildShrunkLike,
  buildSqlFunctionLike,
  buildNgramMatch,
} from '../src/index.ts';

interface UserRecord {
  id: number;
  name: string;
  email: string;
  name_searched: string | null;
}

/**
 * In-Memory SQL Search Simulator representing the MySQL `users` table,
 * with BEFORE INSERT and BEFORE UPDATE triggers executing SHRINK_CYR_LAT().
 */
class UsersTableSimulator {
  private records: UserRecord[] = [];
  private nextId = 1;

  public insert(name: string, email: string): UserRecord {
    // Triggers execute: SET NEW.name_searched = SHRINK_CYR_LAT(NEW.name);
    const record: UserRecord = {
      id: this.nextId++,
      name,
      email,
      name_searched: shrink(name),
    };
    this.records.push(record);
    return record;
  }

  public update(id: number, fields: { name?: string | null; email?: string }): UserRecord {
    const record = this.records.find(r => r.id === id);
    if (!record) {
      throw new Error(`Record with id ${id} not found`);
    }

    if (fields.email !== undefined) {
      record.email = fields.email;
    }

    // Trigger optimization: IF (NEW.name <=> OLD.name) = 0
    if (fields.name !== undefined && fields.name !== record.name) {
      record.name = fields.name ?? '';
      record.name_searched = fields.name ? shrink(fields.name) : null;
    }

    return record;
  }

  public queryLike(sqlLikePattern: string): UserRecord[] {
    // Converts SQL LIKE pattern (e.g. '%borce%', '%bor\\%ce%') to RegEx
    // Escapes regex specials except SQL wildcards (% and _)
    let regexStr = '^';
    let i = 0;
    const len = sqlLikePattern.length;

    while (i < len) {
      const char = sqlLikePattern[i];
      if (char === '\\' && i + 1 < len) {
        // Escaped character (e.g. \% or \_)
        const nextChar = sqlLikePattern[i + 1];
        regexStr += `\\${nextChar}`;
        i += 2;
      } else if (char === '%') {
        regexStr += '.*';
        i++;
      } else if (char === '_') {
        regexStr += '.';
        i++;
      } else {
        // Escape special regex characters
        if (['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']'].includes(char)) {
          regexStr += `\\${char}`;
        } else {
          regexStr += char;
        }
        i++;
      }
    }
    regexStr += '$';

    const regex = new RegExp(regexStr, 'i');
    return this.records.filter(r => r.name_searched !== null && regex.test(r.name_searched));
  }

  public getAll(): readonly UserRecord[] {
    return this.records;
  }
}

describe('Step 4 Integration Tests: Cross-Script MySQL Search', () => {
  const db = new UsersTableSimulator();

  // Populate table with variations
  const borche1 = db.insert('Борче Николов', 'borce.n@example.com');    // Cyrillic
  const borche2 = db.insert('Borche Trajkov', 'borche.t@example.com');  // Latin digraph
  const borche3 = db.insert('Borce Stojanov', 'borce.s@example.com');   // Latin plain
  const borche4 = db.insert('Borče Iliev', 'borce.i@example.com');      // Gaj's Latin accent
  const borche5 = db.insert('Bor4e Dimov', 'borce.d@example.com');      // Leet/SMS slang
  const borko   = db.insert('Borko Jovanov', 'borko@example.com');      // Negative case: should NOT match

  const pesho1  = db.insert('Пешо Петров', 'pesho.p@example.com');
  const pesho2  = db.insert('Pesho Ivanov', 'pesho.i@example.com');
  const pesho3  = db.insert('Peso Georgiev', 'peso.g@example.com');
  const pesho4  = db.insert('Pešo Ristev', 'pesho.r@example.com');
  const pesho5  = db.insert('Pe6o Dimov', 'pesho.d@example.com');

  const zharko1 = db.insert('Жарко Коцев', 'zharko.k@example.com');
  const zharko2 = db.insert('Zharko Vanev', 'zharko.v@example.com');
  const zharko3 = db.insert('Žarko Iliev', 'zharko.i@example.com');
  const zharko4 = db.insert('Zarko Dimov', 'zarko.d@example.com');

  const gjorgji1 = db.insert('Ѓорѓи Спасов', 'gjorgji.s@example.com');
  const gjorgji2 = db.insert('Gjorgji Vasilev', 'gjorgji.v@example.com');
  const gjorgji3 = db.insert('Gorgi Stojkov', 'gorgi.s@example.com');

  const kjosev1 = db.insert('Никола Ќосев', 'kosev1@example.com');
  const kjosev2 = db.insert('Nikola Kjosev', 'kosev2@example.com');

  const poshta1 = db.insert('Поща София', 'poshta1@example.com');
  const poshta2 = db.insert('Poshta Plovdiv', 'poshta2@example.com');
  const poshta3 = db.insert('Poshcha Varna', 'poshta3@example.com');
  const poshta4 = db.insert('Posta Burgas', 'poshta4@example.com');

  const pamuk = db.insert('100% Памук Д.О.О.', 'pamuk@example.com');
  const literalPercent = db.insert('Бор%че Компани', 'bor_pct@example.com');
  const borislavce = db.insert('Бориславче Трајков', 'borislavce@example.com');

  describe('The Borche Group Verification', () => {
    const borcheIds = [borche1.id, borche2.id, borche3.id, borche4.id, borche5.id];

    it('Searching with Cyrillic "Борче" matches all 4+1 Borche variants and excludes Borko', () => {
      const q = buildShrunkLike('name_searched', 'Борче', 'both');
      assert.equal(q.sql, 'name_searched LIKE ?');
      assert.equal(q.param, '%borce%');

      const results = db.queryLike(q.param);
      const resultIds = results.map(r => r.id);

      // Verify all Borche variations matched
      for (const expectedId of borcheIds) {
        assert.ok(resultIds.includes(expectedId), `Missing expected Borche variant ID ${expectedId}`);
      }

      // Verify Borko is NOT matched
      assert.ok(!resultIds.includes(borko.id), 'Borko must not match Борче query');
    });

    it('Searching with Latin digraph "Borche" matches all variations', () => {
      const q = buildShrunkLike('name_searched', 'Borche', 'both');
      assert.equal(q.param, '%borce%');

      const results = db.queryLike(q.param);
      const resultIds = results.map(r => r.id);
      for (const expectedId of borcheIds) {
        assert.ok(resultIds.includes(expectedId));
      }
      assert.ok(!resultIds.includes(borko.id));
    });

    it('Searching with Latin plain "Borce" matches all variations', () => {
      const q = buildShrunkLike('name_searched', 'Borce', 'both');
      const results = db.queryLike(q.param);
      const resultIds = results.map(r => r.id);
      for (const expectedId of borcheIds) {
        assert.ok(resultIds.includes(expectedId));
      }
    });

    it('Searching with Gaj accent "Borče" matches all variations', () => {
      const q = buildShrunkLike('name_searched', 'Borče', 'both');
      const results = db.queryLike(q.param);
      const resultIds = results.map(r => r.id);
      for (const expectedId of borcheIds) {
        assert.ok(resultIds.includes(expectedId));
      }
    });

    it('Searching with Leet slang "Bor4e" matches all variations', () => {
      const q = buildShrunkLike('name_searched', 'Bor4e', 'both');
      const results = db.queryLike(q.param);
      const resultIds = results.map(r => r.id);
      for (const expectedId of borcheIds) {
        assert.ok(resultIds.includes(expectedId));
      }
    });
  });

  describe('The Pesho and Zharko Groups Verification', () => {
    it('all variations of Pesho match queries in Cyrillic, digraph, accent, and slang', () => {
      const queries = ['Пешо', 'Pesho', 'Peso', 'Pešo', 'Pe6o'];
      const expectedIds = [pesho1.id, pesho2.id, pesho3.id, pesho4.id, pesho5.id];

      for (const term of queries) {
        const q = buildShrunkLike('name_searched', term);
        const results = db.queryLike(q.param);
        const resultIds = results.map(r => r.id);
        for (const expId of expectedIds) {
          assert.ok(resultIds.includes(expId), `Query "${term}" missed ID ${expId}`);
        }
      }
    });

    it('all variations of Zharko match queries in Cyrillic, digraph, accent, and plain', () => {
      const queries = ['Жарко', 'Zharko', 'Zarko', 'Žarko'];
      const expectedIds = [zharko1.id, zharko2.id, zharko3.id, zharko4.id];

      for (const term of queries) {
        const q = buildShrunkLike('name_searched', term);
        const results = db.queryLike(q.param);
        const resultIds = results.map(r => r.id);
        for (const expId of expectedIds) {
          assert.ok(resultIds.includes(expId), `Query "${term}" missed ID ${expId}`);
        }
      }
    });
  });

  describe('Macedonian & Bulgarian Regional Consonant Verification', () => {
    it('matches Macedonian Ѓ / gj / g across all representations', () => {
      const expectedIds = [gjorgji1.id, gjorgji2.id, gjorgji3.id];
      for (const term of ['Ѓорѓи', 'Gjorgji', 'Gorgi']) {
        const q = buildShrunkLike('name_searched', term);
        const results = db.queryLike(q.param);
        const resultIds = results.map(r => r.id);
        for (const expId of expectedIds) {
          assert.ok(resultIds.includes(expId));
        }
      }
    });

    it('matches Macedonian Ќ / kj across all representations', () => {
      const expectedIds = [kjosev1.id, kjosev2.id];
      for (const term of ['Ќосев', 'Kjosev']) {
        const q = buildShrunkLike('name_searched', term);
        const results = db.queryLike(q.param);
        const resultIds = results.map(r => r.id);
        for (const expId of expectedIds) {
          assert.ok(resultIds.includes(expId));
        }
      }
    });

    it('matches Bulgarian щ / sht / shch / st across all representations', () => {
      const expectedIds = [poshta1.id, poshta2.id, poshta3.id, poshta4.id];
      for (const term of ['Поща', 'Poshta', 'Poshcha', 'Posta']) {
        const q = buildShrunkLike('name_searched', term);
        const results = db.queryLike(q.param);
        const resultIds = results.map(r => r.id);
        for (const expId of expectedIds) {
          assert.ok(resultIds.includes(expId));
        }
      }
    });
  });

  describe('Percent Escaping & Wildcard Safety Verification', () => {
    it('storage does NOT inject backslashes into name_searched for "100% Cotton"', () => {
      assert.equal(pamuk.name_searched, '100% pamuk d.o.o.');
    });

    it('shrinkForLike escapes % so user-typed wildcards do not cause accidental matches', () => {
      // Searching for literal 'Бор%че'
      const searchParam = `%${shrinkForLike('Бор%че')}%`;
      assert.equal(searchParam, '%bor\\%ce%');

      const results = db.queryLike(searchParam);
      const resultIds = results.map(r => r.id);

      // Must match literal 'Бор%че Компани'
      assert.ok(resultIds.includes(literalPercent.id));

      // Must NOT match 'Бориславче'
      assert.ok(!resultIds.includes(borislavce.id), 'Must not match Borislavce via wildcard injection');
    });

    it('shrinkForLike safely matches literal percent sign in "100%"', () => {
      const searchParam = `%${shrinkForLike('100%')}%`;
      assert.equal(searchParam, '%100\\%%');

      const results = db.queryLike(searchParam);
      const resultIds = results.map(r => r.id);
      assert.ok(resultIds.includes(pamuk.id));
    });
  });

  describe('Query Builder Helpers Verification', () => {
    it('buildShrunkLike handles all wildcard modes', () => {
      assert.deepEqual(buildShrunkLike('name_searched', 'Борче', 'both'), {
        sql: 'name_searched LIKE ?',
        param: '%borce%',
      });

      assert.deepEqual(buildShrunkLike('name_searched', 'Борче', 'prefix'), {
        sql: 'name_searched LIKE ?',
        param: 'borce%',
      });

      assert.deepEqual(buildShrunkLike('name_searched', 'Борче', 'suffix'), {
        sql: 'name_searched LIKE ?',
        param: '%borce',
      });

      assert.deepEqual(buildShrunkLike('name_searched', 'Борче', 'exact'), {
        sql: 'name_searched LIKE ?',
        param: 'borce',
      });
    });

    it('buildSqlFunctionLike generates correct SQL expressions with SHRINK_FOR_LIKE', () => {
      assert.deepEqual(buildSqlFunctionLike('name_searched', 'Борче', 'both'), {
        sql: "name_searched LIKE CONCAT('%', SHRINK_FOR_LIKE(?), '%')",
        param: 'Борче',
      });

      assert.deepEqual(buildSqlFunctionLike('name_searched', 'Борче', 'prefix'), {
        sql: "name_searched LIKE CONCAT(SHRINK_FOR_LIKE(?), '%')",
        param: 'Борче',
      });

      assert.deepEqual(buildSqlFunctionLike('name_searched', 'Борче', 'suffix'), {
        sql: "name_searched LIKE CONCAT('%', SHRINK_FOR_LIKE(?))",
        param: 'Борче',
      });

      assert.deepEqual(buildSqlFunctionLike('name_searched', 'Борче', 'exact'), {
        sql: 'name_searched LIKE SHRINK_FOR_LIKE(?)',
        param: 'Борче',
      });
    });

    it('buildNgramMatch generates correct fulltext MATCH statements', () => {
      assert.deepEqual(buildNgramMatch('name_searched', 'Борче'), {
        sql: 'MATCH(name_searched) AGAINST(? IN BOOLEAN MODE)',
        param: 'borce',
      });

      assert.deepEqual(buildNgramMatch('name_searched', 'Борче', 'NATURAL LANGUAGE MODE'), {
        sql: 'MATCH(name_searched) AGAINST(? IN NATURAL LANGUAGE MODE)',
        param: 'borce',
      });
    });

    it('handles null and undefined terms in query builders gracefully', () => {
      assert.deepEqual(buildShrunkLike('name_searched', null as any), {
        sql: 'name_searched LIKE ?',
        param: '%%',
      });

      assert.deepEqual(buildNgramMatch('name_searched', null as any), {
        sql: 'MATCH(name_searched) AGAINST(? IN BOOLEAN MODE)',
        param: '',
      });
    });
  });

  describe('Database Trigger Updates Verification', () => {
    it('BEFORE UPDATE recalculates name_searched when name is updated', () => {
      const user = db.insert('Борче Прв', 'test1@example.com');
      assert.equal(user.name_searched, 'borce prv');

      db.update(user.id, { name: 'Пешо Втор' });
      assert.equal(user.name_searched, 'peso vtor');
    });

    it('BEFORE UPDATE ignores name_searched when only email is updated', () => {
      const user = db.insert('Жарко Тret', 'test2@example.com');
      assert.equal(user.name_searched, 'zarko tret');

      db.update(user.id, { email: 'new_email@example.com' });
      assert.equal(user.email, 'new_email@example.com');
      assert.equal(user.name_searched, 'zarko tret');
    });
  });
});
