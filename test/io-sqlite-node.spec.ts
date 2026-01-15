// @license
// Copyright (c) 2026 Rljson
//
// Use of this source code is governed by terms that can be
// found in the LICENSE file in the root of this package.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
    it('should return the current database file name', async () => {
      await sVN.deleteDatabase();
      const dbName = randomDbName();
      sVN.dbFileName = dbName;
      await sVN.openOrCreateDatabase();
      expect(sVN.dbFileName).toContain(dbName);
    });
  });
});
