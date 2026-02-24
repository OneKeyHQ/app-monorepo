// Harness infrastructure validation: verifies the react-native-harness
// pipeline works end-to-end (bundle → deploy → execute → report).
// These tests exercise basic JS primitives on real Hermes to confirm
// the harness itself is functioning, NOT to test Hermes capabilities.

import { describe, expect, test } from 'react-native-harness';

describe('Harness Infrastructure Validation', () => {
  test('basic arithmetic works in Hermes', () => {
    expect(1 + 1).toBe(2);
    expect(10 * 5).toBe(50);
  });

  test('string operations work in Hermes', () => {
    expect('hello'.toUpperCase()).toBe('HELLO');
    expect('WORLD'.toLowerCase()).toBe('world');
    expect('foo bar'.split(' ')).toEqual(['foo', 'bar']);
  });

  test('Array methods work in Hermes', () => {
    expect([1, 2, 3].map((x) => x * 2)).toEqual([2, 4, 6]);
    expect([1, 2, 3, 4].filter((x) => x % 2 === 0)).toEqual([2, 4]);
    expect([1, 2, 3].reduce((a, b) => a + b, 0)).toBe(6);
  });

  test('Promise works in Hermes', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  test('async/await works in Hermes', async () => {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    const start = Date.now();
    await delay(10);
    expect(Date.now() - start).toBeGreaterThanOrEqual(5);
  });

  test('BigInt is supported in Hermes', () => {
    const big = BigInt(9_007_199_254_740_991);
    expect(big.toString()).toBe('9007199254740991');
    expect((big + BigInt(1)).toString()).toBe('9007199254740992');
  });

  test('RegExp works correctly in Hermes', () => {
    const pattern = /^0x[0-9a-fA-F]+$/;
    expect(pattern.test('0x1a2b3c')).toBe(true);
    expect(pattern.test('not-hex')).toBe(false);
  });

  test('JSON parse/stringify works in Hermes', () => {
    const obj = { key: 'value', num: 42, arr: [1, 2, 3] };
    const json = JSON.stringify(obj);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(obj);
  });

  test('Map and Set work in Hermes', () => {
    const map = new Map<string, number>();
    map.set('a', 1);
    map.set('b', 2);
    expect(map.get('a')).toBe(1);
    expect(map.size).toBe(2);

    const set = new Set([1, 2, 3, 3]);
    expect(set.size).toBe(3);
    expect(set.has(2)).toBe(true);
  });

  test('ArrayBuffer and TypedArray work in Hermes', () => {
    const buffer = new ArrayBuffer(4);
    const view = new Uint8Array(buffer);
    view[0] = 0xde;
    view[1] = 0xad;
    view[2] = 0xbe;
    view[3] = 0xef;
    expect(view[0]).toBe(0xde);
    expect(view.length).toBe(4);
  });
});
