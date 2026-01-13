// @license
// Copyright (c) 2025 CARAT Gesellschaft für Organisation
// und Softwareentwicklung mbH. All Rights Reserved.
//
// Use of this source code is governed by terms that can be
// found in the LICENSE file in the root of this package.

//****************************************************** */
// These sql statements are partly based on the SQLite database;
// see https://www.sqlite.org/lang.html
// and https://www.sqlite.org/cli.html
//****************************************************** */

import { IoDbNameMapping, IoTools } from '@rljson/io';
import { JsonValueType } from '@rljson/json';
import { ColumnCfg, TableCfg, TableKey } from '@rljson/rljson';

export class SqlStatements {
  private _map = new IoDbNameMapping();

  /**
   * Converts a JSON value type to an SQLite data type.
   * @param dataType - The JSON value type to convert.
   * @returns - The corresponding SQLite data type.
   */
  jsonToSqlType(dataType: JsonValueType): string {
    switch (dataType) {
      case 'string':
        return 'TEXT';
      case 'jsonArray':
        return 'TEXT';
      case 'json':
        return 'TEXT';
      case 'number':
        return 'REAL';
      case 'boolean':
        return 'INTEGER';
      case 'jsonValue':
        return 'TEXT';
    }
  }

  get tableKey() {
    return `SELECT name FROM sqlite_master WHERE type='table' AND name=?`;
  }
  get tableKeys() {
    return `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`;
  }

  rowCount(tableKey: string) {
    return `SELECT COUNT(*) AS RECORDCOUNT FROM ${this._map.addTableSuffix(
      tableKey,
    )}`;
  }

  allData(tableKey: string, namedColumns?: string) {
    if (!namedColumns) {
      namedColumns = `*`;
    }
    return `SELECT ${namedColumns} FROM ${tableKey}`;
  }

  get tableCfg() {
    return `SELECT * FROM ${this._map.addTableSuffix(
      this._map.tableNames.main,
    )} WHERE ${this._map.addColumnSuffix('key')} = ?`;
  }

  get tableCfgs() {
    return `SELECT * FROM ${this._map.addTableSuffix(
      this._map.tableNames.main,
    )}`;
  }

  /* v8 ignore next -- @preserve */
  get currentTableCfg(): string {
    const sql: string[] = [
      'WITH versions AS (',
      ' SELECT _hash_col, key_col, MAX(json_each.key) AS max_val',
      ' FROM tableCfgs_tbl, json_each(columns_col)',
      ' WHERE json_each.value IS NOT NULL',
      ' AND key_col = ? GROUP BY _hash_col, key_col)',
      'SELECT * FROM tableCfgs_tbl tt',
      ' LEFT JOIN versions ON tt._hash_col = versions._hash_col',
      ' WHERE versions.max_val = (SELECT MAX(max_val) FROM versions);',
    ];
    return sql.join('\n');
  }

  get currentTableCfgs(): string {
    const sql: string[] = [
      'SELECT',
      '  *',
      'FROM',
      '  tableCfgs_tbl',
      'WHERE',
      '  _hash_col IN (',
      '    WITH',
      '      column_count AS (',
      '        SELECT',
      '          _hash_col,',
      '          key_col,',
      '          MAX(json_each.key) AS max_val',
      '        FROM',
      '          tableCfgs_tbl,',
      '          json_each (columns_col)',
      '        WHERE',
      '          json_each.value IS NOT NULL',
      '        GROUP BY',
      '          _hash_col,',
      '          key_col',
      '      ),',
      '      max_tables AS (',
      '        SELECT',
      '          key_col,',
      '          MAX(max_val) AS newest',
      '        FROM',
      '          column_count',
      '        GROUP BY',
      '          key_col',
      '      )',
      '    SELECT',
      '      cc._hash_col',
      '    FROM',
      '      column_count cc',
      '      LEFT JOIN max_tables mt ON cc.key_col = mt.key_col',
      '      AND cc.max_val = mt.newest',
      '    WHERE',
      '      mt.newest IS NOT NULL',
      '  );',
    ];
    return sql.join('\n');
  }

  get articleExists() {
    return (
      'SELECT cl.layer, ar.assign FROM catalogLayers cl\n' +
      'LEFT JOIN articleSets ar\n' +
      'ON cl.articleSetsRef = ar._hash\n' +
      'WHERE cl.winNumber = ? '
    );
  }
  get catalogExists() {
    return 'SELECT 1 FROM catalogLayers WHERE winNumber = ?';
  }

  contentType(): string {
    const sourceTable = this._map.addTableSuffix(this._map.tableNames.main);
    const resultCol = this._map.addColumnSuffix('type');
    const sql = `SELECT ${resultCol} as contentType FROM [${sourceTable}] WHERE key_col =?`;
    return sql;
  }

