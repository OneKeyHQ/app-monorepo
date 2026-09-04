import {
  SWR_CACHE_MAX_ENTRIES,
  SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
  SWR_CACHE_MAX_KEY_CHARS,
  SWR_CACHE_MAX_KEY_UTF8_BYTES,
  SWR_CACHE_MAX_SERIALIZED_CHARS,
  getPerpsL2BookSnapshotCacheKeys,
  pruneSWRCacheStore,
  swrKeys,
} from './swrCacheUtils';

const mockSWRCacheCapacityLimit = jest.fn();

jest.mock('../logger/logger', () => ({
  defaultLogger: {
    app: {
      perf: {
        swrCacheCapacityLimit: (params: unknown) => {
          mockSWRCacheCapacityLimit(params);
        },
      },
    },
  },
}));

// On globalThis so jest.resetModules() rebuilds the module (a fresh runtime)
// while the "MMKV file" persists — exactly the cross-runtime setup under test.
type IFakeDisk = Record<string, string>;
const fakeDiskGlobal = globalThis as typeof globalThis & {
  __swrFakeDisk?: IFakeDisk;
  __swrFakeDiskReadCount?: number;
  __swrPatches?: unknown[];
  __swrUsePatch?: boolean;
};

jest.mock('../storage/instance/syncStorageInstance', () => {
  const readDisk = () =>
    (globalThis as { __swrFakeDisk?: Record<string, string> }).__swrFakeDisk ??
    {};
  // Counts reads from either accessor so the throttle assertions stay honest.
  const countRead = () => {
    const globalState = globalThis as { __swrFakeDiskReadCount?: number };
    globalState.__swrFakeDiskReadCount =
      (globalState.__swrFakeDiskReadCount ?? 0) + 1;
  };
  const storage = {
    set: () => {},
    setObject: (key: string, value: Record<string, unknown>) => {
      readDisk()[key] = JSON.stringify(value);
    },
    getObject: (key: string) => {
      countRead();
      const raw = readDisk()[key];
      return raw === undefined
        ? undefined
        : (JSON.parse(raw) as Record<string, unknown>);
    },
    // Mirrors the real backends: setObject stores JSON, getString hands the
    // raw string back, so a caller can tell "absent" from "unparseable".
    getString: (key: string) => {
      countRead();
      return readDisk()[key];
    },
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
    ...((globalThis as { __swrUsePatch?: boolean }).__swrUsePatch
      ? {
          applySWRCachePatch: (patch: {
            clearBefore?: number;
            removePrefixes: Array<{ at: number; prefix: string }>;
            removals: Array<readonly [string, number]>;
            updates: Array<readonly [string, string]>;
          }) => {
            const globalState = globalThis as {
              __swrPatches?: unknown[];
            };
            globalState.__swrPatches ??= [];
            globalState.__swrPatches.push(patch);
            const disk = readDisk();
            const store = disk.onekey_swr_cache
              ? (JSON.parse(disk.onekey_swr_cache) as Record<
                  string,
                  { t: number }
                >)
              : {};
            const removeIfOlder = (key: string, at: number) => {
              if (store[key] && store[key].t <= at) {
                delete store[key];
              }
            };
            if (patch.clearBefore !== undefined) {
              Object.keys(store).forEach((key) =>
                removeIfOlder(key, patch.clearBefore as number),
              );
            }
            patch.removePrefixes.forEach(({ at, prefix }) => {
              Object.keys(store).forEach((key) => {
                if (key.startsWith(prefix)) removeIfOlder(key, at);
              });
            });
            patch.removals.forEach(([key, at]) => removeIfOlder(key, at));
            patch.updates.forEach(([key, entry]) => {
              store[key] = JSON.parse(entry) as { t: number };
            });
            disk.onekey_swr_cache = JSON.stringify(store);
          },
        }
      : {}),
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

  it('scopes the buy crypto token list by network, direction and account', () => {
    expect(
      swrKeys.fiatCryptoTokenList({
        networkId: 'onekeyall--0',
        type: 'buy',
        accountId: 'hd-1--m/44h/0h/0h/0/0',
      }),
    ).toBe('fiatCryptoTokenList:v1:onekeyall--0:buy:hd-1--m/44h/0h/0h/0/0');
    expect(
      swrKeys.fiatCryptoTokenList({ networkId: 'evm--1', type: 'buy' }),
    ).toBe('fiatCryptoTokenList:v1:evm--1:buy:');
  });

  it('uses stable keys for cached market bootstrap requests', () => {
    expect(
      swrKeys.marketHomeTokenList({
        networkId: '',
        locale: 'en-US',
        sortBy: 'v24hUSD',
        sortType: 'desc',
        pageSize: 20,
        minLiquidity: 5000,
        type: 'trending',
        timeFrame: '2',
      }),
    ).toBe('marketHomeTokenList:v2::en-US:v24hUSD:desc:20:5000:trending:2');
    expect(
      swrKeys.marketHomeTokenList({
        networkId: '',
        locale: 'zh-CN',
        sortBy: 'v24hUSD',
        sortType: 'desc',
        pageSize: 20,
        minLiquidity: 5000,
        type: 'stocks',
        category: 'tech',
        timeFrame: '2',
      }),
    ).toBe('marketHomeTokenList:v2::zh-CN:v24hUSD:desc:20:5000:stocks:2:tech');
    expect(
      swrKeys.swapStockTokenDetail({
        tokenScope: 'evm--1:0xstock',
      }),
    ).toBe('swapStockTokenDetail:v1:evm--1:0xstock');
    expect(swrKeys.swapHistoryPreviewList()).toBe('swapHistoryPreviewList');
    expect(
      swrKeys.swapStockChart({
        networkId: 'evm--1',
        tokenAddress: '0xstock',
        range: '1W',
        requestCurrency: 'usd',
      }),
    ).toBe('swapStockChart:v1:evm--1:0xstock:token:1W:usd');
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

  it('scopes Borrow and Earn bootstrap data by its authoritative identity', () => {
    expect(swrKeys.borrowMarkets()).toBe('borrowMarkets:v1');
    expect(
      swrKeys.borrowReserves({
        networkId: 'evm--1',
        provider: 'AAVE',
        marketAddress: '0xMarket',
        accountId: 'account-1',
      }),
    ).toBe('borrowReserves:v1:evm--1:aave:0xMarket:account-1');
    expect(
      swrKeys.borrowHealthFactor({
        networkId: 'evm--1',
        provider: 'AAVE',
        marketAddress: '0xMarket',
        accountId: 'account-1',
      }),
    ).toBe('borrowHealthFactor:v1:evm--1:aave:0xMarket:account-1');
    expect(
      swrKeys.borrowRewards({
        networkId: 'evm--1',
        provider: 'AAVE',
        marketAddress: '0xMarket',
        accountId: 'account-1',
      }),
    ).toBe('borrowRewards:v1:evm--1:aave:0xMarket:account-1');
    expect(
      swrKeys.borrowEModeStatus({
        networkId: 'evm--1',
        provider: 'AAVE',
        marketAddress: '0xMarket',
        accountId: 'account-1',
      }),
    ).toBe('borrowEModeStatus:v1:evm--1:aave:0xMarket:account-1');
    expect(
      swrKeys.earnAccount({
        networkId: 'evm--1',
        indexedAccountId: 'wallet-1--1',
        deriveType: 'default',
        btcOnlyTaproot: true,
      }),
    ).toBe('earnAccount:v3:evm--1::wallet-1--1:default:1');
    expect(
      swrKeys.earnProtocolDetail({
        networkId: 'evm--1',
        provider: 'AAVE',
        symbol: 'usdc',
        vault: '0xVault',
        locale: 'zh-CN',
        currencyId: 'CNY',
      }),
    ).toBe('earnProtocolDetail:v2:evm--1:aave:USDC:0xVault:zh-cn:cny');
  });

  it('scopes specified token balances by owner, network, and token set', () => {
    expect(
      swrKeys.specifiedTokenSelectorView({
        accountId: 'account-1',
        networkId: 'evm--1',
        indexedAccountId: 'wallet-1--1',
        targetsKey: 'evm--1:0xusdc:usdc',
      }),
    ).toBe(
      'specifiedTokenSelectorView:v1:account-1:evm--1:wallet-1--1:evm--1:0xusdc:usdc',
    );
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
    fakeDiskGlobal.__swrUsePatch = false;
    fakeDiskGlobal.__swrPatches = [];
    fakeDiskGlobal.__swrFakeDisk = {};
    fakeDiskGlobal.__swrFakeDiskReadCount = 0;
    mockSWRCacheCapacityLimit.mockReset();
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('keeps keys the other runtime persisted after this copy hydrated', () => {
    const swr = loadFreshRuntime();
    setNow(1000);
    swr.set('mine', 'a');
    // The old wholesale overwrite erased this on the next local flush.
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
    // Adopted locally too, so reads see the other runtime's fresher value.
    expect(swr.get('diskNewer')).toBe('fresh-disk');
  });

  it('rebuilds the store from this copy when the disk JSON is unparseable', () => {
    otherRuntimeFlush({
      kept: { d: 'disk', t: 500 },
      alsoKept: { d: 'disk2', t: 600 },
    });
    const swr = loadFreshRuntime();
    expect(swr.get('kept')).toBe('disk');
    // A write cut short by an app kill leaves exactly this half-written state.
    fakeDiskGlobal.__swrFakeDisk = { [DISK_KEY]: '{"kept":{"d":"disk"' };
    setNow(3000);
    swr.set('fresh', 'local');
    swr.flushNow();

    const disk = readDiskStore();
    expect(disk.fresh).toMatchObject({ d: 'local', t: 3000 });
    // Writing only the pending key is the wholesale overwrite this prevents.
    expect(disk.kept).toMatchObject({ d: 'disk', t: 500 });
    expect(disk.alsoKept).toMatchObject({ d: 'disk2', t: 600 });
  });

  it('keeps the in-memory copy when a reload hits an unparseable disk', () => {
    otherRuntimeFlush({ kept: { d: 'disk', t: 500 } });
    const swr = loadFreshRuntime();
    expect(swr.get('kept')).toBe('disk');
    // Not dirty, so the reload has nothing to write back before rebuilding.
    fakeDiskGlobal.__swrFakeDisk = { [DISK_KEY]: '{"kept":{"d":"disk"' };
    swr.reloadFromStorage();

    // Dropping it leaves the next flush nothing to repair the file with.
    expect(swr.get('kept')).toBe('disk');

    setNow(3000);
    swr.set('fresh', 'local');
    swr.flushNow();
    const disk = readDiskStore();
    expect(disk.kept).toMatchObject({ d: 'disk', t: 500 });
    expect(disk.fresh).toMatchObject({ d: 'local', t: 3000 });
  });

  it('leaves an unparseable file alone when this copy has nothing to restore', () => {
    const corrupt = '{"kept":{"d":"disk"';
    fakeDiskGlobal.__swrFakeDisk = { [DISK_KEY]: corrupt };
    // Hydrated after the corruption, so this copy cannot rebuild the file.
    const swr = loadFreshRuntime();
    expect(swr.get('kept')).toBeUndefined();

    swr.reloadFromStorage();
    swr.flushNow();

    // A parseable empty file makes the runtime holding a full copy truncate
    // itself instead of repairing.
    expect(fakeDiskGlobal.__swrFakeDisk?.[DISK_KEY]).toBe(corrupt);
  });

  it('keeps entries in memory when the backend never persists anything', () => {
    // Mirrors the extension stub: writes go nowhere, so this copy is the only one.
    const swr = loadFreshRuntime();
    swr.set('walletList', 'wallets');
    swr.flushNow();
    fakeDiskGlobal.__swrFakeDisk = {};

    setNow(2000);
    swr.set('tokenList', 'tokens');
    swr.flushNow();
    fakeDiskGlobal.__swrFakeDisk = {};

    expect(swr.get('tokenList')).toBe('tokens');
    // A pending-keys-only merge would drop everything not rewritten since.
    expect(swr.get('walletList')).toBe('wallets');
  });

  it('keeps the in-memory copy when a reload finds no store at all', () => {
    const swr = loadFreshRuntime();
    swr.set('walletList', 'wallets');
    swr.flushNow();
    // Mirrors the extension stub: writes go nowhere, so this copy is the only one.
    fakeDiskGlobal.__swrFakeDisk = {};

    swr.reloadFromStorage();

    // The reload runs on the perps first-frame path every 30s, so clearing
    // here drops every namespace for the rest of the session.
    expect(swr.get('walletList')).toBe('wallets');
  });

  it('carries the whole copy forward when the file becomes readable mid-repair', () => {
    otherRuntimeFlush({
      kept: { d: 'disk', t: 500 },
      alsoKept: { d: 'disk2', t: 600 },
    });
    const swr = loadFreshRuntime();
    expect(swr.get('kept')).toBe('disk');
    fakeDiskGlobal.__swrFakeDisk = { [DISK_KEY]: '{"kept":{"d":"disk"' };

    // Schedules the repair from this copy.
    swr.reloadFromStorage();
    // The other runtime republishes a small but parseable store before the
    // repair lands, so the merge must not silently carry nothing forward.
    otherRuntimeFlush({ theirs: { d: 'new', t: 700 } });
    swr.flushNow();

    const disk = readDiskStore();
    expect(disk.theirs).toMatchObject({ d: 'new', t: 700 });
    expect(disk.kept).toMatchObject({ d: 'disk', t: 500 });
    expect(disk.alsoKept).toMatchObject({ d: 'disk2', t: 600 });
    expect(swr.get('kept')).toBe('disk');
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
    for (let i = 0; i < SWR_CACHE_MAX_ENTRIES; i += 1) {
      bulk[`bulk:${i}`] = { d: i, t: 10_000 + i };
    }
    otherRuntimeFlush(bulk);
    const swr = loadFreshRuntime();
    setNow(50_000);
    swr.set('fresh', 'kept');
    swr.flushNow();

    const disk = readDiskStore();
    expect(Object.keys(disk).length).toBe(SWR_CACHE_MAX_ENTRIES);
    expect(disk.fresh).toMatchObject({ d: 'kept' });
    // The oldest merged entry is the one evicted.
    expect(disk['bulk:0']).toBeUndefined();
  });

  it('keeps the newest entries within count and total budgets', () => {
    const result = pruneSWRCacheStore(
      {
        old: { d: 'a'.repeat(40), t: 1 },
        newer: { d: 'b'.repeat(40), t: 2 },
        oversized: { d: 'x'.repeat(200), t: 3 },
      },
      {
        maxEntries: 3,
        maxSerializedChars: 100,
      },
    );

    expect(result.store).toEqual({ newer: { d: 'b'.repeat(40), t: 2 } });
    expect(result.removedKeys).toHaveLength(2);
    expect(result.removedKeys).toEqual(
      expect.arrayContaining(['old', 'oversized']),
    );
    expect(JSON.parse(result.serialized)).toEqual(result.store);
  });

  it('uses the configured count and total cache budgets', () => {
    expect(SWR_CACHE_MAX_ENTRIES).toBe(1000);
    expect(SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS).toBe(5 * 1024 * 1024);
    expect(SWR_CACHE_MAX_KEY_CHARS).toBe(20_000);
    expect(SWR_CACHE_MAX_KEY_UTF8_BYTES).toBe(59_000);
    expect(SWR_CACHE_MAX_SERIALIZED_CHARS).toBe(100 * 1024 * 1024);
  });

  it('retains a value larger than the former per-entry budget', () => {
    const swr = loadFreshRuntime();
    const value = 'x'.repeat(1024 * 1024);

    swr.set('large', value);

    expect(swr.get('large')).toBe(value);
    swr.flushNow();
    expect(readDiskStore().large?.d).toBe(value);
  });

  it('does not retain a value beyond the per-entry budget', () => {
    const swr = loadFreshRuntime();

    swr.set('too-large', 'x'.repeat(SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS));

    expect(swr.get('too-large')).toBeUndefined();
    swr.flushNow();
    expect(readDiskStore()['too-large']).toBeUndefined();
  });

  it('rate-limits and aggregates capacity logs without exposing cache keys', () => {
    const swr = loadFreshRuntime();
    const oversizedValue = 'x'.repeat(SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS);

    setNow(1000);
    swr.set('marketHomeTokenList:first-account', oversizedValue);
    setNow(2000);
    swr.set('marketHomeTokenList:second-account', oversizedValue);

    expect(mockSWRCacheCapacityLimit).toHaveBeenCalledTimes(1);
    expect(mockSWRCacheCapacityLimit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        affectedEntryCount: 1,
        eventCount: 1,
        namespaces: ['marketHomeTokenList'],
        reason: 'entryLimit',
      }),
    );

    setNow(10 * 60_000 + 1001);
    swr.set('marketHomeTokenList:third-account', oversizedValue);

    expect(mockSWRCacheCapacityLimit).toHaveBeenCalledTimes(2);
    expect(mockSWRCacheCapacityLimit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        affectedEntryCount: 2,
        eventCount: 2,
        namespaces: ['marketHomeTokenList'],
        reason: 'entryLimit',
      }),
    );
    expect(JSON.stringify(mockSWRCacheCapacityLimit.mock.calls)).not.toContain(
      'account',
    );
    swr.flushNow();
  });

  it('reloads for a target the other runtime wrote after an unrelated reload', () => {
    const makeBook = (coin: string) => ({
      coin,
      time: 1000,
      levels: [[{ px: '1', sz: '1', n: 1 }], [{ px: '2', sz: '1', n: 1 }]],
      nSigFigs: null,
      mantissa: null,
    });
    const [btcKey] = getPerpsL2BookSnapshotCacheKeys({
      coin: 'BTC',
      nSigFigs: null,
    });
    const [ethKey] = getPerpsL2BookSnapshotCacheKeys({
      coin: 'ETH',
      nSigFigs: null,
    });
    const read = (swr: ReturnType<typeof loadFreshRuntime>, coin: string) =>
      swr.getFreshPerpsL2BookSnapshot({
        coin,
        nSigFigs: null,
        maxAgeMs: 7 * 24 * 60 * 60 * 1000,
        reloadIfOlderThanMs: 30_000,
      });

    otherRuntimeFlush({ [btcKey]: { d: makeBook('BTC'), t: 1000 } });
    const swr = loadFreshRuntime();
    setNow(40_000);
    expect(read(swr, 'BTC')?.data.coin).toBe('BTC');

    // The other runtime persists a second target this copy has never seen.
    otherRuntimeFlush({
      ...readDiskStore(),
      [ethKey]: { d: makeBook('ETH'), t: 41_000 },
    });
    setNow(41_000);

    // One throttle shared by every target would suppress this read for another
    // 29s, leaving a rapid switch on a blank or week-old book.
    expect(read(swr, 'ETH')?.data.coin).toBe('ETH');
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

describe('SWR cache native incremental persistence', () => {
  beforeEach(() => {
    fakeDiskGlobal.__swrFakeDisk = {};
    fakeDiskGlobal.__swrPatches = [];
    fakeDiskGlobal.__swrUsePatch = true;
    mockSWRCacheCapacityLimit.mockReset();
  });

  afterEach(() => {
    fakeDiskGlobal.__swrUsePatch = false;
  });

  it('flushes only the changed entry instead of the hydrated store', () => {
    otherRuntimeFlush({
      existing: { d: 'x'.repeat(100_000), t: 1 },
    });
    const swr = loadFreshRuntime();
    expect(swr.get('existing')).toHaveLength(100_000);

    jest.spyOn(Date, 'now').mockReturnValue(2);
    swr.set('changed', 'small');
    swr.flushNow();

    expect(fakeDiskGlobal.__swrPatches).toEqual([
      {
        removePrefixes: [],
        removals: [],
        updates: [['changed', JSON.stringify({ d: 'small', t: 2 })]],
      },
    ]);
    expect(JSON.stringify(fakeDiskGlobal.__swrPatches)).not.toContain(
      'x'.repeat(100),
    );
    expect(readDiskStore()).toEqual({
      existing: { d: 'x'.repeat(100_000), t: 1 },
      changed: { d: 'small', t: 2 },
    });
    jest.restoreAllMocks();
  });

  it('drops invalid mutation keys without blocking a later flush', () => {
    const swr = loadFreshRuntime();
    const invalidKey = 'x'.repeat(SWR_CACHE_MAX_KEY_CHARS + 1);

    swr.set(invalidKey, 'poison');
    swr.remove(invalidKey);
    swr.removeByPrefix(invalidKey);
    swr.set('valid', 'persisted');
    swr.flushNow();

    const patches = fakeDiskGlobal.__swrPatches as Array<{
      removePrefixes: Array<{ at: number; prefix: string }>;
      removals: Array<readonly [string, number]>;
      updates: Array<readonly [string, string]>;
    }>;
    expect(patches).toHaveLength(1);
    expect(patches[0].removePrefixes).toEqual([]);
    expect(patches[0].removals).toEqual([]);
    expect(patches[0].updates.map(([key]) => key)).toEqual(['valid']);
    expect(readDiskStore().valid?.d).toBe('persisted');
    expect(mockSWRCacheCapacityLimit).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'keyLimit' }),
    );
  });
});
