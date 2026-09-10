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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a stock listing ID when no token variant exists', async () => {
    await navigateToMarketTokenDetail(
      { address: '', networkId: '', stockId: 'AAPL' },
      {
        tokenDetailActions: {
          current: {
            clearTokenDetail: clearTokenDetailMock,
            changeActiveToken: changeActiveTokenMock,
          },
        } as Parameters<
          typeof navigateToMarketTokenDetail
        >[1]['tokenDetailActions'],
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
        tokenDetailActions: {
          current: {
            clearTokenDetail: clearTokenDetailMock,
            changeActiveToken: changeActiveTokenMock,
          },
        } as Parameters<
          typeof navigateToMarketTokenDetail
        >[1]['tokenDetailActions'],
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
        tokenDetailActions: {
          current: {
            clearTokenDetail: clearTokenDetailMock,
            changeActiveToken: changeActiveTokenMock,
          },
        } as never,
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
        tokenDetailActions: {
          current: {
            clearTokenDetail: clearTokenDetailMock,
            changeActiveToken: changeActiveTokenMock,
          },
        } as never,
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
      const tokenDetailActions = {
        current: {
          clearTokenDetail: clearTokenDetailMock,
          changeActiveToken: changeActiveTokenMock,
        },
      } as Parameters<
        typeof navigateToMarketTokenDetail
      >[1]['tokenDetailActions'];
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
        tokenDetailActions: {
          current: {
            clearTokenDetail: clearTokenDetailMock,
            changeActiveToken: changeActiveTokenMock,
          },
        } as Parameters<
          typeof navigateToMarketTokenDetail
        >[1]['tokenDetailActions'],
        isCurrentRequest: () => current,
      },
    );
    current = false;
    jest.runAllTimers();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
