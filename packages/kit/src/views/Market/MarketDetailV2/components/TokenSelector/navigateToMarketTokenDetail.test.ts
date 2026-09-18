import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { navigateToMarketTokenDetail } from './navigateToMarketTokenDetail';

const mockFetchAssetDetail = jest.fn<Promise<unknown>, unknown[]>();
const mockToastError = jest.fn();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      fetchMarketAssetDetail: (...args: unknown[]) =>
        mockFetchAssetDetail(...args),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: { intl: { formatMessage: ({ id }: { id: string }) => id } },
}));
const navigateMock = jest.fn();
const dispatchMock = jest.fn();
const getRootStateMock = jest.fn();
const getCurrentRouteMock = jest.fn();
const clearTokenDetailMock = jest.fn();
const prepareStockTokenDetailMock = jest.fn();
const changeActiveTokenMock = jest.fn();
const prepareTokenDetailPreviewMock = jest.fn();

const tokenDetailActions = {
  current: {
    clearTokenDetail: clearTokenDetailMock,
    prepareStockTokenDetail: prepareStockTokenDetailMock,
    changeActiveToken: changeActiveTokenMock,
    prepareTokenDetailPreview: prepareTokenDetailPreviewMock,
  },
} satisfies Parameters<
  typeof navigateToMarketTokenDetail
>[1]['tokenDetailActions'];

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: (...args: unknown[]) => {
      mockToastError(...args);
    },
  },
  rootNavigationRef: {
    current: {
      navigate: (...args: unknown[]) => {
        navigateMock(...args);
      },
      dispatch: (...args: unknown[]) => {
        dispatchMock(...args);
      },
      getRootState: (): unknown => getRootStateMock() as unknown,
      getCurrentRoute: (): unknown => getCurrentRouteMock() as unknown,
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
    isNative: false,
    isWeb: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    getNetworkShortCode: jest.fn(() => 'eth'),
  },
}));

