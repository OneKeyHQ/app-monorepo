/** @jest-environment jsdom */
import type { PropsWithChildren, ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketBasicConfigResponse } from '@onekeyhq/shared/types/marketV2';

import { PopularTrading } from './PopularTrading';

import type { IFavoriteTokenDisplay } from './types';

const mockRecord: IFavoriteTokenDisplay = {
  assetId: 'bitcoin',
  chainId: '',
  contractAddress: '',
  isNative: false,
  symbol: 'BTC',
  name: 'Bitcoin',
  logoUrl: '',
  price: 1,
  priceChange24h: 0,
  marketCap: 1,
  volume24h: 1,
};
let mockShowFavorites = false;
let mockRecommendationResult: IFavoriteTokenDisplay[] | undefined;
let mockRefreshFavorites: () => Promise<void>;
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    minHeight,
    testID,
  }: PropsWithChildren<{ minHeight?: number; testID?: string }>) => (
    <div data-testid={testID} style={{ minHeight }}>
      {children}
    </div>
  );
  return {
    Stack,
    XStack: Stack,
    YStack: Stack,
    SizableText: Stack,
    Button: Stack,
    Icon: () => null,
    IconButton: () => null,
    useMedia: () => ({ md: false }),
    Toast: { error: jest.fn() },
    rootNavigationRef: { current: { navigate: jest.fn() } },
    getSharedButtonStyles: () => ({ sharedFrameStyles: {} }),
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isExtensionUiPopup: true },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { getNetworkShortCode: () => 'btc' },
}));
jest.mock('@onekeyhq/shared/src/utils/perpsUtils', () => ({
  getTokenSubtitle: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({ defaultLogger: {} }));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: { openExtensionMarketTokenDetail: jest.fn() },
    serviceMarket: { fetchMarketAssetDetail: jest.fn() },
    serviceMarketV2: {
      getMarketWatchListV2: jest.fn(),
      fetchMarketBasicConfig: jest.fn(),
      fetchMarketListingWatchlistQuote: jest.fn(),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/components/Loading', () => ({
  ListLoading: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ switchTab: jest.fn() }),
}));
jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    setParams: jest.fn((params: unknown) => ({
      type: 'SET_PARAMS',
      payload: { params },
    })),
    reset: jest.fn((state: unknown) => ({
      type: 'RESET',
      payload: state,
    })),
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    method: () => Promise<void>,
    _deps: unknown[],
    options?: { watchLoading?: boolean },
  ) => {
    if (options?.watchLoading) mockRefreshFavorites = method;
    return {
      isLoading: false,
      run: jest.fn(),
      result: options?.watchLoading ? undefined : mockRecommendationResult,
    };
  },
}));
jest.mock('../../../Market/hooks', () => ({
  useMarketBasicConfig: () => ({
    isLoading: false,
    homeTab: [],
    perpsCategories: [],
    spotCategories: [],
  }),
  useNavigateToMarketTab: () => jest.fn(),
  usePerpsNavigation: () => ({ navigateToPerps: jest.fn() }),
}));
jest.mock('../../../Market/MarketHomeV2/components/CategorySelector', () => ({
  CategorySelector: () => null,
}));
jest.mock(
  '../../../Market/MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers',
  () => ({ getNativeTokenInfo: jest.fn() }),
);
jest.mock(
  '../../../Market/MarketHomeV2/components/MarketTopCoinsList/hooks/useMarketTopCoins',
  () => ({ useMarketTopCoinResolver: () => jest.fn() }),
);
jest.mock('../RichBlock/RichBlock', () => ({
  RichBlock: ({ content }: { content: ReactNode }) => <div>{content}</div>,
}));
jest.mock('../RichTable', () => ({
  RichTable: ({ dataSource }: { dataSource: IFavoriteTokenDisplay[] }) => (
    <div data-testid="favorite-list">
      {dataSource.map((token) => token.symbol).join(', ')}
    </div>
  ),
}));
jest.mock('./metricColumns', () => ({
  HOME_MARKET_TABLE_ROW_MIN_HEIGHT: 68,
  HOME_MARKET_TABLE_HEADER_MIN_HEIGHT: 0,
  getPopularTradingColumns: () => [],
  renderPopularTradingStockBadges: () => null,
}));
jest.mock('./useHomeMarketCategoryTokens', () => ({
  useHomeMarketCategoryTokens: () => ({
    categoryTokens: [mockRecord],
    isCategoryLoading: false,
  }),
}));
jest.mock('./utils', () => ({
  buildHomeMarketCategories: ({
    favoritesCategory,
  }: {
    favoritesCategory: { id: string; name: string };
  }) =>
    mockShowFavorites
      ? [favoritesCategory]
      : [{ id: 'top_coins', name: 'Top Coins' }],
  getTokenKey: (token: IFavoriteTokenDisplay) => token.assetId,
  shouldShowHomeRecommendCards: ({
    visibleFavoriteCount,
  }: {
    visibleFavoriteCount: number;
  }) => visibleFavoriteCount === 0,
}));
jest.mock('./MarketCategoryTokenList', () => ({
  MarketCategoryTokenList: ({
    onTokenPress,
  }: {
    onTokenPress: (record: IFavoriteTokenDisplay) => void;
  }) => (
    <button type="button" onClick={() => onTokenPress(mockRecord)}>
      Open token
    </button>
  ),
}));

