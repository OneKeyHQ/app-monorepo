import { getPerpsL2BookSnapshotCacheKeys, swrKeys } from './swrCacheUtils';

// The fake disk lives on globalThis so jest.resetModules() can rebuild the
// module (fresh in-memory copy = a fresh runtime) while the "MMKV file"
// persists — that pairing is exactly the cross-runtime setup under test.
type IFakeDisk = Record<string, string>;
const fakeDiskGlobal = globalThis as typeof globalThis & {
  __swrFakeDisk?: IFakeDisk;
  __swrFakeDiskReadCount?: number;
};

jest.mock('../storage/instance/syncStorageInstance', () => {
  const readDisk = () =>
    (globalThis as { __swrFakeDisk?: Record<string, string> }).__swrFakeDisk ??
    {};
  const storage = {
    set: () => {},
    setObject: (key: string, value: Record<string, unknown>) => {
      readDisk()[key] = JSON.stringify(value);
    },
    getObject: (key: string) => {
      const globalState = globalThis as {
        __swrFakeDiskReadCount?: number;
      };
      globalState.__swrFakeDiskReadCount =
        (globalState.__swrFakeDiskReadCount ?? 0) + 1;
      const raw = readDisk()[key];
      return raw === undefined
        ? undefined
        : (JSON.parse(raw) as Record<string, unknown>);
    },
    getString: () => undefined,
    getNumber: () => undefined,
    getBoolean: () => undefined,
    delete: (key: string) => {
      delete readDisk()[key];
    },
    clearAll: () => {
      const disk = readDisk();
      Object.keys(disk).forEach((key) => delete disk[key]);
    },
    getAllKeys: () => Object.keys(readDisk()),
  };
  return {
    __esModule: true,
    coldStartCacheStorage: storage,
    syncStorage: storage,
    createMMKVSyncStorage: () => storage,
  };
});

const DISK_KEY = 'onekey_swr_cache';

function readDiskStore(): Record<string, { d: unknown; t: number }> {
  const raw = fakeDiskGlobal.__swrFakeDisk?.[DISK_KEY];
  return raw
    ? (JSON.parse(raw) as Record<string, { d: unknown; t: number }>)
    : {};
}

// Simulates the other runtime flushing: a wholesale write straight to disk.
function otherRuntimeFlush(store: Record<string, { d: unknown; t: number }>) {
  if (!fakeDiskGlobal.__swrFakeDisk) {
    fakeDiskGlobal.__swrFakeDisk = {};
  }
  fakeDiskGlobal.__swrFakeDisk[DISK_KEY] = JSON.stringify(store);
}

function loadFreshRuntime() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('./swrCacheUtils') as typeof import('./swrCacheUtils'))
    .swrCacheUtils;
}

describe('SWR cache keys', () => {
  it('uses a stable key for cached order book tick options', () => {
    expect(swrKeys.perpsOrderBookTickOptions()).toBe('perpsOrderBookTicks:v1');
  });

  it('uses stable keys for cached market bootstrap requests', () => {
    expect(
      swrKeys.marketHomeTokenList({
        networkId: '',
        sortBy: 'v24hUSD',
        sortType: 'desc',
        pageSize: 20,
        minLiquidity: 5000,
        type: 'trending',
        timeFrame: '2',
      }),
    ).toBe('marketHomeTokenList:v1::v24hUSD:desc:20:5000:trending:2');
    expect(
      swrKeys.marketHomeTokenList({
        networkId: '',
        sortBy: 'v24hUSD',
        sortType: 'desc',
        pageSize: 20,
        minLiquidity: 5000,
        type: 'stocks',
        category: 'tech',
        timeFrame: '2',
      }),
    ).toBe('marketHomeTokenList:v1::v24hUSD:desc:20:5000:stocks:2:tech');
    expect(
      swrKeys.swapStockTokenDetail({
        tokenScope: 'evm--1:0xstock',
      }),
    ).toBe('swapStockTokenDetail:v1:evm--1:0xstock');
    expect(
      swrKeys.swapStockSpeedConfig({
        networkId: 'evm--1',
      }),
    ).toBe('swapStockSpeedConfig:v1:evm--1');
    expect(
      swrKeys.swapStockPayTokenDetails({
        scope: '1:usdc|usdt:idx:acc',
      }),
    ).toBe('swapStockPayTokenDetails:v1:1:usdc|usdt:idx:acc');
  });

  it('uses the default and latest keys when no tick option is requested', () => {
    expect(
      getPerpsL2BookSnapshotCacheKeys({
        coin: 'BTC',
      }),
    ).toEqual([
      swrKeys.perpsL2BookSnapshot({
        coin: 'BTC',
      }),
      swrKeys.perpsL2BookSnapshotLatest({
        coin: 'BTC',
      }),
    ]);
  });

  it('falls back option-specific snapshots only to the coin latest key', () => {
    expect(
      getPerpsL2BookSnapshotCacheKeys({
        coin: 'BTC',
        nSigFigs: 5,
        mantissa: 2,
      }),
    ).toEqual([
      swrKeys.perpsL2BookSnapshot({
        coin: 'BTC',
        nSigFigs: 5,
        mantissa: 2,
      }),
      swrKeys.perpsL2BookSnapshotLatest({
        coin: 'BTC',
      }),
    ]);
  });
});

