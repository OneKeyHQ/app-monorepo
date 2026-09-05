import { navigateToMarketTokenDetail } from './navigateToMarketTokenDetail';

const navigateMock = jest.fn();
const clearTokenDetailMock = jest.fn();
const changeActiveTokenMock = jest.fn();
const mockPrepareKlineSource = jest.fn(
  (_params: { tokenAddress: string; networkId: string }) => undefined,
);
const mockPrefetchFirstScreenKLine = jest.fn(
  (_params: {
    tokenAddress: string;
    networkId: string;
    historyStartTime?: number;
  }) => Promise.resolve(),
);

jest.mock('@onekeyhq/components', () => ({
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

jest.mock('../../utils/marketDetailPagePreload', () => ({
  prepareMarketDetailV2KlineSource: (params: {
    tokenAddress: string;
    networkId: string;
  }) => mockPrepareKlineSource(params),
  prefetchMarketDetailV2FirstScreenKLine: (params: {
    tokenAddress: string;
    networkId: string;
    historyStartTime?: number;
  }) => mockPrefetchFirstScreenKLine(params),
}));

describe('navigateToMarketTokenDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('routes stock selector items to stock detail by stockId', () => {
    navigateToMarketTokenDetail(
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
    expect(mockPrefetchFirstScreenKLine).not.toHaveBeenCalled();
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
    navigateToMarketTokenDetail(
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
    expect(mockPrefetchFirstScreenKLine).not.toHaveBeenCalled();
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

  it('prefetches before switching tokens in TradingView mode', () => {
    navigateToMarketTokenDetail(
      {
        address: '0xabc',
        networkId: 'evm--1',
      },
      {
        chartMode: 'tradingView',
        tokenDetailActions: {
          current: {
            clearTokenDetail: clearTokenDetailMock,
            changeActiveToken: changeActiveTokenMock,
          },
        } as never,
        tokenDetailPreview: {
          symbol: 'ABC',
          name: 'ABC Token',
          firstTradeTime: 123,
        } as never,
      },
    );

    expect(mockPrepareKlineSource).toHaveBeenCalledWith({
      tokenAddress: '0xabc',
      networkId: 'evm--1',
    });
    expect(mockPrefetchFirstScreenKLine).toHaveBeenCalledWith({
      tokenAddress: '0xabc',
      networkId: 'evm--1',
      historyStartTime: 123,
    });
  });
});
