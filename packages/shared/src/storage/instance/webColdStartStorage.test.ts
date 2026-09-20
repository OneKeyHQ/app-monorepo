/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// Unit tests for webColdStartStorage. Uses fake-indexeddb to polyfill
// globalThis.indexedDB so the IndexedDBPromised facade's jest branch
// (platformEnv.isJest -> globalThis.indexedDB) finds a real factory.

import { registerColdStartFlushTrigger } from '../coldStartFlushTrigger';
import { EAppSyncStorageKeys } from '../syncStorageKeys';

import type { IndexedDBPromised } from '../../IndexedDBPromised';

// Mock coldStartFlushTrigger so the lifecycle-attachment test can assert
// against a spy without depending on platformEnv (which resolves to
// neither web nor desktop in jest, suppressing the real DOM listener
// attach path). The mock is harmless for the other tests, which never
// inspect the trigger. jest.mock is hoisted above imports by babel-jest.
jest.mock('../coldStartFlushTrigger', () => ({
  __esModule: true,
  registerColdStartFlushTrigger: jest.fn(() => () => undefined),
}));

// add indexedDB for node
try {
  // eslint-disable-next-line global-require
  require('fake-indexeddb/auto');
} catch {
  // fake-indexeddb may not work in all environments
}

// Skip the IDB-integration tests if the polyfill failed to load.
const hasIndexedDB =
  typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function';
const describeIfIndexedDB = hasIndexedDB ? describe : describe.skip;

// Ensure the wrapper falls back to globalThis.indexedDB rather than
// trying navigator.storageBuckets (which fake-indexeddb does not provide).
if (
  typeof (globalThis as { navigator?: { storageBuckets?: unknown } })
    .navigator !== 'undefined'
) {
  // @ts-expect-error force-clear the optional bucket API
  globalThis.navigator.storageBuckets = undefined;
}

// We deliberately re-require the module under test inside each test (via
// jest.isolateModules) so the module-level dbPromise / dirtyKeys /
// flushTimer state is fully reset between cases. The in-memory map lives
// on globalThis so we wipe it explicitly too.
type IColdStartModule = typeof import('./webColdStartStorage');
let activeModule: IColdStartModule | undefined;

function loadModule(): IColdStartModule {
  let mod!: IColdStartModule;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    mod = require('./webColdStartStorage');
  });
  activeModule = mod;
  return mod;
}

/**
 * Same as loadModule, but also hands back the IndexedDBPromised class that
 * THIS registry loaded. jest.isolateModules re-evaluates the module graph,
 * so the class imported at the top of this file is a different identity —
 * patching it would leave the module under test untouched and quietly turn
 * an injection-driven test into one that asserts nothing.
 */
function loadModuleWithIdb(): {
  mod: IColdStartModule;
  isolatedIDB: typeof IndexedDBPromised;
} {
  let mod!: IColdStartModule;
  let isolatedIDB!: typeof IndexedDBPromised;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    ({ IndexedDBPromised: isolatedIDB } =
      require('../../IndexedDBPromised') as {
        IndexedDBPromised: typeof IndexedDBPromised;
      });
    // eslint-disable-next-line global-require
    mod = require('./webColdStartStorage');
  });
  activeModule = mod;
  return { mod, isolatedIDB };
}

/**
 * Instrument the write path a flush actually takes.
 *
 * runFlushOnce batches its records into one transaction per kind rather than
 * calling db.put / db.delete per key, so hooking those no longer observes a
 * flush at all — it silently makes a test pass without exercising anything.
 * Everything a test needs to drive lives on transactionAsync:
 *
 * - `failNext` and `delayMs` act before the transaction opens, which is after
 *   runFlushOnce has snapshotted and cleared dirtyKeys. A failure there
 *   reaches the same catch as a rejected request.
 * - `onPut` wraps the store, and stays synchronous: awaiting between requests
 *   would let the transaction auto-commit before the rest were queued.
 */
function patchIdbWrites(
  idb: typeof IndexedDBPromised,
  hook: {
    onPut?: (key: string) => void;
    onTransaction?: (mode: string) => void;
    failNext?: () => boolean;
    delayMs?: number;
  },
): () => void {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const realTransactionAsync = idb.prototype.transactionAsync;
  const proto = idb.prototype as unknown as {
    transactionAsync: typeof realTransactionAsync;
  };
  proto.transactionAsync = async function patchedTransactionAsync(
    this: IndexedDBPromised<unknown>,
    ...args: Parameters<typeof realTransactionAsync>
  ) {
    hook.onTransaction?.(String(args[1]));
    if (hook.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, hook.delayMs));
    }
    if (hook.failNext?.()) {
      // Test-only synthetic rejection; the catch site inspects it as unknown.
      // eslint-disable-next-line no-restricted-syntax, onekey/no-raw-error
      throw new Error('forced flush failure');
    }
    const tx = await (
      realTransactionAsync as (...a: typeof args) => Promise<any>
    ).apply(this, args);
    const { onPut } = hook;
    if (!onPut) {
      return tx;
    }
    const realObjectStore = tx.objectStore.bind(tx) as (name: string) => any;
    tx.objectStore = (name: string) => {
      const store = realObjectStore(name);
      const realPut = store.put.bind(store) as (
        value: unknown,
        key: unknown,
      ) => Promise<unknown>;
      store.put = (value: unknown, key: unknown) => {
        onPut(String(key));
        return realPut(value, key);
      };
      return store;
    };
    return tx;
  } as typeof realTransactionAsync;
  return () => {
    proto.transactionAsync = realTransactionAsync;
  };
}

