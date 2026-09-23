import { SWR_ACCOUNT_SELECTOR_MAX_SERIALIZED_CHARS } from './swrCacheLimits';
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
const mockSWRCacheSlowOp = jest.fn();

jest.mock('../logger/logger', () => ({
  defaultLogger: {
    app: {
      perf: {
        swrCacheCapacityLimit: (params: unknown) => {
          mockSWRCacheCapacityLimit(params);
        },
        swrCacheSlowOp: (params: unknown) => {
          mockSWRCacheSlowOp(params);
        },
      },
    },
  },
}));

/**
 * The persisted half of the cache.
 *
 * Records live one per key in the namespace its key names, and both runtimes
 * write them, so the fake store below is a plain per-key map on globalThis:
 * `jest.resetModules()` then stands for a second runtime opening the same
 * files.
 */
type IStoredEntry = { d: unknown; t: number };
const diskGlobal = globalThis as typeof globalThis & {
  __swrNamespaceDisk?: Map<string, IStoredEntry>;
  __swrNamespaceReadCount?: number;
};

function disk(): Map<string, IStoredEntry> {
  diskGlobal.__swrNamespaceDisk ??= new Map<string, IStoredEntry>();
  return diskGlobal.__swrNamespaceDisk;
}

jest.mock('./swrCacheNamespaceStorage', () => {
  const store = () => {
    const global = globalThis as {
      __swrNamespaceDisk?: Map<string, { d: unknown; t: number }>;
    };
    global.__swrNamespaceDisk ??= new Map();
    return global.__swrNamespaceDisk;
  };
  const prefixOfKey = (key: string) => {
    const separator = key.indexOf(':');
    return separator === -1 ? key : key.slice(0, separator);
  };
  /**
   * Which namespace a key belongs to, routed off the real registry: a leading
   * segment it declares names the namespace, and anything else lands in the
   * fallback one. That is what puts `defiEnabled:<networkId>` somewhere no
   * `swrKeys` entry mentions.
   */
  const namespaceOfKey = (key: string) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { swrCacheNamespaces } =
      require('./swrCacheNamespaceNames') as typeof import('./swrCacheNamespaceNames');
    const prefix = prefixOfKey(key);
    return Object.values<string>(swrCacheNamespaces).includes(prefix)
      ? prefix
      : '<fallback>';
  };
  return {
    swrKeyPrefix: prefixOfKey,
    readSwrCacheEntry: (key: string) => {
      const global = globalThis as { __swrNamespaceReadCount?: number };
      global.__swrNamespaceReadCount =
        (global.__swrNamespaceReadCount ?? 0) + 1;
      return store().get(key);
    },
    writeSwrCacheEntries: (
      entries: Array<readonly [string, { d: unknown; t: number }]>,
    ) => entries.forEach(([key, entry]) => store().set(key, entry)),
    removeSwrCacheEntries: (keys: string[]) =>
      keys.forEach((key) => store().delete(key)),
    removeSwrCacheByPrefix: (prefix: string) =>
      [...store().keys()]
        .filter((key) => key.startsWith(prefix))
        .forEach((key) => store().delete(key)),
    clearAllSwrCacheNamespaces: (options?: {
      exceptSwrPrefixes?: readonly string[];
    }) => {
      const kept = new Set<string>(options?.exceptSwrPrefixes ?? []);
      [...store().keys()]
        .filter((key) => !kept.has(namespaceOfKey(key)))
        .forEach((key) => store().delete(key));
    },
  };
});

function loadFreshRuntime() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('./swrCacheUtils') as typeof import('./swrCacheUtils'))
    .swrCacheUtils;
}

function resetDisk() {
  diskGlobal.__swrNamespaceDisk = new Map<string, IStoredEntry>();
  diskGlobal.__swrNamespaceReadCount = 0;
}

/** The persisted records, as a plain object for assertions. */
function readDiskStore(): Record<string, IStoredEntry> {
  return Object.fromEntries(disk().entries());
}

/** What the other runtime committing its own records looks like from here. */
function otherRuntimeFlush(entries: Record<string, IStoredEntry>) {
  Object.entries(entries).forEach(([key, entry]) => disk().set(key, entry));
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
    ).toBe('swapStockPayTokenDetails:v2:1:usdc|usdt:idx:acc');
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

