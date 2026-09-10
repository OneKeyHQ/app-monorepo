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
const clearTokenDetailMock = jest.fn();
const changeActiveTokenMock = jest.fn();
const prepareTokenDetailPreviewMock = jest.fn();

const tokenDetailActions = {
  current: {
    clearTokenDetail: clearTokenDetailMock,
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
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
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

describe('navigateToMarketTokenDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    platformEnv.isNative = false;
  });

  afterEach(() => {
    jest.useRealTimers();
    platformEnv.isNative = false;
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

  it('routes xStock search results without stock metadata to stock detail', async () => {
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

    expect(clearTokenDetailMock).toHaveBeenCalledTimes(1);
    expect(changeActiveTokenMock).not.toHaveBeenCalled();
    expect(prepareTokenDetailPreviewMock).not.toHaveBeenCalled();
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
      expect(clearTokenDetailMock).toHaveBeenCalledTimes(1);
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
      },
      {
        tokenDetailActions,
        tokenDetailPreview: {
          symbol: 'AAPLon',
          stock: {
            subtitle: 'Apple Inc.',
            sourceLogoUri: '',
            underlyingAssetTicker: 'AAPL',
          },
        } as never,
      },
    );

    jest.runAllTimers();

    expect(clearTokenDetailMock).toHaveBeenCalledTimes(1);
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
    void navigateToMarketTokenDetail(
      {
        address: '',
        networkId: 'evm--1',
        isNative: true,
      },
      {
        marketTokenCategory: 'top_coins',
        tokenDetailActions,
        tokenDetailPreview: {
          symbol: 'ETH',
          name: 'Ethereum',
        } as never,
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
});