jest.mock('../../utils/marketDetailImagePreload', () => ({
  prewarmMarketTokenDetailPreviewImages: jest.fn(),
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

describe('navigateToMarketTokenDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    platformEnv.isDesktop = true;
    platformEnv.isNative = false;
    platformEnv.isWeb = false;
    getRootStateMock.mockReturnValue(undefined);
    getCurrentRouteMock.mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    platformEnv.isDesktop = true;
    platformEnv.isNative = false;
    platformEnv.isWeb = false;
  });

  it.each([false, true])(
    'resolves search asset identity before fetching token data (native: %s)',
    async (isNativePlatform) => {
      platformEnv.isNative = isNativePlatform;
      const preview = {
        address: '',
        networkId: 'evm--1',
        isNative: true,
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
        selectedAt: 1,
      };
      const beforeNavigate = jest.fn();
      await navigateToMarketTokenDetail(preview, {
        tokenDetailActions,
        resolveMarketAsset: true,
        tokenDetailPreview: preview,
        beforeNavigate,
      });

      expect(beforeNavigate).toHaveBeenCalledTimes(1);
      expect(prepareTokenDetailPreviewMock).toHaveBeenCalledWith(preview);
      expect(changeActiveTokenMock).not.toHaveBeenCalled();
      jest.runAllTimers();

      expect(navigateMock).toHaveBeenCalledWith('main', {
        screen: isNativePlatform ? 'Discovery' : 'Market',
        params: {
          screen: 'MarketDetailV2',
          params: {
            tokenAddress: '',
            network: 'eth',
            isNative: true,
            resolveMarketAsset: true,
            marketTokenSymbol: 'ETH',
            legacyTokenPreview: preview,
          },
        },
      });
    },
  );

  it('routes xStock search results without a stock id to token detail', async () => {
    const preview = {
      address: '0xaapl',
      networkId: 'evm--1',
      name: 'Apple xStock',
      symbol: 'AAPLx',
      decimals: 18,
      selectedAt: 1,
    };
    await navigateToMarketTokenDetail(preview, {
      tokenDetailActions,
      resolveMarketAsset: true,
      tokenDetailPreview: preview,
    });
    jest.runAllTimers();

    expect(prepareTokenDetailPreviewMock).toHaveBeenCalledWith(preview);
    expect(prepareStockTokenDetailMock).not.toHaveBeenCalled();
    expect(clearTokenDetailMock).not.toHaveBeenCalled();
    expect(changeActiveTokenMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('main', {
      screen: 'Market',
      params: {
        screen: 'MarketDetailV2',
        params: {
          tokenAddress: '0xaapl',
          network: 'eth',
          isNative: undefined,
          resolveMarketAsset: true,
          marketTokenSymbol: 'AAPLx',
          legacyTokenPreview: preview,
        },
      },
    });
  });

  it.each([false, true])(
    'preserves a tokenized stock favorite with only a top-level stockId (native: %s)',
    async (isNativePlatform) => {
      platformEnv.isNative = isNativePlatform;
      const preview = {
        address: '0xnvda',
        networkId: 'evm--1',
        name: 'NVIDIA Tokenized Stock',
        symbol: 'NVDAon',
        decimals: 18,
        selectedAt: 1,
        stock: { subtitle: 'NVIDIA', sourceLogoUri: '' },
      };
      await navigateToMarketTokenDetail(
        { ...preview, stockId: 'NVDA' },
        {
          tokenDetailActions,
          resolveMarketAsset: true,
          tokenDetailPreview: preview,
        },
      );
      jest.runAllTimers();

      expect(navigateMock).toHaveBeenCalledWith('main', {
        screen: isNativePlatform ? 'Discovery' : 'Market',
        params: {
          screen: 'MarketStockDetail',
          params: {
            stockId: 'NVDA',
            tokenAddress: '0xnvda',
            network: 'eth',
            isNative: undefined,
          },
        },
      });
      expect(prepareStockTokenDetailMock).toHaveBeenCalledWith({
        tokenAddress: '0xnvda',
        networkId: 'evm--1',
        isNative: undefined,
      });
      expect(clearTokenDetailMock).not.toHaveBeenCalled();
      expect(prepareTokenDetailPreviewMock).not.toHaveBeenCalled();
      expect(changeActiveTokenMock).not.toHaveBeenCalled();
      expect(mockFetchAssetDetail).not.toHaveBeenCalled();
    },
  );

  it('does not resolve a known asset favorite again through search', async () => {
    mockFetchAssetDetail.mockResolvedValueOnce({
      selectedVariant: {
        tokenAddress: '',
        networkId: 'btc--0',
        isNative: true,
        variantId: 'btc-native',
      },
    });
    await navigateToMarketTokenDetail(
      { assetId: 'bitcoin', address: '', networkId: '' },
      {
        tokenDetailActions,
        resolveMarketAsset: true,
        marketTokenCategory: 'trending',
      },
    );
    jest.runAllTimers();

    expect(mockFetchAssetDetail).toHaveBeenCalledTimes(1);
    expect(prepareTokenDetailPreviewMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('main', {
      screen: 'Market',
      params: {
        screen: 'MarketDetailV2',
        params: {
          marketTokenId: 'bitcoin',
          marketVariantId: 'btc-native',
          marketTokenCategory: 'top_coins',
          tokenAddress: '',
          network: 'eth',
          isNative: true,
        },
      },
    });
  });

  it('keeps a stock listing ID when no token variant exists', async () => {
    await navigateToMarketTokenDetail(
      { address: '', networkId: '', stockId: 'AAPL' },
      {
        tokenDetailActions,
      },
    );
    jest.runAllTimers();
    expect(navigateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        params: expect.objectContaining({
          params: expect.objectContaining({ stockId: 'AAPL' }),
        }),
      }),
    );
    expect(mockFetchAssetDetail).not.toHaveBeenCalled();
  });

  it('resolves an asset only on navigation and preserves the asset route', async () => {
    mockFetchAssetDetail.mockResolvedValue({
      selectedVariant: {
        tokenAddress: '',
        networkId: 'btc--0',
        isNative: true,
        variantId: 'btc-native',
      },
    });
    await navigateToMarketTokenDetail(
      { address: '', networkId: '', assetId: 'bitcoin' },
      {
        tokenDetailActions,
      },
    );
    jest.runAllTimers();
    expect(navigateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        params: expect.objectContaining({
          params: expect.objectContaining({
            marketTokenId: 'bitcoin',
            marketVariantId: 'btc-native',
            marketTokenCategory: 'top_coins',
          }),
        }),
      }),
    );
  });

  it('routes stock selector items to stock detail by stockId', () => {
    void navigateToMarketTokenDetail(
      {
        address: '0xaapl',
        networkId: 'evm--1',
        stockId: 'AAPL',
      },
      {
        tokenDetailActions,
        tokenDetailPreview: {
          symbol: 'AAPLon',
          stock: {
            subtitle: 'Apple Inc.',
            sourceLogoUri: '',
            stockId: 'AAPL',
            underlyingAssetTicker: 'AAPL',
          },
        } as never,
      },
    );

    jest.runAllTimers();

    expect(prepareStockTokenDetailMock).toHaveBeenCalledWith({
      tokenAddress: '0xaapl',
      networkId: 'evm--1',
      isNative: undefined,
    });
    expect(clearTokenDetailMock).not.toHaveBeenCalled();
    expect(changeActiveTokenMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('main', {
      screen: 'Market',
      params: {
        screen: 'MarketStockDetail',
        params: {
          stockId: 'AAPL',
          tokenAddress: '0xaapl',
          network: 'eth',
          isNative: undefined,
        },
      },
    });
  });

  it('keeps the current category when selecting another normal token', () => {
    const preview = {
      address: '',
      networkId: 'evm--1',
      isNative: true,
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      selectedAt: 1,
    };
    void navigateToMarketTokenDetail(
      {
        address: '',
        networkId: 'evm--1',
        isNative: true,
      },
      {
        marketTokenCategory: 'top_coins',
        tokenDetailActions,
        tokenDetailPreview: preview,
      },
    );

    jest.runAllTimers();

    expect(changeActiveTokenMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('main', {
      screen: 'Market',
      params: {
        screen: 'MarketDetailV2',
        params: {
          tokenAddress: '',
          network: 'eth',
          isNative: true,
          legacyTokenPreview: preview,
          marketTokenCategory: 'top_coins',
        },
      },
    });
  });

  it('preserves native route params when selecting another normal token', () => {
    platformEnv.isDesktop = false;
    platformEnv.isNative = true;
    const preview = {
      address: '',
      networkId: 'evm--1',
      isNative: true,
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      selectedAt: 1,
    };
    void navigateToMarketTokenDetail(
      {
        address: '',
        networkId: 'evm--1',
        isNative: true,
      },
      {
        marketTokenCategory: 'top_coins',
        tokenDetailActions,
        tokenDetailPreview: preview,
      },
    );

    jest.runAllTimers();

    expect(navigateMock).toHaveBeenCalledWith('main', {
      screen: 'Discovery',
      params: {
        screen: 'MarketDetailV2',
        params: {
          tokenAddress: '',
          network: 'eth',
          isNative: true,
          marketTokenCategory: 'top_coins',
        },
      },
    });
  });
  it.each(['resolve', 'reject'])(
    'ignores a superseded asset lookup that later %ss',
    async (outcome) => {
      let resolveLookup: (value: unknown) => void = () => {};
      let rejectLookup: (reason: Error) => void = () => {};
      mockFetchAssetDetail.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            resolveLookup = resolve;
            rejectLookup = reject;
          }),
      );
      let requestId = 1;
      const beforeNavigate = jest.fn();
      const onError = jest.fn();
      const first = navigateToMarketTokenDetail(
        { assetId: 'bitcoin', networkId: '', address: '' },
        {
          tokenDetailActions,
          beforeNavigate,
          onError,
          isCurrentRequest: () => requestId === 1,
        },
      );
      requestId = 2;
      await navigateToMarketTokenDetail(
        { stockId: 'AAPL', networkId: '', address: '' },
        { tokenDetailActions, isCurrentRequest: () => requestId === 2 },
      );
      if (outcome === 'resolve') {
        resolveLookup({
          selectedVariant: {
            networkId: 'btc--0',
            tokenAddress: '',
            isNative: true,
          },
        });
      } else {
        rejectLookup(new Error('offline'));
      }
      await first;
      jest.runAllTimers();
      expect(beforeNavigate).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(changeActiveTokenMock).not.toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            params: expect.objectContaining({ stockId: 'AAPL' }),
          }),
        }),
      );
    },
  );

  it('cancels delayed navigation when another selection supersedes it', async () => {
    let current = true;
    await navigateToMarketTokenDetail(
      { stockId: 'AAPL', address: '', networkId: '' },
      {
        tokenDetailActions,
        isCurrentRequest: () => current,
      },
    );
    current = false;
    jest.runAllTimers();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('collapses stacked details instead of root-navigating another page', async () => {
    platformEnv.isNative = true;
    getRootStateMock.mockReturnValue({
      key: 'root',
      index: 1,
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
    });
    getCurrentRouteMock.mockReturnValue({ name: 'MobileTokenSelector' });
    const beforeNavigate = jest.fn();
    await navigateToMarketTokenDetail(
      { address: '0xabc', networkId: 'evm--1', isNative: false },
      { tokenDetailActions, beforeNavigate },
    );

    expect(beforeNavigate).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESET',
        target: 'discovery-stack',
      }),
    );
  });

  it('updates SwapPro in place instead of rewriting the background Market stack', async () => {
    platformEnv.isNative = true;
    getRootStateMock.mockReturnValue({
      key: 'root',
      index: 1,
      routes: [
        {
          name: 'main',
          state: {
            key: 'market-stack',
            index: 1,
            routes: [
              { key: 'list', name: 'TabMarket' },
              { key: 'detail-bg', name: 'MarketDetailV2' },
            ],
          },
        },
        {
          key: 'swap-modal',
          name: 'SwapModal',
          state: {
            key: 'swap-stack',
            index: 0,
            routes: [{ key: 'swap-detail', name: 'SwapProMarketDetail' }],
          },
        },
      ],
    });
    getCurrentRouteMock.mockReturnValue({
      name: 'SwapProMarketDetail',
      key: 'swap-detail',
    });
    const beforeNavigate = jest.fn();
    await navigateToMarketTokenDetail(
      { address: '0xabc', networkId: 'evm--1', isNative: false },
      { tokenDetailActions, beforeNavigate },
    );

    expect(beforeNavigate).toHaveBeenCalledTimes(1);
    expect(dispatchMock).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_PARAMS',
        source: 'swap-detail',
      }),
    );
    const dispatched = dispatchMock.mock.calls[0]?.[0] as {
      payload?: { params?: Record<string, unknown> };
    };
    expect(dispatched.payload?.params).not.toHaveProperty('from');
    expect(dispatched.payload?.params).not.toHaveProperty('disableTrade');
    expect(dispatched.payload?.params).not.toHaveProperty('showFavoriteButton');
  });

  it('updates the focused detail after the selector closes when nested state is missing', async () => {
    platformEnv.isNative = true;
    getCurrentRouteMock.mockReturnValue({
      name: 'MarketDetailV2',
      key: 'detail-focused',
    });
    const beforeNavigate = jest.fn();
    await navigateToMarketTokenDetail(
      { address: '0xabc', networkId: 'evm--1', isNative: false },
      { tokenDetailActions, beforeNavigate },
    );

    expect(beforeNavigate).toHaveBeenCalledTimes(1);
    jest.runAllTimers();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_PARAMS',
      }),
    );
  });
});