beforeEach(async () => {
  // Reset the shared globalThis map so isolateModules sees a fresh state.
  (globalThis as Record<string, unknown>).__ONEKEY_COLD_START_CACHE_MAP__ =
    undefined;
  // Best-effort wipe of any leftover entries in the underlying fake IDB.
  if (hasIndexedDB) {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('onekey-cold-start-cache');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
});

afterEach(() => {
  // Drain any in-flight debounce timer left by the test so jest does not
  // print "Jest did not exit one second after the test run has completed".
  if (activeModule) {
    activeModule.__resetForTests();
  }
  activeModule = undefined;
});

describe('primeColdStartCacheMap', () => {
  it('does not clobber an entry already written by an early facade .set', () => {
    const mod = loadModule();
    // Early facade write before hydrate.ts finishes its IDB read.
    mod.writeColdStartMeta('__meta:buildHash', 'live');
    // Simulate hydrate.ts reading a stale prior value from IDB.
    mod.primeColdStartCacheMap([['__meta:buildHash', 'stale']]);

    const map = (globalThis as Record<string, unknown>)
      .__ONEKEY_COLD_START_CACHE_MAP__ as Map<string, unknown>;
    expect(map.get('__meta:buildHash')).toBe('live');
  });

  it('fills keys not yet present', () => {
    const mod = loadModule();
    mod.primeColdStartCacheMap([['__meta:buildHash', 'abc123']]);

    const map = (globalThis as Record<string, unknown>)
      .__ONEKEY_COLD_START_CACHE_MAP__ as Map<string, unknown>;
    expect(map.get('__meta:buildHash')).toBe('abc123');
  });
});

describe('ISyncStorage facade coercion', () => {
  it('getBoolean / getNumber handle empty / truthy / numeric / out-of-domain raw values', () => {
    const mod = loadModule();
    const s = mod.createWebColdStartStorage();

    // s.set('', ...) → safeSet stores '' via the empty-coalescing branch.
    void s.set(EAppSyncStorageKeys.onekey_debug_render_tracker, '');
    expect(s.getBoolean(EAppSyncStorageKeys.onekey_debug_render_tracker)).toBe(
      false,
    );
    expect(
      s.getNumber(EAppSyncStorageKeys.onekey_debug_render_tracker),
    ).toBeUndefined();

    void s.set(EAppSyncStorageKeys.onekey_debug_render_tracker, true);
    expect(s.getBoolean(EAppSyncStorageKeys.onekey_debug_render_tracker)).toBe(
      true,
    );

    void s.set(EAppSyncStorageKeys.onekey_debug_render_tracker, false);
    expect(s.getBoolean(EAppSyncStorageKeys.onekey_debug_render_tracker)).toBe(
      false,
    );

    void s.set(EAppSyncStorageKeys.onekey_debug_render_tracker, 1);
    expect(s.getBoolean(EAppSyncStorageKeys.onekey_debug_render_tracker)).toBe(
      true,
    );
    expect(s.getNumber(EAppSyncStorageKeys.onekey_debug_render_tracker)).toBe(
      1,
    );

    void s.set(EAppSyncStorageKeys.onekey_debug_render_tracker, 0);
    expect(s.getBoolean(EAppSyncStorageKeys.onekey_debug_render_tracker)).toBe(
      false,
    );
    expect(s.getNumber(EAppSyncStorageKeys.onekey_debug_render_tracker)).toBe(
      0,
    );

    void s.set(EAppSyncStorageKeys.onekey_debug_render_tracker, 42);
    expect(s.getNumber(EAppSyncStorageKeys.onekey_debug_render_tracker)).toBe(
      42,
    );
    // '42' is neither true/false/1/0/empty -> out of domain for boolean
    expect(
      s.getBoolean(EAppSyncStorageKeys.onekey_debug_render_tracker),
    ).toBeUndefined();

    void s.set(EAppSyncStorageKeys.onekey_debug_render_tracker, 'banana');
    expect(
      s.getBoolean(EAppSyncStorageKeys.onekey_debug_render_tracker),
    ).toBeUndefined();
    expect(
      s.getNumber(EAppSyncStorageKeys.onekey_debug_render_tracker),
    ).toBeUndefined();
  });
});

describeIfIndexedDB('IDB-backed paths', () => {
  it('scheduleFlush debounces and writes to IDB after the timer fires', async () => {
    const mod = loadModule();
    mod.writeColdStartMeta('__meta:buildHash', 'v1');
    // Bypass the 2s debounce in the test by force-flushing now; this
    // exercises the same flushDirtyKeysToIdb code path.
    await mod.flushColdStartCacheNow();

    const out = await mod.readAllColdStartEntriesFromIdb();
    expect(out.get('__meta:buildHash')).toBe('v1');
  });

  it('flushDirtyKeysToIdb re-queues on failure so the value lands on the next flush', async () => {
    const { mod, isolatedIDB } = loadModuleWithIdb();

    // Fail the first flush only. dbPromise stays valid (open() is not
    // perturbed), so the second flush can succeed against the same instance.
    let throwOnce = true;
    const restoreWrites = patchIdbWrites(isolatedIDB, {
      failNext: () => {
        if (!throwOnce) {
          return false;
        }
        throwOnce = false;
        return true;
      },
    });

    try {
      mod.writeColdStartMeta('__meta:buildHash', 'v2');
      await mod.flushColdStartCacheNow();
    } finally {
      restoreWrites();
    }
    // Guards against the test silently passing because the injection point
    // stopped being on the flush path.
    expect(throwOnce).toBe(false);

    // Second flush should succeed and the requeued key should land.
    await mod.flushColdStartCacheNow();
    const out = await mod.readAllColdStartEntriesFromIdb();
    expect(out.get('__meta:buildHash')).toBe('v2');
  });

  it('writes every dirty key in one transaction, and deletes in their own', async () => {
    const { mod, isolatedIDB } = loadModuleWithIdb();
    const storage = mod.createWebColdStartStorage();
    // Warm the connection so the opening transaction is not counted.
    await mod.readAllColdStartEntriesFromIdb();

    const modes: string[] = [];
    const written: string[] = [];
    let restoreWrites = patchIdbWrites(isolatedIDB, {
      onTransaction: (mode) => modes.push(mode),
      onPut: (key) => written.push(key),
    });
    try {
      mod.writeColdStartMeta('__meta:a', '1');
      mod.writeColdStartMeta('__meta:b', '2');
      mod.writeColdStartMeta('__meta:c', '3');
      await mod.flushColdStartCacheNow();
    } finally {
      restoreWrites();
    }
    // Three records, one commit round-trip.
    expect(written.toSorted()).toEqual(['__meta:a', '__meta:b', '__meta:c']);
    expect(modes).toEqual(['readwrite']);

    modes.length = 0;
    restoreWrites = patchIdbWrites(isolatedIDB, {
      onTransaction: (mode) => modes.push(mode),
    });
    try {
      void storage.delete(EAppSyncStorageKeys.onekey_debug_render_tracker);
      mod.writeColdStartMeta('__meta:d', '4');
      await mod.flushColdStartCacheNow();
    } finally {
      restoreWrites();
    }
    // Deletes keep a transaction of their own so they stay allowed while the
    // disk-full guard is raised.
    expect(modes).toEqual(['readwrite', 'readwrite']);

    const out = await mod.readAllColdStartEntriesFromIdb();
    expect(out.get('__meta:a')).toBe('1');
    expect(out.get('__meta:d')).toBe('4');
  });

  it('resetColdStartCache wipes both map and IDB', async () => {
    const mod = loadModule();
    mod.writeColdStartMeta('__meta:buildHash', 'wipe-me');
    await mod.flushColdStartCacheNow();

    // Sanity: it is in IDB now.
    const before = await mod.readAllColdStartEntriesFromIdb();
    expect(before.size).toBeGreaterThan(0);

    await mod.resetColdStartCache();

    const map = (globalThis as Record<string, unknown>)
      .__ONEKEY_COLD_START_CACHE_MAP__ as Map<string, unknown>;
    expect(map.size).toBe(0);

    const after = await mod.readAllColdStartEntriesFromIdb();
    expect(after.size).toBe(0);
  });

  // ---- inFlightFlush mutex regression guards ----
  //
  // These tests defend against the mutex-cleanup bug where
  // `inFlightFlush = current.finally(cb)` was paired with a
  // `if (inFlightFlush === current)` comparison inside the callback.
  // Promise.prototype.finally returns a NEW promise, so the comparison
  // was always false and inFlightFlush stayed latched after the first
  // flush. Every subsequent flush then entered
  // `while (inFlightFlush) await inFlightFlush` against an already-
  // resolved promise — a microtask-only loop that starves the renderer.
  //
  // If the bug ever returns, these tests hang forever (the runner will
  // be killed by the global CI timeout). A hang IS the failure signal.
  // A passing run means the cleanup actually clears inFlightFlush.

  it('sequential flushes both land in IDB (regression: mutex leak hangs second flush)', async () => {
    const mod = loadModule();

    mod.writeColdStartMeta('__meta:first', 'a');
    await mod.flushColdStartCacheNow();

    // If inFlightFlush stays latched after the first flush, this second
    // call enters a microtask-starvation loop and the test hangs.
    mod.writeColdStartMeta('__meta:second', 'b');
    await mod.flushColdStartCacheNow();

    const out = await mod.readAllColdStartEntriesFromIdb();
    expect(out.get('__meta:first')).toBe('a');
    expect(out.get('__meta:second')).toBe('b');
  });

  it('concurrent flushes coalesce and all resolve', async () => {
    const mod = loadModule();

    mod.writeColdStartMeta('__meta:a', 'one');
    mod.writeColdStartMeta('__meta:b', 'two');

    // Two simultaneous force-flushes should both resolve. The mutex is
    // expected to serialize them; if the mutex never clears, the second
    // never resolves and the Promise.all hangs.
    await Promise.all([
      mod.flushColdStartCacheNow(),
      mod.flushColdStartCacheNow(),
    ]);

    const out = await mod.readAllColdStartEntriesFromIdb();
    expect(out.get('__meta:a')).toBe('one');
    expect(out.get('__meta:b')).toBe('two');
  });

  it('flush after reset does not hang on a stale in-flight mutex', async () => {
    const mod = loadModule();

    mod.writeColdStartMeta('__meta:before', 'old');
    await mod.flushColdStartCacheNow();

    await mod.resetColdStartCache();

    mod.writeColdStartMeta('__meta:after', 'new');
    await mod.flushColdStartCacheNow();

    const out = await mod.readAllColdStartEntriesFromIdb();
    expect(out.get('__meta:before')).toBeUndefined();
    expect(out.get('__meta:after')).toBe('new');
  });

  it('macrotasks still fire after a flush — proves the mutex is not starving them', async () => {
    const mod = loadModule();
    mod.writeColdStartMeta('__meta:x', 'one');
    await mod.flushColdStartCacheNow();

    // Schedule a setTimeout macrotask. If a subsequent flush enters the
    // microtask-starvation loop, the macrotask queue never drains and
    // this setTimeout never fires, hanging the test.
    let macrotaskRan = false;
    const macrotaskFired = new Promise<void>((resolve) => {
      setTimeout(() => {
        macrotaskRan = true;
        resolve();
      }, 0);
    });

    mod.writeColdStartMeta('__meta:y', 'two');
    await mod.flushColdStartCacheNow();
    await macrotaskFired;

    expect(macrotaskRan).toBe(true);
  });

  // ---- True-drain regression guard ----
  //
  // runFlushOnce takes a snapshot of dirtyKeys at its top and clears the
  // Set, then awaits IDB puts. Writes that arrive during that await go
  // back into dirtyKeys but were previously returned WITHOUT being
  // persisted by the originating flushColdStartCacheNow call — a real
  // correctness bug on the pagehide / visibilitychange path where the
  // caller has nowhere to retry. flushDirtyKeysToIdb now loops until both
  // the in-flight mutex is clear and dirtyKeys is empty.

  it('flushColdStartCacheNow drains dirty keys that arrive mid-flight', async () => {
    // Load the module inside an isolated registry AND patch the
    // IndexedDBPromised class loaded by THAT registry — the outer-registry
    // class imported at the top of this file is a different identity once
    // jest.isolateModules has re-evaluated the module graph.
    let mod!: IColdStartModule;
    let isolatedIDB!: typeof IndexedDBPromised;
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      ({ IndexedDBPromised: isolatedIDB } =
        require('../../IndexedDBPromised') as {
          IndexedDBPromised: typeof IndexedDBPromised;
        });
      // eslint-disable-next-line global-require
      mod = require('./webColdStartStorage') as IColdStartModule;
    });
    activeModule = mod;

    // Hold the flush open so we have a window to dirty a new key while the
    // first batch is still in flight.
    const restoreWrites = patchIdbWrites(isolatedIDB, { delayMs: 100 });

    try {
      mod.writeColdStartMeta('__meta:a', '1');
      const firstFlush = mod.flushColdStartCacheNow();
      // Yield long enough that the first batch has started (so dirtyKeys has
      // been snapshotted+cleared inside runFlushOnce) but not yet written
      // (still inside the 100ms delay). The followup write below then lands
      // AFTER the snapshot — the drain loop must pick it up.
      await new Promise((r) => setTimeout(r, 20));
      mod.writeColdStartMeta('__meta:b', '2');
      await firstFlush;
    } finally {
      restoreWrites();
    }

    const out = await mod.readAllColdStartEntriesFromIdb();
    expect(out.get('__meta:a')).toBe('1');
    expect(out.get('__meta:b')).toBe('2');
  });

  // ---- Failed-flush re-arm regression guard ----
  //
  // runFlushOnce used to re-queue keys on failure but NOT reset the
  // debounce timer. If no further writes came in, the dirty keys sat
  // forever. The fix re-arms a fresh 2s timer when a flush throws.

  it('failed flush re-arms the debounce timer for the next try', async () => {
    const { mod, isolatedIDB } = loadModuleWithIdb();
    // Open the connection while real timers are still running: fake-indexeddb
    // needs them, so a first openDb() under fake timers never settles and the
    // flush would stall before reaching the injection point.
    await mod.readAllColdStartEntriesFromIdb();

    jest.useFakeTimers();
    try {
      let failNext = true;
      const restoreWrites = patchIdbWrites(isolatedIDB, {
        failNext: () => {
          if (!failNext) {
            return false;
          }
          failNext = false;
          return true;
        },
      });

      try {
        // Writes through the facade arm the 2s debounce timer; we never
        // call flushColdStartCacheNow here so the only path to IDB is the
        // re-armed timer scheduled by runFlushOnce on failure.
        mod.writeColdStartMeta('__meta:retry', 'val');

        // First flush fires; the patched write throws; key is requeued and
        // a new 2s timer is armed.
        await jest.advanceTimersByTimeAsync(2000);

        // Second flush fires against the now-passing write and succeeds.
        await jest.advanceTimersByTimeAsync(2000);

        // Drain any straggling timers (none expected, but harmless).
        await jest.runOnlyPendingTimersAsync();
      } finally {
        restoreWrites();
      }
      expect(failNext).toBe(false);

      // Switch to real timers before awaiting the IDB read, otherwise the
      // fake-indexeddb internals that depend on setTimeout never resolve.
      jest.useRealTimers();
      const out = await mod.readAllColdStartEntriesFromIdb();
      expect(out.get('__meta:retry')).toBe('val');
    } finally {
      // Ensure real timers are restored even if an assertion above throws.
      jest.useRealTimers();
    }
  });

  // ---- Lifecycle-trigger self-registration ----
  //
  // The visibilitychange / pagehide / freeze listeners that drive
  // flushColdStartCacheNow were previously only attached when the first
  // contextAtom({ coldStartCache: true }) rendered (via
  // ensureColdStartAppStateListener in packages/kit-bg). If a user closed
  // the tab BEFORE that atom mounted, dirty writes here were stranded.
  // scheduleFlush now self-registers the trigger on the first dirty key.

  it('scheduleFlush attaches the lifecycle flush trigger on first dirty key', () => {
    const registerMock = registerColdStartFlushTrigger as unknown as jest.Mock;
    registerMock.mockClear();

    const mod = loadModule();
    mod.writeColdStartMeta('__meta:k', 'v');
    expect(registerMock).toHaveBeenCalledTimes(1);

    // Second dirty key in the same module instance must NOT re-register —
    // the trigger latch lives on the module-level coldStartTriggerRegistered
    // flag, reset only by __resetForTests.
    mod.writeColdStartMeta('__meta:k2', 'v2');
    expect(registerMock).toHaveBeenCalledTimes(1);
  });

  // ---- Permanent-failure drain-loop regression guard ----
  //
  // When IDB.put rejects on every call (private mode, quota=0), runFlushOnce
  // catches and re-adds the snapshotted keys to dirtyKeys. The drain loop in
  // flushDirtyKeysToIdb (`while (inFlightFlush || dirtyKeys.size > 0)`)
  // would otherwise loop forever in microtasks because the module-level
  // consecutiveFlushFailures cap only gates the debounce-timer re-arm, not
  // the active drain loop. The fix adds a local consecutive-failure counter
  // inside flushDirtyKeysToIdb that drops the doomed keys and returns once
  // the cap is exceeded — flushColdStartCacheNow() from
  // visibilitychange/pagehide can then resolve cleanly even on a
  // permanently-broken IDB.
  //
  // If the bug ever returns this test hangs; we bound the assertion with a
  // Promise.race + setTimeout fuse so the failure surface is a thrown error
  // ("flushColdStartCacheNow did not resolve") rather than a runner timeout.

  it('flushColdStartCacheNow resolves even when IDB.put permanently rejects', async () => {
    let mod!: IColdStartModule;
    let isolatedIDB!: typeof IndexedDBPromised;
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      ({ IndexedDBPromised: isolatedIDB } =
        require('../../IndexedDBPromised') as {
          IndexedDBPromised: typeof IndexedDBPromised;
        });
      // eslint-disable-next-line global-require
      mod = require('./webColdStartStorage') as IColdStartModule;
    });
    activeModule = mod;

    let injectedFailures = 0;
    const restoreWrites = patchIdbWrites(isolatedIDB, {
      failNext: () => {
        injectedFailures += 1;
        return true;
      },
    });

    try {
      mod.writeColdStartMeta('__meta:permafail', 'doomed');

      // Bounded await: if the fix is missing, flushColdStartCacheNow stays
      // in a microtask loop forever and the race timer fires the rejection.
      const TIMEOUT_MS = 2000;
      const flushed = mod.flushColdStartCacheNow();
      // Keep a handle on the fuse timer so we can clear it once the race
      // settles. Promise.race leaves the losing promise's timer pending, and
      // an un-cleared setTimeout is an open handle that keeps jest from
      // exiting (CI hangs after coverage prints with no --forceExit).
      let raceTimer: ReturnType<typeof setTimeout> | undefined;
      const bounded = Promise.race([
        flushed,
        new Promise<never>((_, reject) => {
          raceTimer = setTimeout(
            () =>
              // eslint-disable-next-line no-restricted-syntax, onekey/no-raw-error
              reject(
                new Error(
                  `flushColdStartCacheNow did not resolve within ${TIMEOUT_MS}ms`,
                ),
              ),
            TIMEOUT_MS,
          );
        }),
      ]);
      try {
        await expect(bounded).resolves.toBeUndefined();
      } finally {
        if (raceTimer) clearTimeout(raceTimer);
      }

      // Give-up cleanup: dirtyKeys must be empty so a subsequent caller (or
      // resetColdStartCache) does not pick up the same doomed keys. We peek
      // at the give-up effect via writeColdStartMeta — adding a new key
      // after the loop bailed must still schedule (the latch only short-
      // circuits the drain, not future writes).
      const map = (globalThis as Record<string, unknown>)
        .__ONEKEY_COLD_START_CACHE_MAP__ as Map<string, unknown>;
      // The in-memory map still holds the value (we never wipe the map on
      // a flush failure — only dirtyKeys), but no entry should be queued
      // for a doomed retry.
      expect(map.get('__meta:permafail')).toBe('doomed');
      // Guards the test against silently passing because the injection
      // point stopped being on the flush path.
      expect(injectedFailures).toBeGreaterThan(0);
    } finally {
      restoreWrites();
    }
  });

  // ---- Reset race / data-resurrection regression guard ----
  //
  // resetColdStartCache wipes the map + dirtyKeys, awaits the in-flight
  // flush, then issues db.clear. During the `await openDb()` + `await
  // db.clear()` window any concurrent writer (swrCacheUtils flush, ctx
  // snapshot writer, facade .set) used to be able to call back into
  // scheduleFlush, populating dirtyKeys with data that was supposed to be
  // wiped — the next flush would persist the resurrected entries.
  //
  // The fix latches `isClearing = true` for the whole resetColdStartCache
  // body; scheduleFlush + every facade mutator + writeColdStartMeta become
  // no-ops while the latch is held. This test simulates the race by
  // delaying db.clear and issuing concurrent writes during the window.

  it('resetColdStartCache rejects concurrent writes that arrive during db.clear', async () => {
    let mod!: IColdStartModule;
    let isolatedIDB!: typeof IndexedDBPromised;
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      ({ IndexedDBPromised: isolatedIDB } =
        require('../../IndexedDBPromised') as {
          IndexedDBPromised: typeof IndexedDBPromised;
        });
      // eslint-disable-next-line global-require
      mod = require('./webColdStartStorage') as IColdStartModule;
    });
    activeModule = mod;

    // Delay db.clear() so we can interleave writes during the latched
    // window. The patched method still issues the real clear afterwards.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const realClear = isolatedIDB.prototype.clear;
    (isolatedIDB.prototype as unknown as { clear: typeof realClear }).clear =
      async function delayedClear(this: IndexedDBPromised<unknown>, ...args) {
        await new Promise((r) => setTimeout(r, 50));
        return (realClear as (...a: typeof args) => Promise<unknown>).apply(
          this,
          args,
        ) as ReturnType<typeof realClear>;
      } as typeof realClear;

    try {
      // Pre-seed an entry so the wipe has something to clear.
      mod.writeColdStartMeta('__meta:initial', 'seed');
      await mod.flushColdStartCacheNow();

      // Kick off the reset and DO NOT await yet. Concurrent writers fire
      // while the patched db.clear is sleeping 50ms.
      const resetPromise = mod.resetColdStartCache();
      // Yield to let resetColdStartCache enter the latched window.
      await new Promise((r) => setTimeout(r, 5));

      // These should all be dropped by the isClearing latch.
      mod.writeColdStartMeta('__meta:racy', 'should-be-rejected');
      const s = mod.createWebColdStartStorage();
      void s.set(
        EAppSyncStorageKeys.onekey_debug_render_tracker,
        'should-also-be-rejected',
      );

      await resetPromise;

      // In-memory map and IDB must both be empty.
      const map = (globalThis as Record<string, unknown>)
        .__ONEKEY_COLD_START_CACHE_MAP__ as Map<string, unknown>;
      expect(map.size).toBe(0);
      const after = await mod.readAllColdStartEntriesFromIdb();
      expect(after.size).toBe(0);

      // Latch must have been released: a post-reset write should land.
      mod.writeColdStartMeta('__meta:after', 'ok');
      await mod.flushColdStartCacheNow();
      const finalEntries = await mod.readAllColdStartEntriesFromIdb();
      expect(finalEntries.get('__meta:after')).toBe('ok');
      // And the racy writes are not present.
      expect(finalEntries.get('__meta:racy')).toBeUndefined();
      expect(
        finalEntries.has(
          EAppSyncStorageKeys.onekey_debug_render_tracker as string,
        ),
      ).toBe(false);
    } finally {
      (isolatedIDB.prototype as unknown as { clear: typeof realClear }).clear =
        realClear;
    }
  });
});

