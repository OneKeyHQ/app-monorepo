// Polyfills for Hermes environment in react-native-harness.
// Provides Node.js globals, TextDecoder wrapping, structuredClone,
// fake-indexeddb, and ES2023 Array methods.

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-var-requires */

import { Buffer } from 'buffer';

(globalThis as any).Buffer = Buffer;
(globalThis as any).process = (globalThis as any).process || { env: {} };

// Load WHATWG-compliant URL polyfill. The normal app loads this via  // cspell:ignore WHATWG
// polyfillsPlatform.js, but the harness entry point skips app polyfills.
// Without this, RN's built-in regex-based URL class is used, which only
// parses HTTP/HTTPS URLs and breaks all custom scheme parsing (onekey-wallet://,
// solana:, wc:, bitcoin:, etc.).
require('react-native-url-polyfill/auto');

// Trigger cross-crypto initialization which properly sets up
// globalThis.crypto.getRandomValues via react-native-get-random-values.
// IMPORTANT: Do NOT import react-native-get-random-values directly here.
// cross-crypto deletes getRandomValues then re-requires the polyfill;
// if we pre-load it, the require becomes a cached no-op and getRandomValues
// stays deleted, causing "Cannot read property 'apply' of undefined".
require('crypto');

// Mark harness as Jest-like so platformEnv.isJest checks pass.
// This prevents "Passing raw password is not allowed" errors in tests
// and disables intl formatting fallbacks that change error messages.
const platformEnv = require('@onekeyhq/shared/src/platformEnv');

const platformEnvObj = platformEnv?.default ?? platformEnv;
if (platformEnvObj && typeof platformEnvObj === 'object') {
  platformEnvObj.isJest = true;
}

// Polyfill TextDecoder/TextEncoder for Hermes.
// Hermes may have a native TextDecoder that doesn't support the `fatal` option,
// which causes "Failed to construct 'TextDecoder': the 'fatal' option is unsupported"
// errors in @solana/web3.js and other libraries. Wrap it to accept `fatal`.
{
  const NativeTD = (globalThis as any).TextDecoder;
  let needsWrap = !NativeTD;
  if (NativeTD && !needsWrap) {
    try {
      const _probe = new NativeTD('utf-8', { fatal: true }); // eslint-disable-line no-new, @typescript-eslint/no-unused-vars
      void _probe;
    } catch {
      needsWrap = true;
    }
  }
  if (needsWrap && NativeTD) {
    // Wrap native TextDecoder using a class so `new TextDecoder()` works
    // correctly in Hermes (function-based constructors that return a different
    // object can cause "Cannot read property 'prototype' of undefined" in Hermes).
    // NOTE: Do NOT require('fast-text-encoding') here even as a fallback.
    // Including it in the bundle causes Metro to resolve all TextDecoder
    // references to fast-text-encoding's non-fatal-supporting polyfill,
    // breaking @solana/web3.js and other libraries that use { fatal: true }.
    const WrappedTD = class TextDecoder {
      _inner: any;

      constructor(
        label?: string,
        options?: { fatal?: boolean; ignoreBOM?: boolean },
      ) {
        const safeOptions = options
          ? { ignoreBOM: options.ignoreBOM }
          : undefined;
        this._inner = new NativeTD(label, safeOptions);
      }

      decode(
        input?: ArrayBufferView | ArrayBuffer,
        options?: { stream?: boolean },
      ): string {
        return this._inner.decode(input, options);
      }

      get encoding(): string {
        return this._inner.encoding;
      }

      get fatal(): boolean {
        return false;
      }

      get ignoreBOM(): boolean {
        return this._inner.ignoreBOM ?? false;
      }
    };
    (globalThis as any).TextDecoder = WrappedTD;
    // Also set on `global` — in Metro's module wrapper, bare `TextDecoder`
    // may resolve through `global` rather than `globalThis`. Without this,
    // Hermes throws "Property 'TextDecoder' doesn't exist" for code that
    // uses `new TextDecoder()` without an explicit `globalThis.` prefix.
    // eslint-disable-next-line unicorn/prefer-global-this -- Metro resolves bare TextDecoder via `global`, not `globalThis`
    if (typeof global !== 'undefined') {
      // eslint-disable-next-line unicorn/prefer-global-this
      (global as any).TextDecoder = WrappedTD;
    }
  }
}

// Polyfill structuredClone for Hermes (needed by fake-indexeddb and other libs).
// Mirrors the polyfill in jest-setup.js for the Node.js Jest environment.
if (typeof (globalThis as any).structuredClone === 'undefined') {
  try {
    (globalThis as any).structuredClone =
      require('@ungap/structured-clone').default;
  } catch {
    // @ungap/structured-clone not available in bundle  // cspell:ignore ungap
  }
}

