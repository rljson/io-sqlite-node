// @license
// Copyright (c) 2026 Rljson
//
// Use of this source code is governed by terms that can be
// found in the LICENSE file in the root of this package.

export function randomDbName() {
  return (() => {
    const randomCode = Math.floor(Math.random() * 10000000000)
      .toString()
      .padStart(10, '0');
    return `test_${randomCode}.db`;
  })();
}