describeIfIndexedDB('SWR cache per-entry records', () => {
  type ISwrCacheUtilsModule = typeof import('../../utils/swrCacheUtils');
  const LEGACY_SWR_KEY = EAppSyncStorageKeys.onekey_swr_cache as string;
  const ENTRY_PREFIX = '__onekey_internal_swr_cache_v2_entry__:';

  function loadWithSWRCache() {
    let mod!: IColdStartModule;
    let swr!: ISwrCacheUtilsModule;
    let isolatedIDB!: typeof IndexedDBPromised;
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      ({ IndexedDBPromised: isolatedIDB } =
        require('../../IndexedDBPromised') as {
          IndexedDBPromised: typeof IndexedDBPromised;
        });
      // eslint-disable-next-line global-require
      mod = require('./webColdStartStorage') as IColdStartModule;
      const storage = mod.createWebColdStartStorage();
      jest.doMock('./syncStorageInstance', () => ({
        coldStartCacheStorage: storage,
      }));
      jest.doMock('../../logger/logger', () => ({
        defaultLogger: {
          app: {
            perf: {
              swrCacheCapacityLimit: () => undefined,
              swrCacheSlowOp: () => undefined,
            },
          },
        },
      }));
      // eslint-disable-next-line global-require
      swr = require('../../utils/swrCacheUtils') as ISwrCacheUtilsModule;
      // swrCacheUtils resolves its storage lazily; resolve it inside this
      // registry so it binds to this test's storage instance.
      swr.swrCacheUtils.isFresh('warmup', 0);
    });
    activeModule = mod;
    return { isolatedIDB, mod, swrCacheUtils: swr.swrCacheUtils };
  }

  function recordIdbPuts(isolatedIDB: typeof IndexedDBPromised) {
    const keys: string[] = [];
    const restore = patchIdbWrites(isolatedIDB, {
      onPut: (key) => keys.push(key),
    });
    return { keys, restore };
  }

  it('persists only the changed records and ignores the previous single-record store', async () => {
    const { isolatedIDB, mod, swrCacheUtils } = loadWithSWRCache();
    mod.primeColdStartCacheMap([
      [
        LEGACY_SWR_KEY,
        JSON.stringify({ 'walletList:v1:0': { d: ['legacy'], t: 1 } }),
      ],
      [
        `${ENTRY_PREFIX}accSelList:v1:hd-1`,
        JSON.stringify({ d: { rows: 1 }, t: 2 }),
      ],
    ]);

    expect(swrCacheUtils.get('walletList:v1:0')).toBeUndefined();
    expect(swrCacheUtils.get('accSelList:v1:hd-1')).toEqual({ rows: 1 });

    const puts = recordIdbPuts(isolatedIDB);
    try {
      swrCacheUtils.set('walletList:v1:0', ['wallet']);
      swrCacheUtils.flushNow();
      await mod.flushColdStartCacheNow();
    } finally {
      puts.restore();
    }
    expect(puts.keys).toEqual([`${ENTRY_PREFIX}walletList:v1:0`]);
    const persisted = await mod.readAllColdStartEntriesFromIdb();
    expect(
      JSON.parse(persisted.get(`${ENTRY_PREFIX}walletList:v1:0`) as string).d,
    ).toEqual(['wallet']);
  });

  it('leaves the legacy single-record store on disk without priming it', async () => {
    const { mod } = loadWithSWRCache();
    const storage = mod.createWebColdStartStorage();
    void storage.setObject(LEGACY_SWR_KEY as EAppSyncStorageKeys, { a: 1 });
    await mod.flushColdStartCacheNow();

    // A later session: the record is on disk, the map starts empty.
    (globalThis as Record<string, unknown>).__ONEKEY_COLD_START_CACHE_MAP__ =
      new Map();

    const { allKeys, entries } =
      await mod.readColdStartCriticalEntriesFromIdb();
    mod.primeColdStartCacheMap([...entries]);

    // Reported, so the build-hash gate still counts it, but never read in.
    expect(allKeys).toContain(LEGACY_SWR_KEY);
    expect(
      storage.getString(LEGACY_SWR_KEY as EAppSyncStorageKeys),
    ).toBeUndefined();

    await mod.flushColdStartCacheNow();
    expect(
      (await mod.readAllColdStartEntriesFromIdb()).has(LEGACY_SWR_KEY),
    ).toBe(true);
  });

  it('materializes only the non-SWR records, but reports every key', async () => {
    const { mod, swrCacheUtils } = loadWithSWRCache();
    const storage = mod.createWebColdStartStorage();
    mod.writeColdStartMeta('__meta:buildHash', 'abc');
    void storage.setObject(LEGACY_SWR_KEY as EAppSyncStorageKeys, { a: 1 });
    swrCacheUtils.set('marketTokenDetail:v1:a', 1);
    swrCacheUtils.set('walletList:v1:0', 2);
    swrCacheUtils.flushNow();
    await mod.flushColdStartCacheNow();

    const { allKeys, entries } =
      await mod.readColdStartCriticalEntriesFromIdb();

    // Every key is reported, so the build-hash gate can still count them.
    expect(allKeys).toEqual(
      expect.arrayContaining([
        '__meta:buildHash',
        LEGACY_SWR_KEY,
        `${ENTRY_PREFIX}marketTokenDetail:v1:a`,
        `${ENTRY_PREFIX}walletList:v1:0`,
      ]),
    );
    // But no SWR value — nor the legacy record — is deserialized.
    expect([...entries.keys()]).toEqual(['__meta:buildHash']);
  });

  // PR 13609 review: a key that is a namespace on its own — swapHistoryPreviewList
  // is the one in the tree — has nothing after it to range over, and a
  // `namespace:` range skips the very record it is named after.
  it('hydrates a key that is a namespace on its own', async () => {
    const { mod, swrCacheUtils } = loadWithSWRCache();
    swrCacheUtils.set('swapHistoryPreviewList', ['history']);
    swrCacheUtils.set('marketTokenDetail:v1:a', 1);
    swrCacheUtils.flushNow();
    await mod.flushColdStartCacheNow();

    const { allKeys } = await mod.readColdStartCriticalEntriesFromIdb();
    const swrEntries = await mod.readColdStartSWREntriesFromIdb(allKeys);

    expect([...swrEntries.keys()].toSorted()).toEqual([
      `${ENTRY_PREFIX}marketTokenDetail:v1:a`,
      `${ENTRY_PREFIX}swapHistoryPreviewList`,
    ]);
  });

  it('caps the SWR records it reads per namespace and overall', async () => {
    const { mod, swrCacheUtils } = loadWithSWRCache();
    ['marketTokenDetail', 'marketStockDetail'].forEach((namespace) => {
      for (let i = 0; i < 6; i += 1) {
        swrCacheUtils.set(`${namespace}:v1:${String(i).padStart(2, '0')}`, i);
      }
    });
    swrCacheUtils.flushNow();
    await mod.flushColdStartCacheNow();

    const { allKeys } = await mod.readColdStartCriticalEntriesFromIdb();

    const perNamespace = await mod.readColdStartSWREntriesFromIdb(allKeys, {
      maxEntriesPerNamespace: 2,
    });
    expect([...perNamespace.keys()].toSorted()).toEqual([
      `${ENTRY_PREFIX}marketStockDetail:v1:00`,
      `${ENTRY_PREFIX}marketStockDetail:v1:01`,
      `${ENTRY_PREFIX}marketTokenDetail:v1:00`,
      `${ENTRY_PREFIX}marketTokenDetail:v1:01`,
    ]);

    const overall = await mod.readColdStartSWREntriesFromIdb(allKeys, {
      maxEntriesPerNamespace: 6,
      maxEntries: 3,
    });
    expect(overall.size).toBe(3);

    // A range never reaches into an adjacent namespace.
    const single = await mod.readColdStartSWREntriesFromIdb(
      allKeys.filter((key) => key.includes('marketStockDetail')),
      { maxEntriesPerNamespace: 10 },
    );
    expect(single.size).toBe(6);
    expect(
      [...single.keys()].every((key) => key.includes('marketStockDetail')),
    ).toBe(true);
  });

  it('serves records primed after the first SWR read', () => {
    const { mod, swrCacheUtils } = loadWithSWRCache();
    expect(swrCacheUtils.get('walletList:v1:0')).toBeUndefined();

    mod.primeColdStartCacheMap([
      [`${ENTRY_PREFIX}walletList:v1:0`, JSON.stringify({ d: ['late'], t: 5 })],
    ]);

    expect(swrCacheUtils.get('walletList:v1:0')).toEqual(['late']);
  });

  it('drops the runtime copy when the cold-start cache is reset', async () => {
    const { mod, swrCacheUtils } = loadWithSWRCache();
    mod.primeColdStartCacheMap([
      [`${ENTRY_PREFIX}walletList:v1:0`, JSON.stringify({ d: ['old'], t: 5 })],
    ]);
    expect(swrCacheUtils.get('walletList:v1:0')).toEqual(['old']);

    await mod.resetColdStartCache();

    expect(swrCacheUtils.get('walletList:v1:0')).toBeUndefined();
  });
});