describe('SWR cache persistence', () => {
  beforeEach(() => {
    resetDisk();
    mockSWRCacheSlowOp.mockClear();
    mockSWRCacheCapacityLimit.mockClear();
  });

  it('reads a key it has never seen from the namespace that holds it', () => {
    disk().set('marketTokenDetail:a', { d: 'from-disk', t: 1000 });
    const cache = loadFreshRuntime();

    expect(cache.get('marketTokenDetail:a')).toBe('from-disk');
    // Nothing was loaded before the key was asked for.
    expect(diskGlobal.__swrNamespaceReadCount).toBe(1);
  });

  it('keeps what it read, instead of going back for every read', () => {
    disk().set('marketTokenDetail:a', { d: 'from-disk', t: 1000 });
    const cache = loadFreshRuntime();

    cache.get('marketTokenDetail:a');
    cache.get('marketTokenDetail:a');

    expect(diskGlobal.__swrNamespaceReadCount).toBe(1);
  });

  it('does not rewrite a value it only read', () => {
    disk().set('marketTokenDetail:a', { d: 'from-disk', t: 1000 });
    const cache = loadFreshRuntime();

    cache.get('marketTokenDetail:a');
    cache.flushNow();

    expect(disk().get('marketTokenDetail:a')).toEqual({
      d: 'from-disk',
      t: 1000,
    });
  });

  it('writes what changed, and leaves other namespaces alone', () => {
    disk().set('walletList:other', { d: 'untouched', t: 1 });
    const cache = loadFreshRuntime();

    cache.set('marketTokenDetail:a', 'mine');
    cache.flushNow();

    expect(disk().get('marketTokenDetail:a')).toMatchObject({ d: 'mine' });
    expect(disk().get('walletList:other')).toEqual({ d: 'untouched', t: 1 });
  });

  it('does not read back a key it removed before the flush landed', () => {
    disk().set('marketTokenDetail:a', { d: 'from-disk', t: 1000 });
    const cache = loadFreshRuntime();

    cache.remove('marketTokenDetail:a');

    expect(cache.get('marketTokenDetail:a')).toBeUndefined();
    cache.flushNow();
    expect(disk().has('marketTokenDetail:a')).toBe(false);
  });

  it('does not read back a key under a prefix it dropped', () => {
    disk().set('walletList:a', { d: 'from-disk', t: 1000 });
    const cache = loadFreshRuntime();

    cache.removeByPrefix('walletList:');

    expect(cache.get('walletList:a')).toBeUndefined();
    cache.flushNow();
    expect(disk().has('walletList:a')).toBe(false);
  });

  it('clears every namespace, then persists what was written after', () => {
    disk().set('walletList:a', { d: 'old', t: 1000 });
    disk().set('marketTokenDetail:b', { d: 'old', t: 1000 });
    const cache = loadFreshRuntime();

    cache.clearAll();
    cache.set('marketTokenDetail:b', 'written-after');
    cache.flushNow();

    expect(disk().has('walletList:a')).toBe(false);
    expect(disk().get('marketTokenDetail:b')).toMatchObject({
      d: 'written-after',
    });
  });

  it("picks up the other runtime's write after a reload", () => {
    disk().set('perpsL2Book:a', { d: 'first', t: 1000 });
    const cache = loadFreshRuntime();
    expect(cache.get('perpsL2Book:a')).toBe('first');

    // The other runtime commits its own record.
    disk().set('perpsL2Book:a', { d: 'theirs', t: 2000 });
    expect(cache.get('perpsL2Book:a')).toBe('first');

    cache.reloadFromStorage();

    expect(cache.get('perpsL2Book:a')).toBe('theirs');
  });

  it('keeps a pending write across a reload', () => {
    const cache = loadFreshRuntime();
    cache.set('perpsL2Book:a', 'mine');
    disk().set('perpsL2Book:a', { d: 'theirs', t: 1 });

    cache.reloadFromStorage();

    // The reload flushes first, so the newer local write is what survives.
    expect(cache.get('perpsL2Book:a')).toBe('mine');
    expect(disk().get('perpsL2Book:a')).toMatchObject({ d: 'mine' });
  });

  it('lets an unchanged result ride along instead of starting a flush', () => {
    jest.useFakeTimers();
    try {
      const cache = loadFreshRuntime();
      cache.set('marketTokenDetail:a', { value: 1 });
      cache.flushNow();
      const firstWrite = disk().get('marketTokenDetail:a')?.t as number;

      jest.advanceTimersByTime(5000);
      cache.set('marketTokenDetail:a', { value: 1 });
      jest.advanceTimersByTime(5000);

      // No flush was scheduled, so the record still carries the first write.
      expect(disk().get('marketTokenDetail:a')?.t).toBe(firstWrite);

      cache.set('marketTokenDetail:b', { value: 2 });
      jest.advanceTimersByTime(5000);

      // The next flush carries the refreshed timestamp with it.
      expect(disk().get('marketTokenDetail:a')?.t).toBeGreaterThan(firstWrite);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports a slow flush with the size of what it wrote', () => {
    const cache = loadFreshRuntime();
    let elapsed = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => {
      elapsed += 100;
      return elapsed;
    });
    try {
      cache.set('marketTokenDetail:a', 'value');
      cache.flushNow();
    } finally {
      jest.restoreAllMocks();
    }

    expect(mockSWRCacheSlowOp).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'flush', updatedKeyCount: 1 }),
    );
  });
});

