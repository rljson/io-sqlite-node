// @license
// Copyright (c) 2025 Rljson
//
// Use of this source code is governed by terms that can be
// found in the LICENSE file in the root of this package.

import { Io, IoTestSetup } from '@rljson/io';

import { IoSqliteNode } from '../src/io-sqlite-node';

// ..............................................................................
class MyIoTestSetup implements IoTestSetup {
  async beforeAll(): Promise<void> {
    console.log('Sqlite does not need any setup before all tests');
  }

  async beforeEach(): Promise<void> {
    const sqlite = await IoSqliteNode.example();
    this._io = sqlite;
  }

  async afterEach(): Promise<void> {
    await (this.io as IoSqliteNode).deleteDatabase();
  }

  async afterAll(): Promise<void> {
    console.log('Sqlite does not need any cleanup after all tests');
  }

  get io(): Io {
    if (!this._io) {
      throw new Error('Call init() before accessing io');
    }
    return this._io;
  }

  private _io: Io | null = null;
}

// .............................................................................
export const testSetup = () => new MyIoTestSetup();