// Polyfill IndexedDB for Hermes (needed by LocalDbIndexed tests).
// fake-indexeddb is a pure-JS in-memory implementation that works once
// structuredClone is available. Without this, LocalDbIndexed tests are skipped.
//
// Two issues were fixed via patch-package (fake-indexeddb+5.0.1.patch):
//
// 1. scheduling.js: added `global.setImmediate` fallback for React Native
//    where RN's timer polyfills attach setImmediate to `global` not `globalThis`.
//
// 2. FDBTransaction._start(): changed inter-request scheduling from macrotask
//    (queueTask/setImmediate) to microtask (Promise.resolve().then()) so that
//    promise continuations from `await store.get()` → `await store.add()`
//    chains run before _start() checks for an empty queue. In Hermes, macro-tasks
//    fire before microtasks, causing premature transaction auto-commit.
try {
  const FDBFactory = require('fake-indexeddb/build/cjs/FDBFactory.js');
  const FDBCursor = require('fake-indexeddb/build/cjs/FDBCursor.js');
  const FDBCursorWithValue = require('fake-indexeddb/build/cjs/FDBCursorWithValue.js');
  const FDBDatabase = require('fake-indexeddb/build/cjs/FDBDatabase.js');
  const FDBIndex = require('fake-indexeddb/build/cjs/FDBIndex.js');
  const FDBKeyRange = require('fake-indexeddb/build/cjs/FDBKeyRange.js');
  const FDBObjectStore = require('fake-indexeddb/build/cjs/FDBObjectStore.js');
  const FDBOpenDBRequest = require('fake-indexeddb/build/cjs/FDBOpenDBRequest.js');
  const FDBRequest = require('fake-indexeddb/build/cjs/FDBRequest.js');
  const FDBTransaction = require('fake-indexeddb/build/cjs/FDBTransaction.js');
  const FDBVersionChangeEvent = require('fake-indexeddb/build/cjs/FDBVersionChangeEvent.js');

  // Resolve the actual constructor — Metro's CJS interop may wrap exports
  // in { default: ... } for modules that use `module.exports = exports.default`.
  const resolveDefault = (mod: any) => (mod && mod.default ? mod.default : mod);
  const Factory = resolveDefault(FDBFactory);
  const fakeIndexedDB = new Factory();

  (globalThis as any).indexedDB = fakeIndexedDB;
  (globalThis as any).IDBCursor = resolveDefault(FDBCursor);
  (globalThis as any).IDBCursorWithValue = resolveDefault(FDBCursorWithValue);
  (globalThis as any).IDBDatabase = resolveDefault(FDBDatabase);
  (globalThis as any).IDBFactory = Factory;
  (globalThis as any).IDBIndex = resolveDefault(FDBIndex);
  (globalThis as any).IDBKeyRange = resolveDefault(FDBKeyRange);
  (globalThis as any).IDBObjectStore = resolveDefault(FDBObjectStore);
  (globalThis as any).IDBOpenDBRequest = resolveDefault(FDBOpenDBRequest);
  (globalThis as any).IDBRequest = resolveDefault(FDBRequest);
  (globalThis as any).IDBTransaction = resolveDefault(FDBTransaction);
  (globalThis as any).IDBVersionChangeEvent = resolveDefault(
    FDBVersionChangeEvent,
  );
} catch (e) {
  console.warn('[harness-compat] fake-indexeddb init failed:', e);
}

// Polyfill ES2023 Array methods not yet available in Hermes
if (!Array.prototype.toSorted) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.toSorted = function <T>(
    this: T[],
    compareFn?: (a: T, b: T) => number,
  ): T[] {
    // oxlint-disable-next-line unicorn/no-array-sort -- polyfill intentionally uses mutating sort on a copy
    return [...this].sort(compareFn);
  };
}
if (!Array.prototype.toReversed) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.toReversed = function <T>(this: T[]): T[] {
    // oxlint-disable-next-line unicorn/no-array-reverse -- polyfill intentionally uses mutating reverse on a copy
    return [...this].reverse();
  };
}
if (!Array.prototype.toSpliced) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.toSpliced = function <T>(
    this: T[],
    start: number,
    deleteCount?: number,
    ...items: T[]
  ): T[] {
    const copy = [...this];
    if (deleteCount === undefined) {
      copy.splice(start);
    } else {
      copy.splice(start, deleteCount, ...items);
    }
    return copy;
  };
}
