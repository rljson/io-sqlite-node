// @license
// Copyright (c) 2025 Rljson
//
// Use of this source code is governed by terms that can be
// found in the LICENSE file in the root of this package.

import { TableCfg } from '@rljson/rljson';

// import * as fs from 'fs';
import { beforeEach, describe, expect, it } from 'vitest';

import { IoSqlite } from '../src/io-sqlite';

import { expectGolden } from './setup/goldens';

describe('IoSqlite', () => {
  let ioSql: IoSqlite;

  beforeEach(async () => {
    // Create new database
    ioSql = await IoSqlite.example();
  });

  it('should validate a io-sqlite', () => {
    expect(ioSql).toBeDefined();
  });

  describe('creation and retrieval', async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Add a short delay
    //await testDb.isReady();
    it('should return all tables', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Add a short delay

      // Execute example
      const contentOfTables = await ioSql.dump();
      await expectGolden('io-sqlite/db-content.json').toBe(contentOfTables);
    });
  });

  describe('create table', async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Add a short delay
    it('should wait until the database is not consumed by other processes', async () => {
      let isReady = false;
      while (!isReady) {
        try {
          await ioSql.isReady();
          isReady = true;
        } catch (error: any) {
          console.log(error.message);
          await new Promise((resolve) => setTimeout(resolve, 500)); // Retry after a short delay
        }
      }
    });
    it('should create a table', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Add a short delay
      // Execute example
      const tableCfg: TableCfg = {
        key: 'table1',
        isHead: false,
        isRoot: false,
        isShared: true,
        columns: [
          {
            key: '_hash',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'id',
            type: 'number',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'name',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
        ],
        type: 'cakes',
        version: 1,
      };
      await ioSql.createOrExtendTable({ tableCfg });
    });
  });

  describe('parseDataTest', () => {
    it('should correctly parse data based on the table configuration', async () => {
      const tableCfg: TableCfg = {
        key: 'table1',
        isHead: false,
        isRoot: false,
        isShared: true,
        columns: [
          {
            key: '_hash',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'id',
            type: 'number',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'name',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
        ],
        type: 'cakes',
        version: 1,
      };

      const rawData = [
        { _hash_col: 'abc123', id_col: 1, name_col: 'Chocolate Cake' },
        { _hash_col: 'def456', id_col: 2, name_col: 'Vanilla Cake' },
      ];

      const parsedData = ioSql.parseDataTest(rawData, tableCfg);

      expect(parsedData).toEqual([
        { _hash: 'abc123', id: 1, name: 'Chocolate Cake' },
        { _hash: 'def456', id: 2, name: 'Vanilla Cake' },
      ]);
    });

    it('should handle missing columns gracefully', async () => {
      const tableCfg: TableCfg = {
        key: 'table1',
        isHead: false,
        isRoot: false,
        isShared: true,
        columns: [
          {
            key: '_hash',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'id',
            type: 'number',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'name',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
        ],
        type: 'cakes',
        version: 1,
      };

      const rawData = [
        { _hash_col: 'abc123', id_col: 1 }, // Missing 'name'
        { _hash_col: 'def456', id_col: 2, name_col: 'Vanilla Cake' },
      ];

      // Call the private _parseData method using a workaround
      const parsedData = (ioSql as any)._parseData(rawData, tableCfg);

      expect(parsedData).toEqual([
        { _hash: 'abc123', id: 1 },
        { _hash: 'def456', id: 2, name: 'Vanilla Cake' },
      ]);
    });
  });

  // describe('exampleDbDir', () => {
  //   it('should create a temporary directory if no directory is provided', async () => {
  //     const tempDir = await IoSqlite.exampleDbDir();
  //     expect(tempDir).toBeDefined();
  //     expect(fs.existsSync(tempDir)).toBe(true);

  //     // Clean up
  //     fs.rmSync(tempDir, { recursive: true });
  //   });

  //   it('should use the provided directory if it exists', async () => {
  //     const realDir: string = 'custom-PAkvWM';
  //     const resultDir = await IoSqlite.exampleDbDir(realDir);

  //     expect(resultDir).toBe(resultDir);
  //     expect(fs.existsSync(resultDir)).toBe(true);

  //     // Clean up
  //     fs.rmSync(resultDir, { recursive: true });
  //   });

  //   it('should create the provided directory if it does not exist', async () => {
  //     const realDir: string = 'nonexistent-dir';
  //     const resultDir = await IoSqlite.exampleDbDir(realDir);

  //     expect(resultDir).toBe(resultDir);
  //     expect(fs.existsSync(resultDir)).toBe(true);

  //     // Clean up
  //     fs.rmSync(resultDir, { recursive: true });
  //   });
  // });

  describe('alltableKeys', () => {
    it('should return all table keys in the database', async () => {
      // Create some tables
      const tableCfg1: TableCfg = {
        key: 'table1',
        isHead: false,
        isRoot: false,
        isShared: true,
        columns: [
          {
            key: '_hash',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'id',
            type: 'number',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'name',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
        ],
        type: 'cakes',
        version: 1,
      };

      const tableCfg2: TableCfg = {
        key: 'table2',
        isHead: false,
        isRoot: false,
        isShared: true,
        columns: [
          {
            key: '_hash',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'price',
            type: 'number',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'description',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
        ],
        type: 'layers',
        version: 1,
      };

      await ioSql.createOrExtendTable({ tableCfg: tableCfg1 });
      await ioSql.createOrExtendTable({ tableCfg: tableCfg2 });

      // Retrieve all table keys
      const tableKeys = await ioSql.alltableKeys();

      // Validate the result
      expect(tableKeys).toContain('table1');
      expect(tableKeys).toContain('table2');
      // 4 keys because of the default tables
      expect(tableKeys.length).toBe(4);
    });

    it('should return an empty array if no tables exist', async () => {
      // Ensure no table apart from the defaults exist
      const tableKeys = await ioSql.alltableKeys();

      // Validate the result
      expect(tableKeys).toEqual(['tableCfgs', 'revisions']);
    });
  });

  describe('readRows', () => {
    it('should return rows matching the where clause', async () => {
      // Create a table
      const tableCfg: TableCfg = {
        key: 'table1',
        isHead: false,
        isRoot: false,
        isShared: true,
        columns: [
          {
            key: '_hash',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'id',
            type: 'number',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'name',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'booleanField',
            type: 'boolean',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'objectField',
            type: 'json',
            titleLong: '',
            titleShort: '',
          },
        ],
        type: 'cakes',
        version: 1,
      };
      await ioSql.createOrExtendTable({ tableCfg });

      // Insert some rows
      await ioSql.write({
        data: {
          table1: {
            _type: 'components',
            _data: [
              {
                _hash: 'wRPQwAYFounLVeatEH_cAo',
                id: 1,
                name: 'Chocolate Cake',
                booleanField: true,
                objectField: { a: 1, b: 2 },
              },
              {
                _hash: '4kiVmrRE_4xn_ccnVZoTUw',
                id: 2,
                name: 'Vanilla Cake',
                booleanField: false,
                objectField: { c: 3, d: 4 },
              },
              {
                _hash: 'qdXNvOnziifLZmiRaR7N-9',
                id: 3,
                name: 'Red Velvet Cake',
                booleanField: true,
                objectField: { e: 5, f: 6 },
              },
            ],
          },
        },
      });

      // Read rows with a where clause for a numeric field
      const result = await ioSql.readRows({
        table: 'table1',
        where: { id: 2 },
      });

      // Validate the result
      expect(result).toEqual({
        table1: {
          _data: [
            {
              _hash: '4kiVmrRE_4xn_ccnVZoTUw',
              booleanField: false,
              id: 2,
              name: 'Vanilla Cake',
              objectField: {
                _hash: 'Qlcrmjw9mw2A86SfmSg-1Z',
                c: 3,
                d: 4,
              },
            },
          ],
          _hash: 'G28AKVKMaLyRyR0P5_o1bV',
          _type: 'cakes',
        },
      });
      // Read rows with a where clause for a boolean field
      const result2 = await ioSql.readRows({
        table: 'table1',
        where: { booleanField: false },
      });

      // Validate the result
      expect(result2).toEqual({
        table1: {
          _data: [
            {
              _hash: '4kiVmrRE_4xn_ccnVZoTUw',
              booleanField: false,
              id: 2,
              name: 'Vanilla Cake',
              objectField: {
                _hash: 'Qlcrmjw9mw2A86SfmSg-1Z',
                c: 3,
                d: 4,
              },
            },
          ],
          _hash: 'G28AKVKMaLyRyR0P5_o1bV',
          _type: 'cakes',
        },
      });
      // Read rows with a where clause for an object field
      const result3 = await ioSql.readRows({
        table: 'table1',
        where: {
          objectField: { c: 3, d: 4, _hash: 'Qlcrmjw9mw2A86SfmSg-1Z' },
          id: 2,
        },
      });

      // Validate the result
      expect(result3).toEqual({
        table1: {
          _data: [
            {
              _hash: '4kiVmrRE_4xn_ccnVZoTUw',
              booleanField: false,
              id: 2,
              name: 'Vanilla Cake',
              objectField: {
                _hash: 'Qlcrmjw9mw2A86SfmSg-1Z',
                c: 3,
                d: 4,
              },
            },
          ],
          _hash: 'G28AKVKMaLyRyR0P5_o1bV',
          _type: 'cakes',
        },
      });
    });

    it('should return an empty array if no rows match the where clause', async () => {
      // Create a table
      const tableCfg: TableCfg = {
        key: 'table1',
        isHead: false,
        isRoot: false,
        isShared: true,
        columns: [
          {
            key: '_hash',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'id',
            type: 'number',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'name',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
        ],
        type: 'cakes',
        version: 1,
      };
      await ioSql.createOrExtendTable({ tableCfg });

      // Insert some rows
      await ioSql.write({
        data: {
          table1: {
            _type: 'components',
            _data: [
              {
                _hash: '8aWgduyvFL4rfPHkUPfsU1',
                id: 1,
                name: 'Chocolate Cake',
              },
              { _hash: '7P6ACfGigO5ZC8xHbd2E7U', id: 2, name: 'Vanilla Cake' },
            ],
          },
        },
      });

      // Read rows with a where clause that doesn't match any rows
      const result = await ioSql.readRows({
        table: 'table1',
        where: { id: 99 },
      });

      // Validate the result
      expect(result).toEqual({
        table1: {
          _data: [],
          _hash: 'TBokqOt0CS-vORCNBj1owR',
          _type: 'cakes',
        },
      });
    });

    it('should throw an error if the table does not exist', async () => {
      await expect(
        ioSql.readRows({
          table: 'nonexistent_table',
          where: { id: 1 },
        }),
      ).rejects.toThrow('Table "nonexistent_table" not found');
    });
  });

  describe('rawTableCfgs', () => {
    it('should return the raw table configurations for all tables', async () => {
      // Create two tables with different configs
      const tableCfg1: TableCfg = {
        key: 'table1',
        isHead: false,
        isRoot: false,
        isShared: true,
        columns: [
          {
            key: '_hash',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'id',
            type: 'number',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'name',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
        ],
        type: 'cakes',
        // version: 1,
      };

      const tableCfg2: TableCfg = {
        key: 'table2',
        isHead: false,
        isRoot: false,
        isShared: true,
        columns: [
          {
            key: '_hash',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'price',
            type: 'number',
            titleLong: '',
            titleShort: '',
          },
          {
            key: 'description',
            type: 'string',
            titleLong: '',
            titleShort: '',
          },
        ],
        type: 'layers',
        // version: 1,
      };

      await ioSql.createOrExtendTable({ tableCfg: tableCfg1 });
      await ioSql.createOrExtendTable({ tableCfg: tableCfg2 });

      const rawCfgs = await ioSql.rawTableCfgs();

      // Should contain at least the two created tables and the default tableCfgs table
      const keys = rawCfgs.map((cfg) => cfg.key);
      expect(keys).toContain('table1');
      expect(keys).toContain('table2');
      expect(keys).toContain('tableCfgs');

      // Check that the configs match what we inserted (ignoring extra fields like _hash)
      const table1Cfg = rawCfgs.find((cfg) => cfg.key === 'table1');
      expect(table1Cfg).toMatchObject({
        key: 'table1',
        type: 'cakes',
        // version: 1,
      });

      const table2Cfg = rawCfgs.find((cfg) => cfg.key === 'table2');
      expect(table2Cfg).toMatchObject({
        key: 'table2',
        type: 'layers',
        // version: 1,
      });
    });

    it('should return only the default tableCfgs if no user tables exist', async () => {
      // New DB, only default tableCfgs should exist
      const rawCfgs = await ioSql.rawTableCfgs();
      const keys = rawCfgs.map((cfg) => cfg.key);
      expect(keys).toContain('tableCfgs');
      expect(keys.length).toBe(2);
    });
  });
});