  insertTableCfg() {
    const columnKeys = IoTools.tableCfgsTableCfg.columns.map((col) => col.key);
    const columnKeysWithPostfix = columnKeys.map((col) =>
      this._map.addColumnSuffix(col),
    );
    const columnsSql = columnKeysWithPostfix.join(', ');
    const valuesSql = '?, '.repeat(columnKeys.length - 1) + '?';

    return `INSERT OR IGNORE INTO ${this._map.addTableSuffix(
      this._map.tableNames.main,
    )} ( ${columnsSql} ) VALUES (${valuesSql})`;
  }

  tableExists() {
    return `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`;
  }

  get tableType() {
    return `SELECT ${this._map.addColumnSuffix(
      'type',
    )} AS type FROM ${this._map.addTableSuffix(this._map.tableNames.main)}
      WHERE ${this._map.addColumnSuffix('key')} = ?
      AND ${this._map.addColumnSuffix('version')}
      = (SELECT MAX(${this._map.addColumnSuffix('version')})
        FROM ${this._map.addTableSuffix(this._map.tableNames.main)}
        WHERE ${this._map.addColumnSuffix('key')} = ?)`;
  }

  columnKeys(tableKey: string) {
    return `PRAGMA table_info(${tableKey})`;
  }

  createFullTable(
    tableKey: string,
    columnsDefinition: string,
    foreignKeys: string,
  ) {
    return `CREATE TABLE ${tableKey} (${columnsDefinition}, ${foreignKeys})`;
  }

  dropTable(tableKey: string) {
    return `DROP TABLE IF EXISTS ${this._map.addTableSuffix(tableKey)}`;
  }

  createTempTable(tableKey: string) {
    return `CREATE TABLE ${this._map.addTmpSuffix(
      tableKey,
    )} AS SELECT * FROM ${this._map.addTableSuffix(tableKey)}`;
  }

  dropTempTable(tableKey: string) {
    return `DROP TABLE IF EXISTS ${this._map.addTmpSuffix(tableKey)}`;
  }

  fillTable(tableKey: string, commonColumns: string) {
    // select only those columns that are in both tables
    return `INSERT OR IGNORE INTO ${this._map.addTableSuffix(
      tableKey,
    )} (${commonColumns}) SELECT ${commonColumns} FROM ${this._map.addTmpSuffix(
      tableKey,
    )}`;
  }

  deleteFromTable(tableKey: string, winNumber: string) {
    return `DELETE FROM ${tableKey} WHERE winNumber = '${winNumber}'`;
  }

  addColumn(tableKey: string, columnName: string, columnType: string) {
    return `ALTER TABLE ${tableKey} ADD COLUMN ${columnName} ${columnType}`;
  }

  selection(tableKey: string, columns: string, whereClause: string) {
    return `SELECT ${columns} FROM ${tableKey} WHERE ${whereClause}`;
  }

  articleSetsRefs(winNumber: string) {
    return `SELECT layer, articleSetsRef FROM catalogLayers WHERE winNumber = '${winNumber}'`;
  }

  currentCount(tableKey: string) {
    return `SELECT COUNT(*) FROM ${this._map.addTableSuffix(tableKey)}`;
  }

  createTable(tableCfg: TableCfg): string {
    const sqltableKey = this._map.addTableSuffix(tableCfg.key);
    const columnsCfg = tableCfg.columns;

    const sqlCreateColumns = columnsCfg
      .map((col) => {
        const sqliteType = this.jsonToSqlType(col.type);
        return `${this._map.addColumnSuffix(col.key)} ${sqliteType}`;
      })
      .join(', ');

    const conKey = `${this._map.addColumnSuffix(
      this._map.primaryKeyColumn,
    )} TEXT`;
    const primaryKey = `${conKey} PRIMARY KEY NOT NULL`;
    const colsWithPrimaryKey = sqlCreateColumns.replace(conKey, primaryKey);
    return `CREATE TABLE IF NOT EXISTS ${sqltableKey} (${colsWithPrimaryKey})`;
  }

  alterTable(tableKey: TableKey, addedColumns: ColumnCfg[]): string[] {
    const tableKeyWithSuffix = this._map.addTableSuffix(tableKey);
    const statements: string[] = [];
    for (const col of addedColumns) {
      const columnKey = this._map.addColumnSuffix(col.key);
      const columnType = this.jsonToSqlType(col.type);
      statements.push(
        `ALTER TABLE ${tableKeyWithSuffix} ADD COLUMN ${columnKey} ${columnType};`,
      );
    }

    return statements;
  }

  get createTableCfgsTable() {
    return this.createTable(IoTools.tableCfgsTableCfg);
  }

  get tableTypeCheck() {
    return `SELECT ${this._map.addColumnSuffix(
      'type',
    )} FROM ${this._map.addTableSuffix(
      this._map.tableNames.main,
    )} WHERE ${this._map.addColumnSuffix('key')} = ?`;
  }
}
