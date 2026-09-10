import { navigateToMarketTokenDetail } from './navigateToMarketTokenDetail';

const navigateMock = jest.fn();
const clearTokenDetailMock = jest.fn();
const changeActiveTokenMock = jest.fn();

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
});