const openDetail = jest.spyOn(
  backgroundApiProxy.serviceApp,
  'openExtensionMarketTokenDetail',
);
const fetchAsset = jest.spyOn(
  backgroundApiProxy.serviceMarket,
  'fetchMarketAssetDetail',
);
const getWatchList = jest.spyOn(
  backgroundApiProxy.serviceMarketV2,
  'getMarketWatchListV2',
);
const fetchRecommendations = jest.spyOn(
  backgroundApiProxy.serviceMarketV2,
  'fetchMarketBasicConfig',
);
const fetchListingQuote = jest.spyOn(
  backgroundApiProxy.serviceMarketV2,
  'fetchMarketListingWatchlistQuote',
);
beforeEach(() => {
  jest.clearAllMocks();
  mockShowFavorites = false;
  mockRecommendationResult = undefined;
  openDetail.mockReset().mockResolvedValue(undefined);
  fetchAsset.mockReset().mockResolvedValue({
    selectedVariant: {
      networkId: 'btc--0',
      tokenAddress: '',
      isNative: true,
      variantId: 'bitcoin-native',
    },
  } as Awaited<
    ReturnType<typeof backgroundApiProxy.serviceMarket.fetchMarketAssetDetail>
  >);
});

it.each([true, false])(
  'reserves the same content space when switching from a category to empty favorites in table layout %p',
  (tableLayout) => {
    const view = render(<PopularTrading tableLayout={tableLayout} />);
    const content = screen.getByTestId('home-market-content');
    const height = content.style.minHeight;
    expect(Number.parseFloat(height)).toBeGreaterThan(0);
    expect(screen.getByText('Open token')).toBeTruthy();
    mockShowFavorites = true;
    view.rerender(<PopularTrading tableLayout={tableLayout} />);
    expect(screen.queryByText('Open token')).toBeNull();
    expect(screen.getByText(ETranslations.global_no_data)).toBeTruthy();
    expect(screen.getByTestId('home-market-content')).toBe(content);
    expect(content.style.minHeight).toBe(height);
  },
);

it('keeps the current view until recommendations are ready after clearing favorites', async () => {
  mockShowFavorites = true;
  getWatchList.mockResolvedValue({
    data: [{ assetId: 'bitcoin', chainId: '', contractAddress: '' }],
  });
  fetchListingQuote.mockResolvedValue({
    symbol: 'BTC',
    name: 'Bitcoin',
    logoUrl: '',
  });
  render(<PopularTrading tableLayout />);
  await act(async () => mockRefreshFavorites());
  expect(screen.getByTestId('favorite-list').textContent).toBe('BTC');

  getWatchList.mockResolvedValue({ data: [] });
  const config = Promise.withResolvers<IMarketBasicConfigResponse>();
  fetchRecommendations.mockReturnValueOnce(config.promise);
  let refresh: Promise<void>;
  await act(async () => {
    refresh = mockRefreshFavorites();
  });
  expect(screen.queryByText(ETranslations.global_no_data)).toBeNull();
  expect(screen.getByTestId('favorite-list').textContent).toBe('BTC');

  await act(async () => {
    config.resolve({
      code: 0,
      message: '',
      data: {
        tradingViewUrl: '',
        networkList: [],
        recommendTokens: [],
        searchRecommendTokens: [],
        refreshInterval: 30,
        minLiquidity: 0,
      },
    });
    await refresh;
  });
  expect(screen.queryByTestId('favorite-list')).toBeNull();
  expect(screen.getByText(ETranslations.global_no_data)).toBeTruthy();
});

it('switches directly to preloaded recommendations when the last favorite is removed', async () => {
  mockShowFavorites = true;
  mockRecommendationResult = [
    { ...mockRecord, assetId: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  ];
  getWatchList.mockResolvedValue({
    data: [{ assetId: 'bitcoin', chainId: '', contractAddress: '' }],
  });
  fetchListingQuote.mockResolvedValue({
    symbol: 'BTC',
    name: 'Bitcoin',
    logoUrl: '',
  });
  render(<PopularTrading tableLayout />);
  await act(async () => mockRefreshFavorites());
  getWatchList.mockResolvedValue({ data: [] });
  await act(async () => mockRefreshFavorites());
  expect(screen.queryByTestId('favorite-list')).toBeNull();
  expect(screen.queryByText(ETranslations.global_no_data)).toBeNull();
  expect(screen.getByText('Ethereum')).toBeTruthy();
});

it('resolves the asset before opening and reports an async extension open failure once', async () => {
  openDetail.mockRejectedValueOnce(new Error('open failed'));
  render(<PopularTrading tableLayout />);
  await act(async () => {
    fireEvent.click(screen.getByText('Open token'));
  });
  expect(openDetail).toHaveBeenCalledWith(
    expect.objectContaining({
      network: 'btc',
      tokenAddress: '',
      isNative: true,
      marketTokenId: 'bitcoin',
    }),
  );
  expect(Toast.error).toHaveBeenCalledTimes(1);
});

it('does not show an error for an older click after a newer selection succeeds', async () => {
  let rejectFirst: (error: Error) => void = () => undefined;
  openDetail.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectFirst = reject;
      }),
  );
  render(<PopularTrading tableLayout />);
  await act(async () => {
    fireEvent.click(screen.getByText('Open token'));
  });
  await act(async () => {
    fireEvent.click(screen.getByText('Open token'));
  });
  await act(async () => {
    rejectFirst(new Error('late failure'));
  });
  expect(openDetail).toHaveBeenCalledTimes(2);
  expect(Toast.error).not.toHaveBeenCalled();
});

it('does not display an error when the extension detail opens successfully', async () => {
  render(<PopularTrading tableLayout />);
  await act(async () => {
    fireEvent.click(screen.getByText('Open token'));
  });
  expect(openDetail).toHaveBeenCalledTimes(1);
  expect(Toast.error).not.toHaveBeenCalled();
});