describe('SWR cache cross-runtime flush merge', () => {
  let nowSpy: jest.SpyInstance<number, []>;

  const setNow = (ms: number) => nowSpy.mockReturnValue(ms);

  beforeEach(() => {
    fakeDiskGlobal.__swrFakeDisk = {};
    fakeDiskGlobal.__swrFakeDiskReadCount = 0;
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('keeps keys the other runtime persisted after this copy hydrated', () => {
    const swr = loadFreshRuntime();
    setNow(1000);
    swr.set('mine', 'a');
    // The other runtime persists a key this copy has never seen — the old
    // wholesale overwrite erased it on the next local flush.
    otherRuntimeFlush({
      ...readDiskStore(),
      theirs: { d: 'b', t: 5000 },
    });
    swr.flushNow();

    const disk = readDiskStore();
    expect(disk.mine).toMatchObject({ d: 'a', t: 1000 });
    expect(disk.theirs).toMatchObject({ d: 'b', t: 5000 });
  });

  it('resolves per-key conflicts by timestamp in both directions', () => {
    const swr = loadFreshRuntime();
    setNow(1000);
    swr.set('diskNewer', 'stale-local');
    swr.set('localNewer', 'old-local');
    otherRuntimeFlush({
      diskNewer: { d: 'fresh-disk', t: 2000 },
      localNewer: { d: 'stale-disk', t: 500 },
    });
    setNow(1500);
    swr.set('localNewer', 'fresh-local');
    swr.flushNow();

    const disk = readDiskStore();
    expect(disk.diskNewer).toMatchObject({ d: 'fresh-disk', t: 2000 });
    expect(disk.localNewer).toMatchObject({ d: 'fresh-local', t: 1500 });
    // The merged store is adopted locally too — the read path must see the
    // other runtime's fresher value, not this copy's aged one.
    expect(swr.get('diskNewer')).toBe('fresh-disk');
  });

  it('does not resurrect a removed key from the other runtime copy', () => {
    otherRuntimeFlush({ doomed: { d: 'x', t: 1000 } });
    const swr = loadFreshRuntime();
    expect(swr.get('doomed')).toBe('x');
    setNow(2000);
    swr.remove('doomed');
    swr.flushNow();
    expect(readDiskStore().doomed).toBeUndefined();

    // A rewrite that postdates the removal wins again.
    otherRuntimeFlush({ doomed: { d: 'rewritten', t: 3000 } });
    setNow(3500);
    swr.set('unrelated', 1);
    swr.flushNow();
    expect(readDiskStore().doomed).toMatchObject({ d: 'rewritten' });
  });

  it('does not resurrect a key another runtime removed after hydration', () => {
    otherRuntimeFlush({
      doomed: { d: 'stale', t: 1000 },
      kept: { d: 'existing', t: 1000 },
    });
    const staleRuntime = loadFreshRuntime();
    expect(staleRuntime.get('doomed')).toBe('stale');

    // The other runtime invalidates and flushes while this runtime still has
    // the old entry in its JS heap.
    otherRuntimeFlush({
      kept: { d: 'existing', t: 1000 },
    });
    setNow(2000);
    staleRuntime.set('unrelated', 'local-write');
    staleRuntime.flushNow();

    const disk = readDiskStore();
    expect(disk.doomed).toBeUndefined();
    expect(disk.kept).toMatchObject({ d: 'existing' });
    expect(disk.unrelated).toMatchObject({ d: 'local-write', t: 2000 });
  });

  it('applies prefix removal against the disk copy as well', () => {
    otherRuntimeFlush({
      'walletList:a': { d: 1, t: 1000 },
      'walletList:b': { d: 2, t: 1200 },
      'kept:c': { d: 3, t: 1000 },
    });
    const swr = loadFreshRuntime();
    setNow(2000);
    swr.removeByPrefix('walletList:');
    swr.flushNow();

    const disk = readDiskStore();
    expect(disk['walletList:a']).toBeUndefined();
    expect(disk['walletList:b']).toBeUndefined();
    expect(disk['kept:c']).toMatchObject({ d: 3 });
  });

  it('clearAll drops older disk entries but keeps ones written after it', () => {
    otherRuntimeFlush({
      older: { d: 1, t: 1000 },
    });
    const swr = loadFreshRuntime();
    setNow(2000);
    swr.clearAll();
    otherRuntimeFlush({
      ...readDiskStore(),
      older: { d: 1, t: 1000 },
      newer: { d: 2, t: 3000 },
    });
    swr.flushNow();

    const disk = readDiskStore();
    expect(disk.older).toBeUndefined();
    expect(disk.newer).toMatchObject({ d: 2 });
  });

  it('enforces the entry cap on the merged result', () => {
    const bulk: Record<string, { d: unknown; t: number }> = {};
    for (let i = 0; i < 300; i += 1) {
      bulk[`bulk:${i}`] = { d: i, t: 10_000 + i };
    }
    otherRuntimeFlush(bulk);
    const swr = loadFreshRuntime();
    setNow(50_000);
    swr.set('fresh', 'kept');
    swr.flushNow();

    const disk = readDiskStore();
    expect(Object.keys(disk).length).toBe(300);
    expect(disk.fresh).toMatchObject({ d: 'kept' });
    // The oldest merged entry is the one evicted.
    expect(disk['bulk:0']).toBeUndefined();
  });

  it('reloads a stale perps hit from disk before returning it', () => {
    const [key] = getPerpsL2BookSnapshotCacheKeys({
      coin: 'BTC',
      nSigFigs: null,
    });
    const oldBook = {
      coin: 'BTC',
      time: 1000,
      levels: [[{ px: '1', sz: '1', n: 1 }], [{ px: '2', sz: '1', n: 1 }]],
      nSigFigs: null,
      mantissa: null,
    };
    const freshBook = {
      ...oldBook,
      time: 35_000,
      levels: [[{ px: '10', sz: '1', n: 1 }], [{ px: '11', sz: '1', n: 1 }]],
    };

    otherRuntimeFlush({
      [key]: { d: oldBook, t: 1000 },
    });
    const swr = loadFreshRuntime();
    expect(swr.get(key)).toEqual(oldBook);

    otherRuntimeFlush({
      [key]: { d: freshBook, t: 35_000 },
    });
    setNow(40_000);

    expect(
      swr.getFreshPerpsL2BookSnapshot({
        coin: 'BTC',
        nSigFigs: null,
        maxAgeMs: 7 * 24 * 60 * 60 * 1000,
        reloadIfOlderThanMs: 30_000,
      }),
    ).toEqual({
      data: freshBook,
      updatedAt: 35_000,
    });
  });

  it('throttles automatic stale perps reloads without blocking explicit reloads', () => {
    const [key] = getPerpsL2BookSnapshotCacheKeys({
      coin: 'BTC',
      nSigFigs: null,
    });
    const staleBook = {
      coin: 'BTC',
      time: 1000,
      levels: [[{ px: '1', sz: '1', n: 1 }], [{ px: '2', sz: '1', n: 1 }]],
      nSigFigs: null,
      mantissa: null,
    };
    const getSnapshot = (swr: ReturnType<typeof loadFreshRuntime>) =>
      swr.getFreshPerpsL2BookSnapshot({
        coin: 'BTC',
        nSigFigs: null,
        maxAgeMs: 7 * 24 * 60 * 60 * 1000,
        reloadIfOlderThanMs: 30_000,
      });

    otherRuntimeFlush({
      [key]: { d: staleBook, t: 1000 },
    });
    const swr = loadFreshRuntime();
    expect(swr.get(key)).toEqual(staleBook);
    expect(fakeDiskGlobal.__swrFakeDiskReadCount).toBe(1);

    setNow(40_000);
    expect(getSnapshot(swr)?.data).toEqual(staleBook);
    expect(fakeDiskGlobal.__swrFakeDiskReadCount).toBe(2);

    setNow(40_001);
    expect(getSnapshot(swr)?.data).toEqual(staleBook);
    expect(fakeDiskGlobal.__swrFakeDiskReadCount).toBe(2);

    swr.reloadFromStorage();
    expect(fakeDiskGlobal.__swrFakeDiskReadCount).toBe(3);
  });
});
