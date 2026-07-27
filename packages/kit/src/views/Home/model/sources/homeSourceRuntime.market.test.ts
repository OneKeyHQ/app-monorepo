import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { HomeSourceRuntime } from './homeSourceRuntime';

import type { IHomePopularTradingPayload } from '../../components/PopularTrading/types';
import type { IHomeStoreState } from '../store/homeStoreTypes';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAllNetwork: {
      clearGetAllNetworkAccountsCache: jest.fn(),
      getAllNetworkAccounts: jest.fn(),
    },
    serviceHyperliquid: {
      getTokenSearchAliases: jest.fn(),
    },
    serviceMarketV2: {
      fetchMarketBasicConfig: jest.fn(),
      fetchMarketPerpsTokenList: jest.fn(),
      fetchMarketTokenList: jest.fn(),
      getMarketWatchListV2: jest.fn(),
    },
  },
}));

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createRuntime(state: IHomeStoreState) {
  return new HomeSourceRuntime({
    identity: {
      runtimeInstanceId: 'runtime-a',
      clientInstanceId: 'client-a',
    },
    scheduler: {} as never,
    commitBudget: {} as never,
    leafPool: {
      cancelSession: jest.fn(),
      dispose: jest.fn(),
      getSnapshot: jest.fn(),
      run: (
        _priority: string,
        request: () => Promise<unknown>,
        _sessionId?: string,
      ) => request(),
    } as never,
    dispatch: jest.fn(),
    dispatchAtomically: jest.fn(),
    getStateView: () => state,
  });
}

function getLoadMarket(runtime: HomeSourceRuntime) {
  return (
    runtime as unknown as {
      loadMarket(
        environment: {
          settings: { currencyInfo: { id: string } };
        },
        priority: 'interactive',
        sessionId: string,
        publishIntermediate: (input: {
          payload: unknown;
          rowIds: readonly string[];
        }) => void,
      ): Promise<{ payload: unknown; rowIds: readonly string[] }>;
    }
  ).loadMarket.bind(runtime);
}

function mockBaseMarketRequests() {
  /* eslint-disable @typescript-eslint/unbound-method */
  jest
    .mocked(backgroundApiProxy.serviceMarketV2.fetchMarketBasicConfig)
    .mockResolvedValue({
      data: {
        homeTab: [{ type: 'trending', name: 'Trending' }],
        minLiquidity: 5000,
      },
    } as never);
  jest
    .mocked(backgroundApiProxy.serviceMarketV2.getMarketWatchListV2)
    .mockResolvedValue({ data: [] } as never);
  jest
    .mocked(backgroundApiProxy.serviceMarketV2.fetchMarketTokenList)
    .mockResolvedValue({
      list: [
        {
          address: '0x1',
          isNative: false,
          logoUrl: 'eth.png',
          marketCap: '1000000',
          name: 'Ethereum',
          networkId: 'evm--1',
          price: '100',
          priceChange24hPercent: '1',
          symbol: 'ETH',
          volume24h: '1000',
        },
      ],
    } as never);
  jest
    .mocked(backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases)
    .mockResolvedValue({
      BTC: {
        aliases: ['Bitcoin'],
        subtitle: 'Bitcoin',
      },
    });
  /* eslint-enable @typescript-eslint/unbound-method */
}

