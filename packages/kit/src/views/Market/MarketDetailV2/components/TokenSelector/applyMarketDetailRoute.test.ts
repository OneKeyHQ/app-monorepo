import { rootNavigationRef } from '@onekeyhq/components';

import {
  applyExistingMarketDetailRoute,
  buildReplacedMarketDetailParams,
  findExistingMarketDetailRoute,
} from './applyMarketDetailRoute';

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    setParams: (params: unknown) => ({
      type: 'SET_PARAMS',
      payload: { params },
    }),
  },
  StackActions: {
    replace: (name: string, params: unknown) => ({
      type: 'REPLACE',
      payload: { name, params },
    }),
  },
}));

const dispatchMock = jest.fn<void, unknown[]>();
const getRootStateMock = jest.fn<unknown, []>();

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    current: {
      dispatch: (...args: unknown[]) => {
        dispatchMock(...args);
      },
      getRootState: (): unknown => getRootStateMock(),
    },
  },
}));

describe('applyMarketDetailRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRootStateMock.mockReturnValue(undefined);
    rootNavigationRef.current = {
      dispatch: dispatchMock,
      getRootState: getRootStateMock,
    } as unknown as typeof rootNavigationRef.current;
  });

  it('finds the deepest market detail route under overlays', () => {
    expect(
      findExistingMarketDetailRoute({
        key: 'root',
        routes: [
          {
            name: 'main',
            state: {
              key: 'discovery-stack',
              routes: [
                { key: 'home', name: 'TabDiscovery' },
                { key: 'detail-1', name: 'MarketDetailV2' },
              ],
            },
          },
          { key: 'modal', name: 'MobileTokenSelector' },
        ],
      }),
    ).toEqual({
      routeKey: 'detail-1',
      routeName: 'MarketDetailV2',
      navigatorKey: 'discovery-stack',
    });
  });

  it('clears stale identity params when replacing a detail route', () => {
    expect(
      buildReplacedMarketDetailParams({
        tokenAddress: '0xabc',
        network: 'eth',
        isNative: false,
      }),
    ).toEqual({
      tokenAddress: '0xabc',
      network: 'eth',
      isNative: false,
      marketTokenId: undefined,
      marketVariantId: undefined,
      marketTokenCategory: undefined,
      marketTokenSymbol: undefined,
      resolveMarketAsset: undefined,
      skipMarketDataFetch: undefined,
      legacyTokenPreview: undefined,
      stockId: undefined,
      stockPreviewSymbol: undefined,
      stockPreviewName: undefined,
      stockPreviewLogoUrl: undefined,
      from: undefined,
      disableTrade: undefined,
      showFavoriteButton: undefined,
    });
  });

  it('updates the current token detail in place', () => {
    getRootStateMock.mockReturnValue({
      key: 'root',
      routes: [
        {
          name: 'main',
          state: {
            key: 'discovery-stack',
            routes: [{ key: 'detail-1', name: 'MarketDetailV2' }],
          },
        },
      ],
    });

    expect(
      applyExistingMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: {
          tokenAddress: '0xabc',
          network: 'eth',
        },
      }),
    ).toBe(true);

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'SET_PARAMS',
      payload: {
        params: buildReplacedMarketDetailParams({
          tokenAddress: '0xabc',
          network: 'eth',
        }),
      },
      source: 'detail-1',
    });
  });

  it('replaces a token detail with a stock detail', () => {
    getRootStateMock.mockReturnValue({
      key: 'root',
      routes: [
        {
          name: 'main',
          state: {
            key: 'discovery-stack',
            routes: [{ key: 'detail-1', name: 'MarketDetailV2' }],
          },
        },
      ],
    });

    expect(
      applyExistingMarketDetailRoute({
        routeName: 'MarketStockDetail',
        params: {
          stockId: 'AAPL',
          tokenAddress: '0xaapl',
          network: 'eth',
        },
      }),
    ).toBe(true);

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'REPLACE',
      payload: {
        name: 'MarketStockDetail',
        params: buildReplacedMarketDetailParams({
          stockId: 'AAPL',
          tokenAddress: '0xaapl',
          network: 'eth',
        }),
      },
      target: 'discovery-stack',
    });
  });

  it('returns false when no market detail is mounted', () => {
    getRootStateMock.mockReturnValue({
      key: 'root',
      routes: [{ key: 'home', name: 'TabDiscovery' }],
    });

    expect(
      applyExistingMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: { tokenAddress: '0xabc', network: 'eth' },
      }),
    ).toBe(false);
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
