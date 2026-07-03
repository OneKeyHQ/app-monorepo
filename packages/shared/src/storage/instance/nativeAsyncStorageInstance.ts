import nativeAsyncStorageInstance from '@react-native-async-storage/async-storage';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

// ---- Diagnostic write tracing (wallet backup-status investigation) ----
// Native production runs two JS runtimes (main + bg) in one process. Each
// holds its own AsyncStorage native instance whose in-memory manifest
// snapshot rewrites manifest.json as a whole on every write (iOS), so a
// writer holding a stale snapshot can erase keys the other runtime persisted
// after that snapshot was loaded. Every JS-side write is traced here with
// runtime kind + keys so app-latest.log shows exactly which write preceded a
// key loss. OneKey code AND third-party libs resolve to this same module
// instance, so nothing bypasses the trace at the JS layer. Values are
// intentionally never logged.
//
// `__ONEKEY_RUNTIME_KIND__` is only defined by the native entries
// (apps/mobile/index.ts sets 'main', apps/mobile/background.ts sets
// 'background'), so tracing is a no-op in any non-native context that
// resolves this file (tests, tooling).

const getRuntimeKind = (): string | undefined =>
  (globalThis as { __ONEKEY_RUNTIME_KIND__?: string }).__ONEKEY_RUNTIME_KIND__;

let writeSeq = 0;

function traceWrite(op: string, keys: readonly string[]): void {
  const runtimeKind = getRuntimeKind();
  if (!runtimeKind) {
    return;
  }
  try {
    // Lazy require: NativeLogger writes straight to app-latest.log and never
    // touches AsyncStorage, so no recursion is possible.
    const { NativeLogger, LogLevel } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../modules3rdParty/react-native-file-logger') as typeof import('../../modules3rdParty/react-native-file-logger');
    writeSeq += 1;
    NativeLogger.write(
      LogLevel.Info,
      `[AsyncStorageWriteTrace] runtime=${runtimeKind} seq=${writeSeq} op=${op} keys=${JSON.stringify(
        keys,
      )}`,
    );
  } catch {
    // Tracing must never break storage calls (logger may not be ready yet).
  }
}

function attachWriteTracing(storage: AsyncStorageStatic): void {
  if (!getRuntimeKind()) {
    return;
  }

  const originalSetItem = storage.setItem.bind(storage);
  storage.setItem = (key, value, callback) => {
    traceWrite('setItem', [key]);
    return originalSetItem(key, value, callback);
  };

  const originalRemoveItem = storage.removeItem.bind(storage);
  storage.removeItem = (key, callback) => {
    traceWrite('removeItem', [key]);
    return originalRemoveItem(key, callback);
  };

  const originalMultiSet = storage.multiSet.bind(storage);
  storage.multiSet = (keyValuePairs, callback) => {
    traceWrite(
      'multiSet',
      keyValuePairs.map((pair) => pair[0]),
    );
    return originalMultiSet(keyValuePairs, callback);
  };

  const originalMultiRemove = storage.multiRemove.bind(storage);
  storage.multiRemove = (keys, callback) => {
    traceWrite('multiRemove', keys);
    return originalMultiRemove(keys, callback);
  };

  const originalClear = storage.clear.bind(storage);
  storage.clear = (callback) => {
    traceWrite('clear', []);
    return originalClear(callback);
  };

  // Merge variants are attached last: if a storage fork ships without them,
  // the throw below only skips these two while all wrappers above stay live.
  const originalMergeItem = storage.mergeItem.bind(storage);
  storage.mergeItem = (key, value, callback) => {
    traceWrite('mergeItem', [key]);
    return originalMergeItem(key, value, callback);
  };

  const originalMultiMerge = storage.multiMerge.bind(storage);
  storage.multiMerge = (keyValuePairs, callback) => {
    traceWrite(
      'multiMerge',
      keyValuePairs.map((pair) => pair[0]),
    );
    return originalMultiMerge(keyValuePairs, callback);
  };
}

try {
  attachWriteTracing(nativeAsyncStorageInstance);
} catch {
  // Best-effort diagnostics: a missing optional method must not break the
  // storage module itself.
}

export default nativeAsyncStorageInstance;
