// @license
// Copyright (c) 2025 Rljson
//
// Use of this source code is governed by terms that can be
// found in the LICENSE file in the root of this package.

import { hip, hsh } from '@rljson/hash';
import { Io, IoDbNameMapping, IoTools } from '@rljson/io';
import { IsReady } from '@rljson/is-ready';
import { Json, JsonValue, JsonValueType } from '@rljson/json';
import {
  ColumnCfg,
  ContentType,
  iterateTables,
  Rljson,
  RljsonTable,
  TableCfg,
  TableKey,
  TableType,
} from '@rljson/rljson';

import initSqlJs, { Database } from 'sql.js';

import sqliteUrl from './assets/sql-wasm.wasm?url';
import { SqlStatements } from './sql-statements.ts';

const projectPath = new URL('..', import.meta.url).pathname;
/* v8 ignore next -- @preserve */
const pathWithoutDisk = (
  projectPath.endsWith('/')
    ? projectPath + sqliteUrl.replace(/^\//, '')
    : projectPath + '/' + sqliteUrl.replace(/^\//, '')
).substring(3);

const SQL = initSqlJs({
  locateFile: () => pathWithoutDisk,
});

export class IoSqlite implements Io {
  private _ioTools!: IoTools;
  private _isReady = new IsReady();
  private _sql: SqlStatements;
  private _map = new IoDbNameMapping();
  constructor() {
    this._sql = new SqlStatements();
  }

  async init(): Promise<void> {
    // const SQL = await initSql();
    this.db = new (await SQL).Database();
    this._isOpen = true;
    this._ioTools = new IoTools(this);
    this._initTableCfgs();
    await this._ioTools.initRevisionsTable();
    this._isReady.resolve();
  }

  public db!: Database;

  /**
   * Returns an example database
   */
  static example = async () => {
    const ioSqlite = new IoSqlite();
    await ioSqlite.init();
    return ioSqlite;
  };

  async contentType(request: { table: string }): Promise<ContentType> {
    const result = this.db
      .prepare(this._sql.contentType())
      .get([request.table]);
    return result[0] as ContentType;
  }

  async deleteDatabase() {
    // In-memory database, so just close it
    this.db.close();
    // Maybe once there will be file-based databases, delete the file here
  }

  // ...........................................................................
  // General
  isReady() {
    return this._isReady.promise;
  }

  // ...........................................................................
  // Dump (export all data from database)

  dump(): Promise<Rljson> {
    return this._dump();
  }

  dumpTable(request: { table: string }): Promise<Rljson> {
    return this._dumpTable(request);
  }

  // ...........................................................................
  // Rows
  readRows(request: {
    table: string;
    where: { [column: string]: JsonValue };
  }): Promise<Rljson> {
    return this._readRows(request);
  }

  async rowCount(table: string): Promise<number> {
    await this._ioTools.throwWhenTableDoesNotExist(table);

    const stmt = this.db.exec(this._sql.rowCount(table));
    /* v8 ignore next -- @preserve */
    const countRaw = stmt[0]?.values?.[0]?.[0] ?? 0;
    /* v8 ignore next -- @preserve */
    const count = Number(countRaw);
    return count;
  }

  // ...........................................................................
  async tableExists(tableKey: TableKey): Promise<boolean> {
    return this._tableExists(tableKey);
  }
  // ...........................................................................
  async rawTableCfgs(): Promise<TableCfg[]> {
    const tableCfg = IoTools.tableCfgsTableCfg;
    const result = this.db.exec(this._sql.tableCfgs);
    const rows = result[0]?.values;
    const columns = result[0]?.columns;
    const jsonRows = rows.map((row: any[]) => {
      const obj: any = {};
      columns.forEach((col: string, idx: number) => {
        obj[col] = row[idx];
      });
      return obj;
    });

    const returnValue = jsonRows;

    const parsedReturnValue = this._parseData(returnValue, tableCfg);
    return parsedReturnValue as TableCfg[];
  }

  async alltableKeys(): Promise<string[]> {
    const returnValue = this.db.exec(this._sql.tableKeys)[0].values;
    const returnValueStr = returnValue.map((row: any) => String(row[0]));
    // remove the suffixes
    const tableKeys = returnValueStr.map((key) =>
      this._map.removeTableSuffix(key),
    );
    return tableKeys;
  }

  // ...........................................................................
  // Write data into the respective table
  async write(request: { data: Rljson }): Promise<void> {
    await this._write(request);
  }

  async createOrExtendTable(request: { tableCfg: TableCfg }): Promise<void> {
    return this._createOrExtendTable(request);
  }

  // ######################
  // Private
  // ######################

  // ...........................................................................
  private _initTableCfgs = () => {
    const tableCfg = IoTools.tableCfgsTableCfg;

    //create main table if it does not exist yet
    this.db.prepare(this._sql.createTable(tableCfg)).run();

    // Write tableCfg as first row into tableCfgs table;
    // as this is the first row to be entered, it is entered manually
    const values = this._serializeRow(tableCfg, tableCfg);

    const p = this.db.prepare(this._sql.insertTableCfg());
    p.run(values as any[]);
  };

  // ...........................................................................
  private async _createOrExtendTable(request: {
    tableCfg: TableCfg;
  }): Promise<void> {
    // Make sure that the table config is compatible
    await this._ioTools.throwWhenTableIsNotCompatible(request.tableCfg);

    // Create table in sqlite database
    const tableKey = request.tableCfg.key;

    // Create config hash
    const tableCfgHashed = hsh(request.tableCfg);

    // Check if table exists
    const stmt = this.db.prepare(this._sql.tableCfg);
    const exists = stmt.get([tableKey]);

    if (exists.length === 0) {
      this._createTable(tableCfgHashed, request);
    } else {
      await this._extendTable(tableCfgHashed);
    }
    stmt.free();
  }

  // ...........................................................................
  private _createTable(
    tableCfgHashed: TableCfg,
    request: { tableCfg: TableCfg },
  ) {
    this._insertTableCfg(tableCfgHashed);
    this.db.exec(this._sql.createTable(request.tableCfg));
  }

  // ...........................................................................
  private _insertTableCfg(tableCfgHashed: TableCfg) {
    hip(tableCfgHashed);
    const values = this._serializeRow(
      tableCfgHashed,
      IoTools.tableCfgsTableCfg,
    );
    const p = this.db.prepare(this._sql.insertTableCfg());
    p.run(values as any[]);
  }

  // ...........................................................................
  _addMissingHashes(rljson: Json): void {
    hip(rljson, { updateExistingHashes: false, throwOnWrongHashes: false });
  }

  // ...........................................................................
  private async _extendTable(newTableCfg: TableCfg): Promise<void> {
    // Estimate added columns
    const tableKey = newTableCfg.key;

    const oldTableCfg = await this._ioTools.tableCfg(tableKey);

    const addedColumns: ColumnCfg[] = [];
    for (
      let i = oldTableCfg.columns.length;
      i < newTableCfg.columns.length;
      i++
    ) {
      const newColumn = newTableCfg.columns[i];
      addedColumns.push(newColumn);
    }

    // No columns added? Do nothing.
    if (addedColumns.length === 0) {
      return;
    }

    // Write new tableCfg into tableCfgs table
    this._insertTableCfg(newTableCfg);

    // Add new columns to the table
    const alter = this._sql.alterTable(tableKey, addedColumns);
    for (const statement of alter) {
      this.db.prepare(statement).run();
    }
  }

  // ...........................................................................
  private async _readRows(request: {
    table: string;
    where: { [column: string]: JsonValue };
  }): Promise<Rljson> {
    await this._ioTools.throwWhenTableDoesNotExist(request.table);
    await this._ioTools.throwWhenColumnDoesNotExist(request.table, [
      ...Object.keys(request.where),
    ]);

    const tableKeyWithSuffix = this._map.addTableSuffix(request.table);
    const tableCfg = await this._ioTools.tableCfg(request.table);

    const whereString = this._whereString(Object.entries(request.where));
    const query = `SELECT * FROM ${tableKeyWithSuffix} WHERE${whereString}`;
    const returnValue = this.db.exec(query);
    // Extract the 'values' part from returnValue and convert them into JSON objects
    const rows = returnValue[0]?.values || [];
    const columns = returnValue[0]?.columns || [];
    const jsonRows = rows.map((row: any[]) => {
      const obj: any = {};
      columns.forEach((col: string, idx: number) => {
        obj[col] = row[idx];
      });
      return obj;
    });
    const convertedResult = this._parseData(jsonRows, tableCfg);

    const table: RljsonTable<any, any> = {
      _data: convertedResult,
      _type: tableCfg.type,
    };

    this._ioTools.sortTableDataAndUpdateHash(table);

    const result: Rljson = {
      [request.table]: table,
    } as any;

    return result;
  }

  // ...........................................................................
  private _serializeRow(
    rowAsJson: Json,
    tableCfg: TableCfg,
  ): (JsonValue | null)[] {
    const result: (JsonValue | null)[] = [];

    // Iterate all columns in the tableCfg
    for (const col of tableCfg.columns) {
      const key = col.key;
      let value = rowAsJson[key] ?? null;
      const valueType = typeof value;

      // Stringify objects and arrays
      if (value !== null && valueType === 'object') {
        value = JSON.stringify(value);
      }

      // Convert booleans to 1 or 0
      else if (valueType === 'boolean') {
        value = value ? 1 : 0;
      }

      result.push(value);
    }

    return result;
  }

  private _parseData(data: Json[], tableCfg: TableCfg): Json[] {
    const columnTypes = tableCfg.columns.map((col) => col.type);
    const columnKeys = tableCfg.columns.map((col) => col.key);

    const convertedResult: Json[] = [];

    for (const row of data) {
      const convertedRow: { [key: string]: any } = {};
      for (let colNum = 0; colNum < columnKeys.length; colNum++) {
        const key = columnKeys[colNum];
        const keyWithSuffix = this._map.addColumnSuffix(key);
        const type = columnTypes[colNum] as JsonValueType;
        const val = row[keyWithSuffix];

        // Null or undefined values are ignored
        // and not added to the converted row
        if (val === undefined) {
          continue;
        }

        if (val === null) {
          continue;
        }

        switch (type) {
          case 'boolean':
            convertedRow[key] = val !== 0;
            break;
          case 'jsonArray':
          case 'json':
            convertedRow[key] = JSON.parse(val as string);
            break;
          case 'string':
          case 'number':
            convertedRow[key] = val;
            break;
          /* v8 ignore next -- @preserve */
          default:
            throw new Error('Unsupported column type ' + type);
        }
      }

      convertedResult.push(convertedRow);
    }

    return convertedResult;
  }

  public parseDataTest(data: Json[], tableCfg: TableCfg): Json[] {
    return this._parseData(data, tableCfg);
  }

  // ...........................................................................

  private async _dump(): Promise<Rljson> {
    const returnFile: Rljson = {};
    const result = this.db.exec(this._sql.tableKeys);
    const tableNames = result[0]?.values?.map((row: any[]) => row[0]);

    for (const table of tableNames) {
      const tableDump: Rljson = await this._dumpTable({
        table: this._map.removeTableSuffix(table),
      });

      returnFile[this._map.removeTableSuffix(table)] =
        tableDump[this._map.removeTableSuffix(table)];
    }

    this._addMissingHashes(returnFile);

    return returnFile;
  }

  // ...........................................................................
  private async _dumpTable(request: { table: string }): Promise<Rljson> {
    await this._ioTools.throwWhenTableDoesNotExist(request.table);
    const tableKey = this._map.addTableSuffix(request.table);

    // get table's column structure
    const tableCfg = await this._ioTools.tableCfg(request.table);
    const columnKeys = tableCfg.columns.map((col) => col.key);
    const columnKeysWithSuffix = columnKeys.map((col) =>
      this._map.addColumnSuffix(col),
    );

    const result = this.db.exec(
      this._sql.allData(tableKey, columnKeysWithSuffix.join(', ')),
    );
    // Convert returnData (from db.exec) into array of JSON objects
    const rows = result[0]?.values || [];
    const columns = result[0]?.columns || [];
    const jsonRows = rows.map((row: any[]) => {
      const obj: any = {};
      columns.forEach((col: string, idx: number) => {
        obj[col] = row[idx];
      });
      return obj;
    });
    const parsedReturnData = this._parseData(jsonRows, tableCfg);

    const tableCfgHash = tableCfg._hash as string;

    const table: TableType = {
      _type: tableCfg.type,
      _data: parsedReturnData as any,
      _tableCfg: tableCfgHash,
      _hash: '',
    };

    this._ioTools.sortTableDataAndUpdateHash(table);

    const returnFile: Rljson = {};
    returnFile[request.table] = table;

    return returnFile;
  }

  // ...........................................................................
  private async _write(request: { data: Rljson }): Promise<void> {
    // Preparation
    const hashedData = hsh(request.data);
    const errorStore = new Map<number, string>();
    let errorCount = 0;

    await this._ioTools.throwWhenTablesDoNotExist(request.data);
    await this._ioTools.throwWhenTableDataDoesNotMatchCfg(request.data);

    // Loop through the tables in the data
    await iterateTables(hashedData, async (tableName, tableData) => {
      const tableCfg = await this._ioTools.tableCfg(tableName);

      // Create internal table name
      const tableKeyWithSuffix = this._map.addTableSuffix(tableName);

      for (const row of tableData._data) {
        // Prepare and run the SQL query
        // (each row might have a different number of columns)
        const columnKeys = tableCfg.columns.map((col) => col.key);
        const columnKeysWithPostfix = columnKeys.map((column) =>
          this._map.addColumnSuffix(column),
        );
        const placeholders = columnKeys.map(() => '?').join(', ');
        const query = `INSERT OR IGNORE INTO ${tableKeyWithSuffix} (${columnKeysWithPostfix.join(
          ', ',
        )}) VALUES (${placeholders})`;

        // Put values into the necessary format
        const serializedRow = this._serializeRow(row, tableCfg);

        // Run the query
        try {
          this.db.prepare(query).run(serializedRow as any[]);
        } catch (error) {
          /* v8 ignore next -- @preserve */
          if ((error as any).code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
            return;
          }
          /* v8 ignore next -- @preserve */
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          /* v8 ignore next -- @preserve */
          errorCount++;

          /* v8 ignore next -- @preserve */
          errorStore.set(
            errorCount,
            `Error inserting into table ${tableName}: ${errorMessage}`,
          );
        }
      }
    });
    /* v8 ignore next -- @preserve */
    if (errorCount > 0) {
      const errorMessages = Array.from(errorStore.values()).join(', ');
      throw new Error(`Errors occurred: ${errorMessages}`);
    }
  }

  async _tableExists(tableKey: string): Promise<boolean> {
    /* v8 ignore next -- @preserve */
    const tableKeyWithSuffix = this._map.addTableSuffix(tableKey);
    const result = this.db
      .prepare(this._sql.tableExists())
      .get([tableKeyWithSuffix]);
    return result[0] === tableKeyWithSuffix ? true : false;
  }
  _whereString(whereClause: [string, JsonValue][]): string {
    let whereString: string = ' ';
    for (const [column, value] of whereClause) {
      const columnWithFix = this._map.addColumnSuffix(column);

      /* v8 ignore next -- @preserve */
      if (typeof value === 'string') {
        whereString += `${columnWithFix} = '${value}' AND `;
      } else if (typeof value === 'number') {
        whereString += `${columnWithFix} = ${value} AND `;
      } else if (typeof value === 'boolean') {
        whereString += `${columnWithFix} = ${value ? 1 : 0} AND `;
      } else if (value === null) {
        whereString += `${columnWithFix} IS NULL AND `;
      } else if (typeof value === 'object') {
        whereString += `${columnWithFix} = '${JSON.stringify(value)}' AND `;
      } else {
        /* v8 ignore next -- @preserve */
        throw new Error(`Unsupported value type for column ${column}`);
      }
    }

    /* v8 ignore next -- @preserve */
    whereString = whereString.endsWith('AND ')
      ? whereString.slice(0, -5)
      : whereString; // remove last ' AND '

    return whereString;
  }

  private _isOpen = false;

  public get isOpen(): boolean {
    return this._isOpen;
  }

  async close() {
    this._isOpen = false;
    this.db.close();
  }
}
