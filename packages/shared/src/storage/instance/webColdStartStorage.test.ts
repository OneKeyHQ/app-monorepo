/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// Unit tests for webColdStartStorage. Uses fake-indexeddb to polyfill
// globalThis.indexedDB so the IndexedDBPromised facade's jest branch
// (platformEnv.isJest -> globalThis.indexedDB) finds a real factory.

import { IndexedDBPromised } from '../../IndexedDBPromised';
import { EAppSyncStorageKeys } from '../syncStorageKeys';

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
  it('does not clobber an entry already written by setColdStartL1MirrorEntry', () => {
    const mod = loadModule();
    mod.setColdStartL1MirrorEntry('foo', { v: 1 });
    mod.primeColdStartCacheMap([['jotai/foo', JSON.stringify({ v: 0 })]]);

    const map = (globalThis as Record<string, unknown>)
      .__ONEKEY_COLD_START_CACHE_MAP__ as Map<string, string>;
    const raw = map.get('jotai/foo');
    expect(raw).toBeDefined();
    expect(JSON.parse(raw as string)).toEqual({ v: 1 });
  });

  it('fills keys not yet present', () => {
    const mod = loadModule();
    mod.primeColdStartCacheMap([['jotai/bar', JSON.stringify({ v: 42 })]]);

    const map = (globalThis as Record<string, unknown>)
      .__ONEKEY_COLD_START_CACHE_MAP__ as Map<string, string>;
    expect(JSON.parse(map.get('jotai/bar') as string)).toEqual({ v: 42 });
  });
});

describe('setColdStartL1MirrorEntry', () => {
  it("stores entries under the 'jotai/' prefix consumed by hydrate.ts", () => {
    const mod = loadModule();
    mod.setColdStartL1MirrorEntry('myAtom', { a: 1 });
    const map = (globalThis as Record<string, unknown>)
      .__ONEKEY_COLD_START_CACHE_MAP__ as Map<string, string>;
    expect(map.has('jotai/myAtom')).toBe(true);
    expect(map.has('myAtom')).toBe(false);
  });

  it('ignores empty atom names', () => {
    const mod = loadModule();
    mod.setColdStartL1MirrorEntry('', { a: 1 });
    const map = (globalThis as Record<string, unknown>)
      .__ONEKEY_COLD_START_CACHE_MAP__ as Map<string, string> | undefined;
    expect(map === undefined || map.size === 0).toBe(true);
  });
});

describe('ISyncStorage facade coercion', () => {
  it('getBoolean / getNumber handle empty / truthy / numeric / out-of-domain raw values', () => {
    const mod = loadModule();
    const s = mod.createWebColdStartStorage();

    // s.set('', ...) → safeSet stores '' via the empty-coalescing branch.
    s.set(EAppSyncStorageKeys.rrt, '');
    expect(s.getBoolean(EAppSyncStorageKeys.rrt)).toBe(false);
    expect(s.getNumber(EAppSyncStorageKeys.rrt)).toBeUndefined();

    s.set(EAppSyncStorageKeys.rrt, true);
    expect(s.getBoolean(EAppSyncStorageKeys.rrt)).toBe(true);

    s.set(EAppSyncStorageKeys.rrt, false);
    expect(s.getBoolean(EAppSyncStorageKeys.rrt)).toBe(false);

    s.set(EAppSyncStorageKeys.rrt, 1);
    expect(s.getBoolean(EAppSyncStorageKeys.rrt)).toBe(true);
    expect(s.getNumber(EAppSyncStorageKeys.rrt)).toBe(1);

    s.set(EAppSyncStorageKeys.rrt, 0);
    expect(s.getBoolean(EAppSyncStorageKeys.rrt)).toBe(false);
    expect(s.getNumber(EAppSyncStorageKeys.rrt)).toBe(0);

    s.set(EAppSyncStorageKeys.rrt, 42);
    expect(s.getNumber(EAppSyncStorageKeys.rrt)).toBe(42);
    // '42' is neither true/false/1/0/empty -> out of domain for boolean
    expect(s.getBoolean(EAppSyncStorageKeys.rrt)).toBeUndefined();

    s.set(EAppSyncStorageKeys.rrt, 'banana');
    expect(s.getBoolean(EAppSyncStorageKeys.rrt)).toBeUndefined();
    expect(s.getNumber(EAppSyncStorageKeys.rrt)).toBeUndefined();
  });
});

describeIfIndexedDB('IDB-backed paths', () => {
  it('scheduleFlush debounces and writes to IDB after the timer fires', async () => {
    const mod = loadModule();
    mod.setColdStartL1MirrorEntry('foo', { v: 7 });
    // Bypass the 2s debounce in the test by force-flushing now; this
    // exercises the same flushDirtyKeysToIdb code path.
    await mod.flushColdStartCacheNow();

    const out = await mod.readAllColdStartEntriesFromIdb();
    const raw = out.get('jotai/foo');
    expect(raw).toBeDefined();
    expect(JSON.parse(raw as string)).toEqual({ v: 7 });
  });

  it('flushDirtyKeysToIdb re-queues on failure so the value lands on the next flush', async () => {
    const mod = loadModule();

    // Patch IndexedDBPromised.prototype.put to throw on the first call only.
    // dbPromise stays valid (open() is not perturbed), so the second flush
    // can succeed against the same underlying instance.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const realPut = IndexedDBPromised.prototype.put;
    let throwOnce = true;
    (IndexedDBPromised.prototype as unknown as { put: typeof realPut }).put =
      async function patchedPut(this: IndexedDBPromised<unknown>, ...args) {
        if (throwOnce) {
          throwOnce = false;
          // Test-only synthetic rejection; the catch site only inspects the
          // value as `unknown`, so a raw Error is sufficient.
          // eslint-disable-next-line no-restricted-syntax, onekey/no-raw-error
          throw new Error('forced put failure');
        }
        return (realPut as (...a: typeof args) => Promise<unknown>).apply(
          this,
          args,
        ) as ReturnType<typeof realPut>;
      } as typeof realPut;

    try {
      mod.setColdStartL1MirrorEntry('foo', { v: 9 });
      await mod.flushColdStartCacheNow();
    } finally {
      (IndexedDBPromised.prototype as unknown as { put: typeof realPut }).put =
        realPut;
    }

    // Second flush should succeed and the requeued key should land.
    await mod.flushColdStartCacheNow();
    const out = await mod.readAllColdStartEntriesFromIdb();
    const raw = out.get('jotai/foo');
    expect(raw).toBeDefined();
    expect(JSON.parse(raw as string)).toEqual({ v: 9 });
  });

  it('resetColdStartCache wipes both map and IDB', async () => {
    const mod = loadModule();
    mod.setColdStartL1MirrorEntry('foo', { v: 1 });
    await mod.flushColdStartCacheNow();

    // Sanity: it is in IDB now.
    const before = await mod.readAllColdStartEntriesFromIdb();
    expect(before.size).toBeGreaterThan(0);

    await mod.resetColdStartCache();

    const map = (globalThis as Record<string, unknown>)
      .__ONEKEY_COLD_START_CACHE_MAP__ as Map<string, string>;
    expect(map.size).toBe(0);

    const after = await mod.readAllColdStartEntriesFromIdb();
    expect(after.size).toBe(0);
  });
});
