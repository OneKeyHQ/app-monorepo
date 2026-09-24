import { PROMISE_CONCURRENCY_LIMIT } from '@onekeyhq/shared/src/utils/promiseUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import {
  buildHomeTokenListCacheIngestRound,
  loadHomeTokenListCache,
} from './buildHomeTokenListCacheIngestRound';

function makeToken(
  key: string,
  overrides: Partial<IAccountToken> = {},
): IAccountToken {
  return {
    $key: key,
    name: key,
    symbol: key,
    decimals: 18,
    address: `0x${key}`,
    isNative: false,
    ...overrides,
  } as IAccountToken;
}

function makeFiat(
  fiatValue: string,
  overrides: Partial<ITokenFiat> = {},
): ITokenFiat {
  return {
    balance: '1',
    balanceParsed: '1',
    fiatValue,
    price: 1,
    ...overrides,
  };
}

describe('buildHomeTokenListCacheIngestRound', () => {
  it('builds a single-network cache ingest payload with visible and risky maps split', () => {
    const token = makeToken('native');
    const small = makeToken('dust');
    const risky = makeToken('risk');

    const payload = buildHomeTokenListCacheIngestRound({
      ownerKey: 'acc__evm--1',
      accountId: 'acc',
      networkId: 'evm--1',
      tokenList: [token],
      smallBalanceTokenList: [small],
      riskyTokenList: [risky],
      tokenListMap: {
        native: makeFiat('10'),
      },
      smallBalanceTokenListMap: {
        dust: makeFiat('0.25'),
      },
      riskyTokenListMap: {
        risk: makeFiat('999'),
      },
      source: 'singleCacheSeed',
    });

    expect(payload.ownerKey).toBe('acc__evm--1');
    expect(payload.orderedTokens).toEqual([token]);
    expect(payload.smallBalanceTokens).toEqual([small]);
    expect(payload.riskyTokens).toEqual([risky]);
    expect(payload.tokenListMap).toEqual({
      native: makeFiat('10'),
      dust: makeFiat('0.25'),
    });
    expect(payload.riskyMap).toEqual({
      risk: makeFiat('999'),
    });
    expect(payload.smallBalanceFiatValue).toBe('0.25');
    expect(payload.rawKeys).toBe('native_dust_risk');
    expect(payload.source).toBe('singleCacheSeed');
  });

  it('builds an empty owner-stamp payload for cached empty lists', () => {
    const payload = buildHomeTokenListCacheIngestRound({
      ownerKey: 'acc__btc--0',
      accountId: 'acc',
      networkId: 'btc--0',
      tokenList: [],
      smallBalanceTokenList: [],
      riskyTokenList: [],
      tokenListMap: {},
      source: 'singleEmptyCacheSeed',
    });

    expect(payload.ownerKey).toBe('acc__btc--0');
    expect(payload.orderedTokens).toEqual([]);
    expect(payload.smallBalanceTokens).toEqual([]);
    expect(payload.riskyTokens).toEqual([]);
    expect(payload.tokenListMap).toEqual({});
    expect(payload.riskyMap).toEqual({});
    expect(payload.smallBalanceFiatValue).toBe('0');
    expect(payload.rawKeys).toBe('__');
    expect(payload.source).toBe('singleEmptyCacheSeed');
  });
});

const mockLocalTokens = jest.fn<Promise<unknown>, unknown[]>();
const mockAllNetworkAccounts = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('../../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceToken: {
      getAccountLocalTokens: (...args: unknown[]) => mockLocalTokens(...args),
    },
    serviceAllNetwork: {
      getAllNetworkAccounts: (...args: unknown[]) =>
        mockAllNetworkAccounts(...args),
    },
    simpleDb: { aggregateToken: { getRawData: async () => ({}) } },
  },
}));

const target = {
  account: { id: 'hd-test--m/44', createAtNetwork: 'evm--1' },
  wallet: { id: 'hd-test' },
  network: { id: 'evm--1', isAllNetworks: false },
  deriveInfoItems: [],
} as unknown as Parameters<typeof loadHomeTokenListCache>[0];
const emptyCache = {
  hasCache: true,
  tokenList: [],
  smallBalanceTokenList: [],
  riskyTokenList: [],
  tokenListMap: {},
  tokenListValue: '0',
  currency: 'usd',
};

