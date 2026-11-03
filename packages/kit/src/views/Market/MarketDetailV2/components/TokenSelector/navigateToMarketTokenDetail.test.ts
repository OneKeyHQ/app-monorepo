/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenDetailRouteParams } from '@onekeyhq/shared/src/routes/tabMarket';
import { isTabBarHiddenByRequest } from '@onekeyhq/shared/src/tabBar/hideTabBarRequests';
import { getMarketWatchlistKey } from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';

import { finishMarketDetailTabBarTransition } from '../../../utils/marketDetailNavigation';
import { useMarketDetailWatchlistIdentity } from '../../hooks/useMarketDetailWatchlistIdentity';

import {
  convertSearchTokenToMarketToken,
  getSelectorSearchAssetId,
} from './constants';
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
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    onLocaleChange: jest.fn(),
  },
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
    isNativeAndroid: false,
    isWeb: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual<
      typeof import('@onekeyhq/shared/src/utils/networkUtils')
    >('@onekeyhq/shared/src/utils/networkUtils').default,
    getNetworkShortCode: jest.fn(() => 'eth'),
  },
}));

jest.mock('../../utils/marketDetailImagePreload', () => ({
  prewarmMarketTokenDetailPreviewImages: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: (): unknown => getCurrentRouteMock() as unknown,
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
    platformEnv.isNativeAndroid = false;
    platformEnv.isWeb = false;
    getRootStateMock.mockReturnValue(undefined);
    getCurrentRouteMock.mockReturnValue(undefined);
  });

  afterEach(() => {
    finishMarketDetailTabBarTransition();
    jest.useRealTimers();
    platformEnv.isDesktop = true;
    platformEnv.isNative = false;
    platformEnv.isNativeAndroid = false;
    platformEnv.isWeb = false;
  });

  it('keeps contract search navigation scoped to its chain and address', () => {
    const result = convertSearchTokenToMarketToken({
      assetId: 'usdc',
      name: 'USD Coin',
      symbol: 'USDC',
      price: '1',
      network: 'evm--8453',
      address: '0xusdc',
      isNative: false,
      logoUrl: '',
      networkLogoURI: '',
      decimals: 6,
      liquidity: '0',
      volume_24h: '0',
    });
    expect(result).toMatchObject({
      assetId: undefined,
      networkId: 'evm--8453',
      address: '0xusdc',
    });
  });

  it('preserves the native network selected in asset search', async () => {
    const mainnet = {
      variantId: 'ethereum-mainnet',
      networkId: 'evm--1',
      tokenAddress: '',
      isNative: true,
    };
    const base = {
      ...mainnet,
      variantId: 'ethereum-base',
      networkId: 'evm--8453',
    };
    mockFetchAssetDetail.mockResolvedValueOnce({
      selectedVariant: mainnet,
      variants: [mainnet, base],
    });
    await navigateToMarketTokenDetail(
      {
        assetId: 'ethereum',
        address: '',
        networkId: base.networkId,
        isNative: true,
      },
      { tokenDetailActions },
    );
    jest.runAllTimers();
    expect(changeActiveTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ networkId: base.networkId }),
    );
    expect(navigateMock).toHaveBeenCalledWith(
      'main',
      expect.objectContaining({
        params: expect.objectContaining({
          params: expect.objectContaining({
            marketTokenId: 'ethereum',
            marketVariantId: base.variantId,
          }),
        }),
      }),
    );
  });

  it('rejects a missing search variant without navigating or changing the active token', async () => {
    const onError = jest.fn();
    mockFetchAssetDetail.mockResolvedValueOnce({
      selectedVariant: { networkId: 'evm--1', isNative: true },
      variants: [],
    });
    await navigateToMarketTokenDetail(
      {
        assetId: 'ethereum',
        address: '',
        networkId: 'evm--8453',
        isNative: true,
      },
      { tokenDetailActions, onError },
    );
    jest.runAllTimers();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(changeActiveTokenMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('opens the searched chain when asset detail is unavailable', async () => {
    mockFetchAssetDetail.mockRejectedValueOnce(new Error('offline'));
    const beforeNavigate = jest.fn();
    const onError = jest.fn();
    await navigateToMarketTokenDetail(
      { assetId: 'eth', address: '', networkId: 'evm--8453', isNative: true },
      { tokenDetailActions, onError, beforeNavigate },
    );
    jest.runAllTimers();
    expect(navigateMock).toHaveBeenCalledWith(
      'main',
      expect.objectContaining({
        params: {
          screen: 'MarketDetailV2',
          params: { tokenAddress: '', network: 'eth', isNative: true },
        },
      }),
    );
    expect(beforeNavigate).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(changeActiveTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ networkId: 'evm--8453', tokenAddress: '' }),
    );
  });

  it('reports an asset-only request failure without navigating', async () => {
    mockFetchAssetDetail.mockRejectedValueOnce(new Error('offline'));
    const onError = jest.fn();
    await navigateToMarketTokenDetail(
      { assetId: 'ethereum', address: '', networkId: '' },
      { tokenDetailActions, onError },
    );
    jest.runAllTimers();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(changeActiveTokenMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'opens a search result without asset metadata (native: %s)',
    async (isNativePlatform) => {
      platformEnv.isNative = isNativePlatform;
      platformEnv.isDesktop = !isNativePlatform;
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
        tokenDetailPreview: preview,
        beforeNavigate,
      });
      jest.runAllTimers();
      expect(beforeNavigate).toHaveBeenCalledTimes(1);
      expect(mockFetchAssetDetail).not.toHaveBeenCalled();
      expect(changeActiveTokenMock).toHaveBeenCalledWith(
        expect.objectContaining({ networkId: 'evm--1', tokenAddress: '' }),
      );
      expect(navigateMock).toHaveBeenCalledWith('main', {
        screen: 'Market',
        params: {
          screen: 'MarketDetailV2',
          params: {
            tokenAddress: '',
            network: 'eth',
            isNative: true,
            ...(!isNativePlatform ? { legacyTokenPreview: preview } : {}),
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
      tokenDetailPreview: preview,
    });
    jest.runAllTimers();

    expect(changeActiveTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ tokenDetailPreview: preview }),
    );
    expect(prepareStockTokenDetailMock).not.toHaveBeenCalled();
    expect(clearTokenDetailMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('main', {
      screen: 'Market',
      params: {
        screen: 'MarketDetailV2',
        params: {
          tokenAddress: '0xaapl',
          network: 'eth',
          isNative: undefined,
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
          tokenDetailPreview: preview,
        },
      );
      jest.runAllTimers();

      expect(navigateMock).toHaveBeenCalledWith('main', {
        screen: 'Market',
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

  it.each([false, true])(
    'keeps the selected search chain instead of the default asset variant (native token: %s)',
    async (isNative) => {
      jest.mocked(networkUtils.getNetworkShortCode).mockReturnValueOnce('sol');
      mockFetchAssetDetail.mockResolvedValue({
        selectedVariant: {
          networkId: 'evm--1',
          tokenAddress: '0xDefault',
          isNative: false,
          variantId: 'default-eth',
        },
        variants: [
          {
            networkId: 'sol--101',
            tokenAddress: '',
            isNative: true,
            variantId: 'sol-native',
          },
        ],
      });
      const address = isNative ? '' : 'SolanaUsdc';
      const selected = convertSearchTokenToMarketToken({
        assetId: isNative ? 'solana' : 'usd-coin',
        network: 'sol--101',
        address,
        isNative,
        symbol: isNative ? 'SOL' : 'USDC',
        name: isNative ? 'Solana' : 'USD Coin',
        price: '1',
        decimals: 6,
        logoUrl: '',
        networkLogoURI: '',
        liquidity: '0',
        volume_24h: '0',
      });
      await navigateToMarketTokenDetail(
        { ...selected, networkId: selected.networkId ?? '' },
        { tokenDetailActions },
      );
      jest.runAllTimers();
      if (isNative) {
        expect(mockFetchAssetDetail).toHaveBeenCalledWith({
          assetId: 'solana',
          currency: 'usd',
          autoHandleError: false,
        });
      } else {
        expect(mockFetchAssetDetail).not.toHaveBeenCalled();
      }
      expect(navigateMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            params: expect.objectContaining({
              tokenAddress: address,
              network: 'sol',
              isNative,
              ...(isNative
                ? { marketTokenId: 'solana', marketVariantId: 'sol-native' }
                : {}),
            }),
          }),
        }),
      );
      expect(selected.networkId).toBe('sol--101');
    },
  );

  it.each([false, true])(
    'keeps search row and detail favorite identities consistent (native: %s)',
    async (isNative) => {
      const searchToken: IMarketSearchV2Token & { networkLogoURI: string } = {
        assetId: 'eth',
        network: 'evm--1',
        address: isNative ? '' : '0xweth',
        isNative,
        symbol: isNative ? 'ETH' : 'WETH',
        name: 'Ether',
        price: '2000',
        decimals: 18,
        logoUrl: '',
        networkLogoURI: '',
        liquidity: '0',
        volume_24h: '0',
      };
      mockFetchAssetDetail.mockResolvedValue({
        selectedVariant: {
          networkId: searchToken.network,
          tokenAddress: searchToken.address,
          isNative,
          variantId: 'selected',
        },
        variants: [],
      });
      const selected = convertSearchTokenToMarketToken(searchToken);
      await navigateToMarketTokenDetail(
        { ...selected, networkId: selected.networkId ?? '' },
        { tokenDetailActions },
      );
      jest.runAllTimers();
      const target = navigateMock.mock.calls[0][1] as {
        params: { params: IMarketTokenDetailRouteParams };
      };
      getCurrentRouteMock.mockReturnValue({ params: target.params.params });
      const { result } = renderHook(() => useMarketDetailWatchlistIdentity());
      const chainIdentity = {
        chainId: searchToken.network,
        contractAddress: searchToken.address,
      };
      const rowKey = getMarketWatchlistKey({
        ...chainIdentity,
        assetId: getSelectorSearchAssetId(searchToken),
      });
      const detailKey = getMarketWatchlistKey({
        ...chainIdentity,
        ...result.current,
      });
      expect(detailKey).toBe(rowKey);
    },
  );

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
  it.each([
    ['resolve', ''],
    ['reject', ''],
    ['resolve', 'btc--0'],
    ['reject', 'btc--0'],
  ])(
    'ignores a superseded asset lookup that later %ss (network=%s)',
    async (outcome, networkId) => {
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
        { assetId: 'bitcoin', networkId, address: '' },
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
            key: 'market-stack',
            index: 2,
            routes: [
              { key: 'list', name: 'TabMarket' },
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
        target: 'market-stack',
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

  it('hides the Android tab bar before the root navigation fallback', async () => {
    platformEnv.isDesktop = false;
    platformEnv.isNative = true;
    platformEnv.isNativeAndroid = true;

    await navigateToMarketTokenDetail(
      { address: '0xabc', networkId: 'evm--1', isNative: false },
      { tokenDetailActions },
    );

    jest.advanceTimersByTime(100);
    expect(isTabBarHiddenByRequest()).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith(
      'main',
      expect.objectContaining({
        screen: 'Market',
      }),
    );
  });
});
