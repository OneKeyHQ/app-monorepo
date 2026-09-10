import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { navigateToMarketTokenDetail } from './navigateToMarketTokenDetail';

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
} as unknown as Parameters<
  typeof navigateToMarketTokenDetail
>[1]['tokenDetailActions'];

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
    platformEnv.isNative = false;
  });

  afterEach(() => {
    jest.useRealTimers();
    platformEnv.isNative = false;
  });

  it.each([false, true])(
    'resolves search asset identity before fetching token data (native: %s)',
    (isNativePlatform) => {
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
      navigateToMarketTokenDetail(preview, {
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

  it('routes xStock search results without stock metadata to stock detail', () => {
    const preview = {
      address: '0xaapl',
      networkId: 'evm--1',
      name: 'Apple xStock',
      symbol: 'AAPLx',
      decimals: 18,
      selectedAt: 1,
    };
    navigateToMarketTokenDetail(preview, {
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
