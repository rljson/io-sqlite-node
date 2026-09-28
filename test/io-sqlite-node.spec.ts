// @license
// Copyright (c) 2026 Rljson
//
// Use of this source code is governed by terms that can be
// found in the LICENSE file in the root of this package.

import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { exampleTableCfg, TableCfg } from '@rljson/rljson';

import { IoSqliteNode } from '../src/io-sqlite-node';
import { randomDbName } from '../src/random-db-name';


describe('IoSqlLiteNode', () => {
  let sVN: IoSqliteNode;
  beforeEach(async () => {
    const sqlite = await IoSqliteNode.example();
    sVN = sqlite;
    sVN.dbFileName = randomDbName();
    await sVN.init();
    await sVN.isReady();
  });

  afterEach(async () => {
    await sVN.deleteDatabase();
    if (sVN.undeletedFile) {
      console.warn(
        `Warning: Database file was not deleted: ${sVN.undeletedFile}`,
      );
    }
  });

  describe('execute', () => {
    it('should create a table', async () => {
      await sVN.execute('DROP TABLE IF EXISTS users');
      const result = await sVN.execute(
        'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
      );
      expect(result).toBeDefined();
    });

    it('should insert data', async () => {
      await sVN.execute(
        'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
      );
      const result = await sVN.execute(
        "INSERT INTO users (name) VALUES ('Alice')",
      );
      expect(result).toBeDefined();
    });

    it('should select data', async () => {
      await sVN.execute(
        'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
      );
      const result = await sVN.execute('SELECT * FROM users');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('database operations', () => {
    it('should handle multiple sequential queries', async () => {
      await sVN.execute('DROP TABLE IF EXISTS test');
      await sVN.execute(
        'CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)',
      );
      await sVN.execute("INSERT INTO test (value) VALUES ('first')");
      await sVN.execute("INSERT INTO test (value) VALUES ('second')");
      const result = await sVN.execute('SELECT COUNT(*) as count FROM test');
      expect(result[0].count).toBe(2);
    });

    it('should return empty result for SELECT with no data', async () => {
      await sVN.execute('DROP TABLE IF EXISTS empty');
      await sVN.execute('CREATE TABLE empty (id INTEGER PRIMARY KEY)');
      const result = await sVN.execute('SELECT * FROM empty');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle syntax errors gracefully', async () => {
      await expect(sVN.execute('INVALID SQL QUERY')).rejects.toThrow();
    });

    it('should handle non-existent table errors', async () => {
      await expect(
        sVN.execute('SELECT * FROM nonexistent_table'),
      ).rejects.toThrow();
    });
  });
  describe('status properties', () => {
    describe('isOpen', () => {
      it('should return true when database is open', async () => {
        expect(sVN.isOpen).toBe(true);
      });

      it('should return false when database is closed', async () => {
        await sVN.close();
        expect(sVN.isOpen).toBe(false);
      });
    });

    describe('isReady', () => {
      it('should return true when database is initialized', async () => {
        const result = await sVN.isReady();
        expect(result).toBe(undefined);
      });
    });
  });

  describe('example usage', () => {
    it('should return an IoSqliteServer example', async () => {
      const example = await IoSqliteNode.example();
      expect(example).toBeDefined();
    });

    it('example instance should be operational', async () => {
      const example = await IoSqliteNode.example();
      await example.init();
      const result = example.isOpen;
      expect(result).toBe(true);
      example.deleteDatabase();
    });
  });

  describe('write', () => {
    it('survives two writes that overlap on one connection', async () => {
      // One connection cannot hold two transactions. `_write` wraps its inserts
      // in one and used to `await` inside it, so a second writer reaching
      // `write` while the first was still in its transaction ran straight into
      //
      //   Error: cannot start a transaction within a transaction
      //
      // On the lab this took the node down: the rejection came out of a
      // `Promise.all` in an import started by the mongo edit chain, nothing on
      // that path caught it, and the service restarted in a loop. Two writers
      // sharing one Io is ordinary — the import itself writes its parts with
      // `Promise.all` — so this must simply queue.
      const tableCfg: TableCfg = exampleTableCfg({ key: 'tableA' });
      await sVN.createOrExtendTable({ tableCfg });

      await Promise.all([
        sVN.write({
          data: {
            tableA: { _type: 'components', _data: [{ a: 'first', b: 1 }] },
          },
        }),
        sVN.write({
          data: {
            tableA: { _type: 'components', _data: [{ a: 'second', b: 2 }] },
          },
        }),
      ]);

      // Both writes are there: queueing must not drop one.
      const dump = await sVN.dumpTable({ table: 'tableA' });
      const rows = dump['tableA']._data as Array<{ a: string }>;
      expect(rows.map((r) => r.a).sort()).toEqual(['first', 'second']);
    });

    it('keeps accepting writes after one of them failed', async () => {
      // The queue carries every later write. If a rejected write were left in
      // it, one bad write would fail all writes that follow — a far worse
      // failure than the one being fixed.
      const tableCfg: TableCfg = exampleTableCfg({ key: 'tableA' });
      await sVN.createOrExtendTable({ tableCfg });

      await expect(
        sVN.write({
          data: {
            missingTable: { _type: 'components', _data: [{ a: 'x' }] },
          },
        }),
      ).rejects.toThrow();

      await sVN.write({
        data: { tableA: { _type: 'components', _data: [{ a: 'after', b: 3 }] } },
      });

      const dump = await sVN.dumpTable({ table: 'tableA' });
      const rows = dump['tableA']._data as Array<{ a: string }>;
      expect(rows.map((r) => r.a)).toEqual(['after']);
    });
  });

  describe('readRows', () => {
    it('returns every row when the where clause is empty', async () => {
      // `{}` is no filter, so the answer is the whole table. This backend
      // built `SELECT * FROM t WHERE` with nothing after it, which sqlite
      // refuses as "incomplete input" — a message naming neither the table nor
      // the statement, and so nearly unreadable from a caller's side. On the
      // lab it surfaced as
      //
      //   pump e2eProbe change failed, skipped: Error: incomplete input
      //
      // three documents that never entered the edit chain and so never reached
      // another machine, with a green sync report the whole time. Every mesh
      // test uses `IoMem`, which has always answered `{}` with all rows — which
      // is exactly why the suites stayed green while the lab did not.
      const all = await sVN.readRows({ table: 'tableCfgs', where: {} });
      const rows = all['tableCfgs']._data as Array<{ key: string }>;
      expect(rows.length).toBeGreaterThan(0);

      // The same rows a dump reports, so "everything" means everything.
      const dumped = await sVN.dumpTable({ table: 'tableCfgs' });
      expect(rows.length).toBe(
        (dumped['tableCfgs']._data as unknown[]).length,
      );
    });
  });

  describe('dumps', () => {
    it('should work for all tables', async () => {
      const dump = await sVN.dump();
      expect(dump).toBeDefined();
      expect(typeof dump).toBe('object');
    });

    it('should work for a single table', async () => {
      const dump = await sVN.dumpTable({ table: 'tableCfgs' });
      expect(dump).toBeDefined();
      expect(typeof dump).toBe('object');
    });
  });

  describe('deleteDatabase', () => {
    it('should delete the database file', async () => {
      await sVN.deleteDatabase();
      expect(sVN.undeletedFile).toBeUndefined();
    });

    it('should not throw an error if file does not exist', async () => {
      await sVN.close();
      await expect(sVN.deleteDatabase()).resolves.not.toThrow();
    });
  });

  describe('createDatabase', () => {
    it('should create a new database file', async () => {
      await sVN.deleteDatabase();
      expect(sVN.undeletedFile).toBeUndefined();
      sVN.dbFileName = randomDbName(); //only the name is being changed
      await sVN.openOrCreateDatabase();
      expect(sVN.isOpen).toBe(true);
      await sVN.close();
    });
    it('should create an in-memory database', async () => {
      await sVN.deleteDatabase();
      expect(sVN.undeletedFile).toBeUndefined();
      sVN.dbFileName = undefined; //set to in-memory
      await sVN.openOrCreateDatabase();
      expect(sVN.isOpen).toBe(true);
      await sVN.close();
    });
    it('should reopen an existing database file', async () => {
      await sVN.close();
      await sVN.openOrCreateDatabase();
      expect(sVN.isOpen).toBe(true);
      await sVN.execute(
        'CREATE TABLE test_reopen (id INTEGER PRIMARY KEY, value TEXT)',
      );
      await sVN.execute("INSERT INTO test_reopen (value) VALUES ('data')");
      await sVN.close();
      await sVN.openOrCreateDatabase();
      expect(sVN.isOpen).toBe(true);
      const result = await sVN.execute('SELECT * FROM test_reopen');
      expect(result.length).toBe(1);
      expect(result[0].value).toBe('data');
      await sVN.close();
    });
    // A caller that has already decided where its database belongs — beside the
    // data it describes — must be able to say so. Prefixing an absolute path
    // produced `./data//Users/.../tree.sqlite`, a path relative to whatever
    // directory the process happened to start in, which for a service is
    // anywhere at all. Two callers pointing at different folders would also
    // collide under a single `./data`.
    it('takes an absolute path as given', async () => {
      await sVN.deleteDatabase();
      const absolute = join(tmpdir(), `abs-${randomDbName()}`);
      sVN.dbFileName = absolute;
      expect(sVN.dbFileName).toBe(absolute);
      await sVN.openOrCreateDatabase();
      expect(sVN.isOpen).toBe(true);
      expect(existsSync(absolute)).toBe(true);
      await sVN.close();
      rmSync(absolute, { force: true });
    });

    // A bare name still lands in ./data, so existing callers are unaffected.
    it('still puts a bare name under ./data', async () => {
      await sVN.deleteDatabase();
      const bare = randomDbName();
      sVN.dbFileName = bare;
      expect(sVN.dbFileName).toBe(`./data/${bare}`);
      await sVN.openOrCreateDatabase();
      await sVN.close();
    });

    it('should return the current database file name', async () => {
      await sVN.deleteDatabase();
      const dbName = randomDbName();
      sVN.dbFileName = dbName;
      await sVN.openOrCreateDatabase();
      expect(sVN.dbFileName).toContain(dbName);
    });
  });
});