describe('target account cache preparation', () => {
  beforeEach(() => {
    mockLocalTokens.mockReset();
    mockAllNetworkAccounts.mockReset();
  });

  it('does not manufacture an empty snapshot on a cache miss', async () => {
    mockLocalTokens.mockResolvedValue({ ...emptyCache, hasCache: false });
    expect(await loadHomeTokenListCache(target, 'target')).toBeUndefined();
    expect(mockLocalTokens).toHaveBeenCalledWith({
      accountId: target.account?.id,
      networkId: 'evm--1',
    });
  });

  it('preserves a cached empty account as a complete target snapshot', async () => {
    mockLocalTokens.mockResolvedValue(emptyCache);
    const result = await loadHomeTokenListCache(target, 'target');
    expect(result?.complete).toBe(true);
    expect(result?.ingest).toMatchObject({
      ownerKey: 'target',
      orderedTokens: [],
      smallBalanceTokens: [],
    });
  });

  it('loads funded tokens for the requested owner', async () => {
    mockLocalTokens.mockResolvedValue({
      ...emptyCache,
      tokenList: [makeToken('native')],
      tokenListMap: { native: makeFiat('10') },
      tokenListValue: '10',
    });
    const result = await loadHomeTokenListCache(target, 'target');
    expect(result?.complete).toBe(true);
    expect(result?.ingest.orderedTokens.map((token) => token.$key)).toEqual([
      'native',
    ]);
    expect(Object.values(result?.worth ?? {})).toEqual(['10']);
  });

  it('bounds cache reads and stops queued reads after cancellation', async () => {
    const controller = new AbortController();
    const resolvers: (() => void)[] = [];
    mockAllNetworkAccounts.mockResolvedValue({
      accountsInfo: Array.from(
        { length: PROMISE_CONCURRENCY_LIMIT + 2 },
        (_, i) => ({
          accountId: `account-${i}`,
          networkId: `evm--${i}`,
        }),
      ),
    });
    mockLocalTokens.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(() => resolve(emptyCache));
        }),
    );
    const pending = loadHomeTokenListCache(
      {
        ...target,
        network: { ...target.network, isAllNetworks: true } as NonNullable<
          typeof target.network
        >,
      },
      'target-all',
      controller.signal,
    );
    // Let the local module imports and account lookup complete.
    for (let i = 0; i < 20 && resolvers.length === 0; i += 1)
      await Promise.resolve();
    expect(mockLocalTokens).toHaveBeenCalledTimes(PROMISE_CONCURRENCY_LIMIT);
    controller.abort();
    resolvers.forEach((resolve) => resolve());
    expect(await pending).toBeUndefined();
    expect(mockLocalTokens).toHaveBeenCalledTimes(PROMISE_CONCURRENCY_LIMIT);
  });

  it('does not start cache reads for an already cancelled selection', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(
      await loadHomeTokenListCache(target, 'target', controller.signal),
    ).toBeUndefined();
    expect(mockLocalTokens).not.toHaveBeenCalled();
    expect(mockAllNetworkAccounts).not.toHaveBeenCalled();
  });

  it.each(['missing', 'failed', 'complete'] as const)(
    'All Networks %s cache coverage',
    async (coverage) => {
      mockAllNetworkAccounts.mockResolvedValue({
        accountsInfo: [
          { accountId: 'eth-account', networkId: 'evm--1' },
          { accountId: 'bnb-account', networkId: 'evm--56' },
        ],
      });
      mockLocalTokens.mockResolvedValueOnce(emptyCache);
      if (coverage === 'failed')
        mockLocalTokens.mockRejectedValueOnce(new Error('cache unavailable'));
      else
        mockLocalTokens.mockResolvedValueOnce({
          ...emptyCache,
          hasCache: coverage === 'complete',
        });
      const result = await loadHomeTokenListCache(
        {
          ...target,
          network: {
            ...target.network,
            id: 'all--0',
            isAllNetworks: true,
          } as NonNullable<typeof target.network>,
        },
        'target-all',
      );
      expect(result?.complete).toBe(coverage === 'complete');
      expect(result?.ingest.ownerKey).toBe('target-all');
      expect(result?.ingest.orderedTokens).toEqual([]);
    },
  );
});