describe('SWR cache budgets and reload throttling', () => {
  let nowSpy: jest.SpyInstance<number, []>;

  const setNow = (ms: number) => nowSpy.mockReturnValue(ms);

  beforeEach(() => {
    resetDisk();
    mockSWRCacheSlowOp.mockClear();
    mockSWRCacheCapacityLimit.mockReset();
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
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

  it('enforces the account serialized budget on writes and persistence pruning', () => {
    const swr = loadFreshRuntime();
    const value = 'x'.repeat(SWR_ACCOUNT_SELECTOR_MAX_SERIALIZED_CHARS / 2);
    swr.set('unrelated', 'keep');
    swr.set('accSelList:v1:first', value);
    setNow(2000);
    swr.set('accSelList:v1:second', value);
    expect(swr.get('accSelList:v1:first')).toBeUndefined();
    expect(swr.get('accSelList:v1:second')).toBe(value);
    swr.flushNow();
    const result = pruneSWRCacheStore({
      'accSelList:v1:first': { d: value, t: 1 },
      'accSelList:v1:second': { d: value, t: 2 },
      unrelated: { d: 'keep', t: 0 },
    });
    expect(Object.keys(result.store)).toEqual([
      'accSelList:v1:second',
      'unrelated',
    ]);
    expect(readDiskStore().unrelated.d).toBe('keep');
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
    expect(diskGlobal.__swrNamespaceReadCount).toBe(1);

    // Stale enough to reload: the copy held here is dropped and read again.
    setNow(40_000);
    expect(getSnapshot(swr)?.data).toEqual(staleBook);
    expect(diskGlobal.__swrNamespaceReadCount).toBe(2);

    // Inside the throttle window nothing is dropped, so nothing is re-read.
    setNow(40_001);
    expect(getSnapshot(swr)?.data).toEqual(staleBook);
    expect(diskGlobal.__swrNamespaceReadCount).toBe(2);

    // An explicit reload is never throttled; the next read goes to disk.
    swr.reloadFromStorage();
    expect(swr.get(key)).toEqual(staleBook);
    expect(diskGlobal.__swrNamespaceReadCount).toBe(3);
  });
});

describe('SWR cache removals', () => {
  beforeEach(() => {
    resetDisk();
  });

  it('announces nothing: the UI runtime drops its own entries', () => {
    const cache = loadFreshRuntime();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { appEventBus } =
      require('../eventBus/appEventBus') as typeof import('../eventBus/appEventBus');
    const emit = jest.spyOn(appEventBus, 'emit');
    try {
      cache.set('walletList:a', 'written');
      cache.remove('walletList:a');
      cache.removeByPrefix('accSelList:');
      cache.clearAll();
      cache.flushNow();

      // The mutation events the UI already receives are what trigger a drop,
      // so the cache itself has nothing to tell the other runtime.
      expect(emit).not.toHaveBeenCalled();
    } finally {
      emit.mockRestore();
    }
  });

  it('deletes from the store in the runtime that asked for it', () => {
    disk().set('walletList:a', { d: 'from-disk', t: 1000 });
    disk().set('accSelList:b', { d: 'from-disk', t: 1000 });
    const cache = loadFreshRuntime();
    expect(cache.get('walletList:a')).toBe('from-disk');

    cache.remove('walletList:a');
    cache.removeByPrefix('accSelList:');
    cache.flushNow();

    expect(readDiskStore()['walletList:a']).toBeUndefined();
    expect(readDiskStore()['accSelList:b']).toBeUndefined();
  });

  it('does not write a removed entry back to the store on the next flush', () => {
    const cache = loadFreshRuntime();
    cache.set('walletList:a', 'mine');
    cache.remove('walletList:a');
    cache.flushNow();

    expect(readDiskStore()['walletList:a']).toBeUndefined();
    expect(cache.get('walletList:a')).toBeUndefined();
  });

  it('wipes every namespace this runtime owns and spares the ones bg writes', () => {
    const cache = loadFreshRuntime();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BG_OWNED_SWR_NAMESPACES, prefixOf, swrCacheNamespaces } =
      require('./swrCacheNamespaceNames') as typeof import('./swrCacheNamespaceNames');
    const all = Object.values(swrCacheNamespaces);
    const bgOwned = new Set<string>(BG_OWNED_SWR_NAMESPACES);
    // Driven off the registry rather than a hand-picked few: a namespace added
    // later must not be able to survive the wipe unnoticed.
    all.forEach((namespace) =>
      disk().set(`${prefixOf(namespace)}seed`, { d: namespace, t: 1000 }),
    );

    cache.clearUiOwnedNamespaces();

    const left = new Set(Object.keys(readDiskStore()));
    // A reset re-uses wallet ids, so every namespace keyed by one has to go,
    // not only the wallet-shaped ones.
    expect(
      all.filter((ns) => !bgOwned.has(ns) && left.has(`${prefixOf(ns)}seed`)),
    ).toEqual([]);
    // Clearing a file bg is writing would put two writers on it.
    expect(
      all.filter((ns) => bgOwned.has(ns) && !left.has(`${prefixOf(ns)}seed`)),
    ).toEqual([]);
  });

  it('drops a namespace whose key carries no colon from memory as well', () => {
    const cache = loadFreshRuntime();
    // `swrKeys.swapHistoryPreviewList()` is the bare namespace: a
    // `<namespace>:` prefix match clears the store and leaves this runtime
    // still holding the entry, so the previous profile's Swap history keeps
    // rendering until something fetches it again.
    const bareKey = swrKeys.swapHistoryPreviewList();
    expect(bareKey).not.toContain(':');
    cache.set(bareKey, 'previous profile');

    cache.clearUiOwnedNamespaces();

    expect(cache.get(bareKey)).toBeUndefined();
    expect(readDiskStore()[bareKey]).toBeUndefined();
  });

  it('drops a key whose prefix names no declared namespace', () => {
    const cache = loadFreshRuntime();
    // A literal prefix, so the storage layer files it under the fallback
    // namespace and a wipe assembled from the registry misses it both on disk
    // and in memory.
    const fallbackKey = swrKeys.defiEnabled('evm--1');
    cache.set(fallbackKey, 'previous profile');

    cache.clearUiOwnedNamespaces();

    expect(cache.get(fallbackKey)).toBeUndefined();
    expect(readDiskStore()[fallbackKey]).toBeUndefined();
  });

  it('leaves a record bg wrote before the wipe readable afterwards', () => {
    disk().set('perpsL2Book:v1:ETH:5:1', { d: 'from-bg', t: 1000 });
    const cache = loadFreshRuntime();

    cache.clearUiOwnedNamespaces();

    // `clearAll` would mark everything older than itself deleted, and
    // `isDeletedLocally` would then suppress the read-through for bg's perps
    // records for the rest of the session. A removal per namespace does not.
    expect(cache.get('perpsL2Book:v1:ETH:5:1')).toBe('from-bg');
  });

  it('does not adopt a removed key back out of the store', () => {
    const cache = loadFreshRuntime();
    cache.remove('walletList:a');
    // An older record still on disk, e.g. written by a previous session.
    disk().set('walletList:a', { d: 'stale', t: 500 });

    expect(cache.get('walletList:a')).toBeUndefined();
  });
});
