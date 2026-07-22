import fs from 'fs';
import path from 'path';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createHomeMarketCategoryTokensCache } from '../../components/PopularTrading/utils';
import {
  getSelectedHomeMarketCategory,
  runHomeMarketStoreRequest,
} from '../sections/market/homeMarketControllerUtils';

import {
  type IHomeMarketSourceApi,
  loadHomeMarketPayload,
} from './HomeMarketStoreController';

import type { IHomeSectionSourceRequestHandle } from './useHomeStoreSourcePublisher';
import type { IHomePopularTradingPayload } from '../../components/PopularTrading/types';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));

const controllerSource = fs.readFileSync(
  path.join(__dirname, 'HomeMarketStoreController.tsx'),
  'utf8',
);
const rendererSource = fs.readFileSync(
  path.join(__dirname, '../../components/PopularTrading/PopularTrading.tsx'),
  'utf8',
);

const handle = {
  payload: {
    ownerToken: { scopeKey: 'owner-a', sessionId: 'session-a' },
    sectionId: 'market',
  },
  token: {
    protocolVersion: 1,
    clientInstanceId: 'client-a',
    producerInstanceId: 'producer-a',
    sessionId: 'session-a',
    requestSeq: 1,
    sourceKey: {
      scopeKey: 'owner-a',
      sourceId: 'market',
      paramsFingerprint: 'market-a',
      dataSchemaVersion: 1,
    },
  },
} satisfies IHomeSectionSourceRequestHandle;

const payload: IHomePopularTradingPayload = {
  earnRows: [],
  categories: [{ id: 'favorites', name: 'Favorites' }],
  favoriteMode: 'favorites',
  perpsHotRows: [],
  prefetchCategoryIds: [],
  prefetchedRowsByRequestKey: {},
  resolvedCategoryId: 'favorites',
  rows: [
    {
      chainId: 'evm--1',
      contractAddress: '0xabc',
      isNative: false,
      symbol: 'ABC',
      name: 'ABC',
      logoUrl: '',
      price: 1,
      priceChange24h: 2,
      marketCap: 3,
      volume24h: 4,
    },
  ],
  selectedCategoryId: 'favorites',
  totalFavorites: 1,
  watchListContentKey: 'watchlist-a',
  watchListItems: [],
};

describe('HomeMarketStoreController', () => {
  it('opens the Store request before the real source load and completes the same handle', async () => {
    const order: string[] = [];
    const completions: {
      handle: IHomeSectionSourceRequestHandle;
      kind: string;
    }[] = [];

    await runHomeMarketStoreRequest({
      gateway: {
        begin: () => {
          order.push('begin');
          return handle;
        },
        complete: (requestHandle, result) => {
          order.push('complete');
          completions.push({ handle: requestHandle, kind: result.kind });
        },
      },
      load: async () => {
        order.push('load');
        return payload;
      },
    });

    expect(order).toEqual(['begin', 'load', 'complete']);
    expect(completions).toEqual([{ handle, kind: 'ready' }]);
  });

  it('completes a failed source with the same pre-request handle', async () => {
    const completions: {
      handle: IHomeSectionSourceRequestHandle;
      kind: string;
    }[] = [];

    await expect(
      runHomeMarketStoreRequest({
        gateway: {
          begin: () => handle,
          complete: (requestHandle, result) => {
            completions.push({ handle: requestHandle, kind: result.kind });
          },
        },
        load: async () => {
          throw new OneKeyLocalError('market unavailable');
        },
      }),
    ).rejects.toThrow('market unavailable');
    expect(completions).toEqual([{ handle, kind: 'error' }]);
  });

  it('owns every active Market source and refresh trigger outside the renderer', () => {
    expect(controllerSource).toContain('beginHomeSectionRequest({');
    expect(controllerSource).toContain('completeHomeSectionRequest');
    expect(controllerSource).toContain('fetchMarketBasicConfig()');
    expect(controllerSource).toContain('getMarketWatchListV2()');
    expect(controllerSource).toContain('fetchMarketTokenListBatch({');
    expect(controllerSource).toContain('fetchMarketTokenList({');
    expect(controllerSource).toContain(
      'fetchMarketPerpsTokenList({ category })',
    );
    expect(controllerSource).toContain(
      'pollingInterval: HOME_MARKET_POLLING_INTERVAL',
    );
    expect(controllerSource).toContain('RefreshMarketWatchList');
    expect(rendererSource).not.toContain('backgroundApiProxy');
    expect(rendererSource).not.toContain('useHomeStoreSourcePublisher');
    expect(rendererSource).not.toContain('usePromiseResult');
  });

  it('publishes the Perps recommendation rows in the same Market Store payload', async () => {
    const fetchPerpsTokens = jest.fn(async () => ({
      tokens: [
        {
          name: 'BTC',
          displayName: 'BTC',
          tokenImageUrl: 'btc.png',
          markPrice: '100',
          change24hPercent: '2',
          volume24h: '1000',
          maxLeverage: 50,
        },
      ],
    }));
    const api = {
      fetchBasicConfig: async () => ({
        data: {
          homeTab: [{ type: 'watchlist', name: 'Favorites' }],
          minLiquidity: 5000,
          perpsCategories: [{ categoryId: 'hot', name: 'Hot' }],
          recommendTokens: [],
          spotCategories: [],
        },
      }),
      fetchEarnAssets: async () => ({ tokens: [] }),
      fetchPerpsTokens,
      fetchSpotCategoryTokens: jest.fn(async () => ({ list: [] })),
      fetchTokenAliases: jest.fn(async () => undefined),
      fetchTokenListBatch: jest.fn(async () => ({ list: [] })),
      getWatchList: jest.fn(async () => ({ data: [] })),
    } as unknown as IHomeMarketSourceApi;

    const result = await loadHomeMarketPayload({
      api,
      cache:
        createHomeMarketCategoryTokensCache<
          IHomePopularTradingPayload['rows'][number]
        >(),
      favoritesLabel: 'Favorites',
      perpsLabel: 'Perps',
      selectedCategoryId: 'favorites',
    });

    expect(fetchPerpsTokens).toHaveBeenCalledTimes(1);
    expect(fetchPerpsTokens).toHaveBeenCalledWith('hot');
    expect(result.perpsHotRows).toEqual([
      expect.objectContaining({
        perpsCoin: 'BTC',
        symbol: 'BTC',
        maxLeverage: 50,
      }),
    ]);
  });

  it('defaults invalid control values to Favorites', () => {
    expect(getSelectedHomeMarketCategory(undefined, 'favorites')).toBe(
      'favorites',
    );
    expect(getSelectedHomeMarketCategory(null, 'favorites')).toBe('favorites');
    expect(getSelectedHomeMarketCategory('trending', 'favorites')).toBe(
      'trending',
    );
  });
});
