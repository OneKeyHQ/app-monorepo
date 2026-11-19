import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import type {
  ISwapToken,
  ISwapTokenListSnapshotMap,
} from '@onekeyhq/shared/types/swap/types';

let data: typeof import('./tokenSelectorData');
let jotaiContextStore: (typeof import('../../utils/jotaiContextStore'))['jotaiContextStore'];
let writeContextAtomColdStartCacheValues: (typeof import('@onekeyhq/kit-bg/src/states/jotai/utils'))['writeContextAtomColdStartCacheValues'];

let mockSnapshotRaw: string | undefined;
let mockEpoch = { refresh: 0, identity: 0 };
const mockWrite = jest.fn((value: string) => {
  mockSnapshotRaw = value;
});
const mockFlush = jest.fn(async () => undefined);
const sharedJotai = jest.requireActual<typeof import('jotai')>('jotai');
const sharedJotaiVanilla =
  jest.requireActual<typeof import('jotai/vanilla')>('jotai/vanilla');

jest.mock('@onekeyhq/shared/src/storage/uiSnapshotCaches', () => ({
  readContextAtomSnapshotRaw: () => mockSnapshotRaw,
  writeContextAtomSnapshotRaw: (value: string) => mockWrite(value),
}));
jest.mock(
  '@onekeyhq/shared/src/storage/DisplaySnapshotStorage/webUiSnapshotStore',
  () => ({
    flushUiSnapshotStoreNow: () => mockFlush(),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Swap/utils/swapTokenSelectorCacheUtils',
  () => ({
    getSwapTokenSelectorCacheEpoch: () => mockEpoch,
  }),
);

// Kept independent of the production migration list, so omitting an owner is visible.
const legacyStores = [
  EJotaiContextStoreNames.swap,
  EJotaiContextStoreNames.swapModal,
  EJotaiContextStoreNames.marketSwap,
  EJotaiContextStoreNames.marketSwapReview,
] as const;
const canonicalScope = `store:${EJotaiContextStoreNames.swapTokenSelector}`;
const tokenCacheKey = CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom;
const holdingsCacheKey =
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapAllNetworkTokenListMapAtom;
const scopedKey = (scope: string, key: string) => `${scope}::${key}`;
const globalCache = globalThis as typeof globalThis & {
  __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
};
const eth: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  balanceParsed: '1',
  fiatValue: '100',
};
const queryKey = JSON.stringify({
  networkId: 'evm--1',
  accountId: 'watching--60--test',
  accountAddress: 'test-owner',
  keywords: '',
});
const holdingsKey = 'hd-test--0__Swap__usd';

function tokenSnapshot(
  updatedAt: number,
  tokens: ISwapToken[] = [eth],
  key = queryKey,
): ISwapTokenListSnapshotMap {
  return {
    version: 1,
    updatedAt,
    tokenCatch: {
      [key]: {
        data: tokens,
        updatedAt,
        identityVersion: 99,
        refreshVersion: 99,
      },
    },
  };
}

function seed(
  snapshot: Record<string, unknown>,
  boot: Record<string, unknown> = snapshot,
) {
  mockSnapshotRaw = JSON.stringify(snapshot);
  globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = { ...boot };
}

function readPersisted(): Record<string, unknown> {
  return JSON.parse(mockSnapshotRaw ?? '{}') as Record<string, unknown>;
}

function expectLegacyRetired() {
  for (const storeName of legacyStores) {
    for (const key of [tokenCacheKey, holdingsCacheKey]) {
      const oldKey = scopedKey(`store:${storeName}`, key);
      expect(Object.hasOwn(readPersisted(), oldKey)).toBe(false);
      expect(
        globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__?.[oldKey],
      ).toBeUndefined();
    }
  }
}

describe('shared selector data owner', () => {
  afterAll(() => {
    jest.dontMock('jotai');
    jest.dontMock('jotai/vanilla');
  });

  beforeEach(() => {
    jest.useFakeTimers();
    mockEpoch = { refresh: 0, identity: 0 };
    mockWrite.mockClear();
    mockFlush.mockClear();
    mockSnapshotRaw = undefined;
    delete globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__;
    // A real process has fresh runtime authority maps. Clearing only disk
    // between cases would leave the previous case's canonical tombstone alive.
    // Isolate app-owned state while retaining one external Jotai runtime.
    jest.doMock('jotai', () => sharedJotai);
    jest.doMock('jotai/vanilla', () => sharedJotaiVanilla);
    jest.isolateModules(() => {
      const env = jest.requireActual<
        typeof import('@onekeyhq/shared/src/platformEnv')
      >('@onekeyhq/shared/src/platformEnv').default;
      env.isDesktop = true;
      env.isWeb = false;
      env.isNative = false;
      env.isExtension = false;
      data = jest.requireActual<typeof import('./tokenSelectorData')>(
        './tokenSelectorData',
      );
      ({ jotaiContextStore } = jest.requireActual<
        typeof import('../../utils/jotaiContextStore')
      >('../../utils/jotaiContextStore'));
      ({ writeContextAtomColdStartCacheValues } = jest.requireActual<
        typeof import('@onekeyhq/kit-bg/src/states/jotai/utils')
      >('@onekeyhq/kit-bg/src/states/jotai/utils'));
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    delete globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__;
    jest.restoreAllMocks();
  });

  it('migrates the latest complete query from every legacy scope and retires old slots in the same write', () => {
    const old: Record<string, unknown> = { unrelated: { keep: true } };
    const times = [10, 40, 20, 30];
    for (const [index, storeName] of legacyStores.entries()) {
      const query = tokenSnapshot(times[index], [
        { ...eth, balanceParsed: String(times[index]) },
      ]);
      query.tokenCatch = {
        ...query.tokenCatch,
        [JSON.stringify({ networkId: 'evm--1', keywords: 'search' })]: {
          data: [eth],
          updatedAt: 100,
        },
        [JSON.stringify({ networkId: 'evm--1', onlyAccountTokens: true })]: {
          data: [eth],
          updatedAt: 100,
        },
      };
      old[scopedKey(`store:${storeName}`, tokenCacheKey)] = query;
      old[scopedKey(`store:${storeName}`, holdingsCacheKey)] = {
        [holdingsKey]: [{ ...eth, balanceParsed: String(times[index]) }],
      };
    }
    seed(old, { unrelated: { keep: true } });

    const store = data.getSwapTokenSelectorStore();
    expect(store.get(data.swapTokenMapAtom()).tokenCatch).toEqual({
      [queryKey]: {
        data: [{ ...eth, balanceParsed: '40' }],
        updatedAt: 40,
        identityVersion: 0,
        persisted: true,
      },
    });
    // Legacy projections have no timestamps: take one owner from Swap,
    // rather than mixing multiple providers' rows for that owner.
    expect(
      store.get(data.swapAllNetworkTokenListMapAtom())[holdingsKey],
    ).toEqual([{ ...eth, balanceParsed: '10' }]);
    expect(store.get(data.swapTokenListRequestsAtom())).toEqual({});
    expect(store.get(data.swapAllNetworkActionLockAtom())).toEqual({});
    expect(store.get(data.swapAllNetworkTokenListStatusAtom())).toEqual({});
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expectLegacyRetired();
    expect(readPersisted().unrelated).toEqual({ keep: true });
    expect(readPersisted()[scopedKey(canonicalScope, tokenCacheKey)]).toEqual(
      store.get(data.swapTokenMapAtom()),
    );
  });

  it.each([false, true])(
    'prefers an existing canonical snapshot over newer legacy values (empty=%s)',
    (empty) => {
      const canonical = empty
        ? { version: 1, updatedAt: 0, tokenCatch: {} }
        : tokenSnapshot(1);
      seed({
        [scopedKey(canonicalScope, tokenCacheKey)]: canonical,
        [scopedKey(canonicalScope, holdingsCacheKey)]: {},
        [scopedKey('store:marketSwap', tokenCacheKey)]: tokenSnapshot(100, [
          { ...eth, balanceParsed: '100' },
        ]),
        [scopedKey('store:marketSwap', holdingsCacheKey)]: {
          [holdingsKey]: [eth],
        },
      });
      const store = data.getSwapTokenSelectorStore();
      expect(
        Object.keys(store.get(data.swapTokenMapAtom()).tokenCatch ?? {}),
      ).toHaveLength(empty ? 0 : 1);
      if (!empty)
        expect(
          store.get(data.swapTokenMapAtom()).tokenCatch?.[queryKey].updatedAt,
        ).toBe(1);
      expect(store.get(data.swapAllNetworkTokenListMapAtom())).toEqual({});
      expectLegacyRetired();
    },
  );

  it('respects an explicit canonical boot clear instead of replaying legacy data', () => {
    seed(
      {
        [scopedKey(canonicalScope, tokenCacheKey)]: tokenSnapshot(1),
        [scopedKey('store:swap', tokenCacheKey)]: tokenSnapshot(100),
      },
      { [scopedKey(canonicalScope, tokenCacheKey)]: undefined },
    );
    const store = data.getSwapTokenSelectorStore();
    expect(
      Object.keys(store.get(data.swapTokenMapAtom()).tokenCatch ?? {}),
    ).toHaveLength(0);
    expectLegacyRetired();
  });

  it('respects a runtime canonical clear when the boot snapshot has no canonical key', async () => {
    seed(
      {
        [scopedKey(canonicalScope, tokenCacheKey)]: tokenSnapshot(1),
        [scopedKey('store:marketSwap', tokenCacheKey)]: tokenSnapshot(100),
      },
      { unrelated: { keep: true } },
    );
    await writeContextAtomColdStartCacheValues({
      entries: [
        {
          coldStartScopeKey: canonicalScope,
          coldStartCacheKey: tokenCacheKey,
          value: undefined,
        },
      ],
    });
    const store = data.getSwapTokenSelectorStore();
    expect(
      Object.keys(store.get(data.swapTokenMapAtom()).tokenCatch ?? {}),
    ).toHaveLength(0);
    expectLegacyRetired();
  });

  it('restores canonical disk data when the boot snapshot only has unrelated scopes', () => {
    seed(
      {
        [scopedKey(canonicalScope, tokenCacheKey)]: tokenSnapshot(1),
        [scopedKey('store:marketSwap', tokenCacheKey)]: tokenSnapshot(100),
      },
      { unrelated: { keep: true } },
    );
    const store = data.getSwapTokenSelectorStore();
    expect(
      store.get(data.swapTokenMapAtom()).tokenCatch?.[queryKey].updatedAt,
    ).toBe(1);
    expectLegacyRetired();
  });

  it('migrates a pending legacy value and prevents its debounce or a later RMW from reviving old scopes', async () => {
    seed({
      unrelated: { keep: true },
      [scopedKey('store:marketSwap', tokenCacheKey)]: tokenSnapshot(1),
    });
    await writeContextAtomColdStartCacheValues({
      entries: [
        {
          coldStartScopeKey: 'store:marketSwap',
          coldStartCacheKey: tokenCacheKey,
          value: tokenSnapshot(50),
        },
      ],
    });
    const store = data.getSwapTokenSelectorStore();
    expect(
      store.get(data.swapTokenMapAtom()).tokenCatch?.[queryKey].updatedAt,
    ).toBe(50);
    jest.advanceTimersByTime(3000);
    await writeContextAtomColdStartCacheValues({
      entries: [
        {
          coldStartScopeKey: 'store:unrelated',
          coldStartCacheKey:
            CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTipsStateAtom,
          value: { keep: true },
        },
      ],
      flushImmediately: true,
    });
    expectLegacyRetired();
    expect(readPersisted()[scopedKey(canonicalScope, tokenCacheKey)]).toEqual(
      store.get(data.swapTokenMapAtom()),
    );
    expect(readPersisted().unrelated).toEqual({ keep: true });
  });

  it.each([1, 4])(
    'does not hydrate any old authority after removal or derivation (identity=%s)',
    (identity) => {
      seed({
        [scopedKey(canonicalScope, tokenCacheKey)]: tokenSnapshot(100),
        [scopedKey(canonicalScope, holdingsCacheKey)]: { [holdingsKey]: [eth] },
        [scopedKey('store:marketSwap', tokenCacheKey)]: tokenSnapshot(200),
        [scopedKey('store:swapModal', holdingsCacheKey)]: {
          [holdingsKey]: [eth],
        },
      });
      mockEpoch = { refresh: 0, identity };
      const store = data.getSwapTokenSelectorStore();
      expect(
        Object.keys(store.get(data.swapTokenMapAtom()).tokenCatch ?? {}),
      ).toHaveLength(0);
      expect(store.get(data.swapAllNetworkTokenListMapAtom())).toEqual({});
      expectLegacyRetired();
    },
  );

  it('keeps one initialized owner and does not re-read changed legacy data on later entry mounts', () => {
    seed({ [scopedKey('store:swapModal', tokenCacheKey)]: tokenSnapshot(10) });
    const store = data.getSwapTokenSelectorStore();
    const writes = mockWrite.mock.calls.length;
    seed({
      [scopedKey('store:marketSwap', tokenCacheKey)]: tokenSnapshot(100),
    });
    for (const _entry of legacyStores)
      expect(data.getSwapTokenSelectorStore()).toBe(store);
    expect(
      store.get(data.swapTokenMapAtom()).tokenCatch?.[queryKey].updatedAt,
    ).toBe(10);
    expect(mockWrite).toHaveBeenCalledTimes(writes);
  });

  it('persists background data updates only under the shared scope without a mounted selector', () => {
    seed({ unrelated: { keep: true } });
    const store = data.getSwapTokenSelectorStore();
    store.set(data.swapTokenMapAtom(), tokenSnapshot(20));
    store.set(data.swapAllNetworkTokenListMapAtom(), { [holdingsKey]: [eth] });
    jest.advanceTimersByTime(3000);
    expect(
      readPersisted()[scopedKey(canonicalScope, tokenCacheKey)],
    ).toMatchObject({
      updatedAt: 20,
      tokenCatch: { [queryKey]: { persisted: true } },
    });
    expect(
      readPersisted()[scopedKey(canonicalScope, holdingsCacheKey)],
    ).toEqual({ [holdingsKey]: [eth] });
    expectLegacyRetired();
  });
});