describe('HomeSourceRuntime Market workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBaseMarketRequests();
  });

  it('publishes Spot progressively and completes with Perps Hot rows', async () => {
    const perpsResponse =
      createDeferred<
        Awaited<
          ReturnType<
            typeof backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList
          >
        >
      >();
    /* eslint-disable @typescript-eslint/unbound-method */
    const fetchMarketPerpsTokenList = jest.mocked(
      backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList,
    );
    fetchMarketPerpsTokenList.mockReturnValue(perpsResponse.promise);
    /* eslint-enable @typescript-eslint/unbound-method */
    const state = {
      interaction: { sectionControls: { market: {} } },
      resources: { market: { kind: 'loading' } },
    } as unknown as IHomeStoreState;
    const runtime = createRuntime(state);
    const publishIntermediate = jest.fn();

    const resultPromise = getLoadMarket(runtime)(
      { settings: { currencyInfo: { id: 'usd' } } },
      'interactive',
      'session-a',
      publishIntermediate,
    );
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    expect(publishIntermediate).toHaveBeenCalledTimes(1);
    expect(publishIntermediate).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          perpsHotRows: [],
          rows: [expect.objectContaining({ symbol: 'ETH' })],
        }),
        rowIds: ['spot:evm--1:0x1'],
      }),
    );

    perpsResponse.resolve({
      tokens: Array.from({ length: 7 }, (_, index) => ({
        change24hPercent: -12.17 + index,
        displayName: index === 0 ? 'BTC' : `TOKEN-${index}`,
        fundingRate: '0',
        markPrice: `${141.57 + index}`,
        maxLeverage: 10,
        name: index === 0 ? 'BTC' : `TOKEN-${index}`,
        openInterest: '100',
        prevDayPrice: '160',
        tokenImageUrl: 'skhy.png',
        volume24h: '251050000',
      })),
      updatedAt: 1,
    });
    const result = await resultPromise;
    const payload = result.payload as IHomePopularTradingPayload;

    expect(fetchMarketPerpsTokenList).toHaveBeenCalledWith({ category: 'hot' });
    expect(payload.perpsHotRows).toHaveLength(6);
    expect(payload.perpsHotRows[0]).toEqual(
      expect.objectContaining({
        maxLeverage: 10,
        perpsCoin: 'BTC',
        perpsSubtitle: 'Bitcoin',
        price: 141.57,
        symbol: 'BTC',
      }),
    );
    expect(result.rowIds).toEqual([
      'spot:evm--1:0x1',
      'perps:BTC',
      'perps:TOKEN-1',
      'perps:TOKEN-2',
      'perps:TOKEN-3',
      'perps:TOKEN-4',
      'perps:TOKEN-5',
    ]);
    runtime.dispose();
  });

  it('keeps current-owner Perps Hot rows when their refresh fails', async () => {
    const retainedPerpsRow = {
      chainId: '',
      contractAddress: '',
      isNative: false,
      logoUrl: 'btc.png',
      marketCap: 0,
      maxLeverage: 50,
      name: 'BTC',
      perpsCoin: 'BTC',
      price: 100_000,
      priceChange24h: 2,
      symbol: 'BTC',
      volume24h: 1_000_000,
    };
    const currentPayload = {
      categories: [],
      earnRows: [],
      favoriteMode: 'recommendation',
      perpsHotRows: [retainedPerpsRow],
      prefetchCategoryIds: [],
      prefetchedRowsByRequestKey: {},
      resolvedCategoryId: 'trending',
      rows: [],
      selectedCategoryId: 'trending',
      totalFavorites: 0,
      watchListContentKey: '',
      watchListItems: [],
    } satisfies IHomePopularTradingPayload;
    /* eslint-disable @typescript-eslint/unbound-method */
    jest
      .mocked(backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList)
      .mockRejectedValue(new Error('Perps market unavailable'));
    /* eslint-enable @typescript-eslint/unbound-method */
    const state = {
      interaction: { sectionControls: { market: {} } },
      resources: {
        market: {
          kind: 'ready',
          data: { payload: currentPayload },
        },
      },
    } as unknown as IHomeStoreState;
    const runtime = createRuntime(state);

    const result = await getLoadMarket(runtime)(
      { settings: { currencyInfo: { id: 'usd' } } },
      'interactive',
      'session-a',
      jest.fn(),
    );
    const payload = result.payload as IHomePopularTradingPayload;

    expect(payload.perpsHotRows).toEqual([retainedPerpsRow]);
    expect(result.rowIds).toContain('perps:BTC');
    runtime.dispose();
  });

  it('still completes with Perps Hot rows when Spot Market fails', async () => {
    /* eslint-disable @typescript-eslint/unbound-method */
    jest
      .mocked(backgroundApiProxy.serviceMarketV2.fetchMarketTokenList)
      .mockRejectedValue(new Error('Spot market unavailable'));
    jest
      .mocked(backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList)
      .mockResolvedValue({
        tokens: [
          {
            change24hPercent: 2,
            displayName: 'BTC',
            fundingRate: '0',
            markPrice: '100000',
            maxLeverage: 50,
            name: 'BTC',
            openInterest: '100',
            prevDayPrice: '98000',
            tokenImageUrl: 'btc.png',
            volume24h: '1000000',
          },
        ],
        updatedAt: 1,
      });
    /* eslint-enable @typescript-eslint/unbound-method */
    const state = {
      interaction: { sectionControls: { market: {} } },
      resources: { market: { kind: 'loading' } },
    } as unknown as IHomeStoreState;
    const runtime = createRuntime(state);

    const result = await getLoadMarket(runtime)(
      { settings: { currencyInfo: { id: 'usd' } } },
      'interactive',
      'session-a',
      jest.fn(),
    );
    const payload = result.payload as IHomePopularTradingPayload;

    expect(payload.rows).toEqual([]);
    expect(payload.perpsHotRows).toEqual([
      expect.objectContaining({ perpsCoin: 'BTC', price: 100_000 }),
    ]);
    expect(result.rowIds).toEqual(['perps:BTC']);
    runtime.dispose();
  });
});
