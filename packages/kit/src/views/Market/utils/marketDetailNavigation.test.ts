import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  buildReplacedMarketDetailParams,
  findMarketTabStack,
  openOrReplaceMarketDetailRoute,
  replaceFocusedMarketDetailRoute,
  resolveMarketDetailBackAction,
} from './marketDetailNavigation';

const dispatchMock = jest.fn();
const getRootStateMock = jest.fn();
const getCurrentRouteMock = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    current: {
      dispatch: (...args: unknown[]) => {
        dispatchMock(...args);
      },
      getRootState: (): unknown => getRootStateMock() as unknown,
      getCurrentRoute: (): unknown => getCurrentRouteMock() as unknown,
    },
  },
}));

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    setParams: (params: unknown) => ({
      type: 'SET_PARAMS',
      payload: { params },
    }),
    reset: (state: unknown) => ({
      type: 'RESET',
      payload: state,
    }),
  },
  StackActions: {
    replace: (name: string, params: unknown) => ({
      type: 'REPLACE',
      payload: { name, params },
    }),
  },
}));

const stackedTokenDetailsState = {
  key: 'root',
  routes: [
    {
      name: 'main',
      state: {
        key: 'discovery-stack',
        index: 2,
        routes: [
          { key: 'list', name: 'TabDiscovery' },
          { key: 'detail-a', name: 'MarketDetailV2' },
          { key: 'detail-b', name: 'MarketStockDetail' },
        ],
      },
    },
    { key: 'modal', name: 'MobileTokenSelector' },
  ],
};

describe('marketDetailNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platformEnv.isNative = true;
    getRootStateMock.mockReturnValue(undefined);
    getCurrentRouteMock.mockReturnValue(undefined);
  });

  afterEach(() => {
    platformEnv.isNative = false;
  });

  it('finds the deepest market stack under a selector overlay', () => {
    expect(findMarketTabStack(stackedTokenDetailsState)).toEqual(
      stackedTokenDetailsState.routes[0].state,
    );
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

  it('resets stacked details to a single current detail', () => {
    getRootStateMock.mockReturnValue(stackedTokenDetailsState);

    expect(
      openOrReplaceMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: {
          tokenAddress: '0xabc',
          network: 'eth',
        },
      }),
    ).toBe(true);

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'RESET',
      payload: {
        index: 1,
        routes: [
          { key: 'list', name: 'TabDiscovery' },
          {
            name: 'MarketDetailV2',
            params: buildReplacedMarketDetailParams({
              tokenAddress: '0xabc',
              network: 'eth',
            }),
          },
        ],
      },
      target: 'discovery-stack',
    });
  });

  it('updates the current token detail in place when the stack is already a single detail', () => {
    getRootStateMock.mockReturnValue({
      key: 'root',
      routes: [
        {
          name: 'main',
          state: {
            key: 'market-stack',
            index: 1,
            routes: [
              { key: 'list', name: 'TabMarket' },
              { key: 'detail-1', name: 'MarketDetailV2' },
            ],
          },
        },
      ],
    });
    platformEnv.isNative = false;

    expect(
      openOrReplaceMarketDetailRoute({
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

  it('returns false when no market tab stack is mounted', () => {
    expect(
      openOrReplaceMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: { tokenAddress: '0xabc', network: 'eth' },
      }),
    ).toBe(false);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('updates the focused token detail when nested stack state is missing', () => {
    getCurrentRouteMock.mockReturnValue({
      name: 'MarketDetailV2',
      key: 'detail-focused',
    });

    expect(
      replaceFocusedMarketDetailRoute({
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
      source: 'detail-focused',
    });
  });

  it('replaces the focused detail when switching to a stock page', () => {
    getCurrentRouteMock.mockReturnValue({ name: 'MarketDetailV2' });

    expect(
      replaceFocusedMarketDetailRoute({
        routeName: 'MarketStockDetail',
        params: { stockId: 'AAPL' },
      }),
    ).toBe(true);

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'REPLACE',
      payload: {
        name: 'MarketStockDetail',
        params: buildReplacedMarketDetailParams({ stockId: 'AAPL' }),
      },
    });
  });

  it('does not touch a non-detail focused route', () => {
    getCurrentRouteMock.mockReturnValue({ name: 'MobileTokenSelector' });

    expect(
      replaceFocusedMarketDetailRoute({
        routeName: 'MarketDetailV2',
        params: { tokenAddress: '0xabc', network: 'eth' },
      }),
    ).toBe(false);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('pops to the list when previous route is a leftover detail', () => {
    expect(
      resolveMarketDetailBackAction({
        isTabletDetailView: false,
        isNative: true,
        routes: [
          { name: 'TabDiscovery' },
          { name: 'MarketDetailV2' },
          { name: 'MarketStockDetail' },
        ],
        index: 2,
      }),
    ).toEqual({ type: 'popToTop' });
  });

  it('pops once when previous route is the market list', () => {
    expect(
      resolveMarketDetailBackAction({
        isTabletDetailView: false,
        isNative: false,
        routes: [{ name: 'TabMarket' }, { name: 'MarketDetailV2' }],
        index: 1,
      }),
    ).toEqual({ type: 'pop' });
  });

  it('resets native empty history to Discovery instead of TabMarket', () => {
    expect(
      resolveMarketDetailBackAction({
        isTabletDetailView: false,
        isNative: true,
        routes: [{ name: 'MarketDetailV2' }],
        index: 0,
      }),
    ).toEqual({ type: 'reset', name: 'TabDiscovery' });
  });

  it('keeps search-entry native back switching to Discovery', () => {
    expect(
      resolveMarketDetailBackAction({
        isTabletDetailView: false,
        isNative: true,
        from: EEnterWay.Search,
        routes: [{ name: 'TabDiscovery' }, { name: 'MarketDetailV2' }],
        index: 1,
      }),
    ).toEqual({ type: 'popAndSwitchDiscovery' });
  });
});
