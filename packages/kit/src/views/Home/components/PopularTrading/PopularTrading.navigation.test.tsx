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
let mockUseRealPromiseResult = false;
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual(
    '../../../../../../components/src/hooks/useDeferredPromise',
  ) as typeof import('@onekeyhq/components/src/hooks/useDeferredPromise');
  const Stack = ({
    children,
    minHeight,
    height,
    testID,
    onPress,
    disabled,
  }: PropsWithChildren<{
    minHeight?: number;
    height?: number;
    testID?: string;
    onPress?: () => void;
    disabled?: boolean;
  }>) =>
    onPress ? (
      <button
        type="button"
        data-testid={testID}
        style={{ minHeight, height }}
        onClick={onPress}
        disabled={disabled}
      >
        {children}
      </button>
    ) : (
      <div data-testid={testID} style={{ minHeight, height }}>
        {children}
      </div>
    );
  return {
    Stack,
    XStack: Stack,
    YStack: Stack,
    SizableText: Stack,
    Button: Stack,
    Icon: ({ name }: { name: string }) =>
      name === 'CheckRadioSolid' ? (
        <span data-testid="recommend-selected" />
      ) : null,
    IconButton: () => null,
    useMedia: () => ({ md: false }),
    Toast: { error: jest.fn(), success: jest.fn() },
    rootNavigationRef: { current: { navigate: jest.fn() } },
    getSharedButtonStyles: () => ({ sharedFrameStyles: {} }),
    useDeferredPromise,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useNetInfo: () => ({ isRawInternetReachable: true }),
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
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { dex: { watchlist: { dexAddToWatchlist: jest.fn() } } },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: { openExtensionMarketTokenDetail: jest.fn() },
    serviceMarket: { fetchMarketAssetDetail: jest.fn() },
    serviceMarketV2: {
      getMarketWatchListV2: jest.fn(),
      fetchMarketBasicConfig: jest.fn(),
      fetchMarketListingWatchlistQuote: jest.fn(),
      addMarketWatchListV2: jest.fn(),
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
    if (mockUseRealPromiseResult) {
      const { usePromiseResult: actualImplementation } = jest.requireActual(
        '@onekeyhq/kit/src/hooks/usePromiseResult',
      ) as typeof import('@onekeyhq/kit/src/hooks/usePromiseResult');
      return actualImplementation(method, _deps, options);
    }
    return {
      isLoading: false,
      run: jest.fn(),
      result: options?.watchLoading ? undefined : mockRecommendationResult,
    };
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
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
  buildHomeRecommendAddSortIndexes: () => [1000, 1001, 1002, 1003],
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
const addWatchList = jest.spyOn(
  backgroundApiProxy.serviceMarketV2,
  'addMarketWatchListV2',
);
beforeEach(() => {
  jest.clearAllMocks();
  mockShowFavorites = false;
  mockRecommendationResult = undefined;
  mockUseRealPromiseResult = false;
  getWatchList.mockReset().mockResolvedValue({ data: [] });
  fetchRecommendations.mockReset();
  fetchListingQuote.mockReset();
  addWatchList.mockReset().mockResolvedValue(undefined);
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

afterEach(() => {
  jest.useRealTimers();
});

it('reserves the same content space when switching from a category to empty favorites in table layout', async () => {
  mockRecommendationResult = [mockRecord];
  const view = render(<PopularTrading tableLayout />);
  const content = screen.getByTestId('home-market-content');
  const height = content.style.minHeight;
  expect(Number.parseFloat(height)).toBeGreaterThan(0);
  expect(screen.getByText('Open token')).toBeTruthy();
  mockShowFavorites = true;
  view.rerender(<PopularTrading tableLayout />);
  await act(async () => mockRefreshFavorites());
  expect(screen.queryByText('Open token')).toBeNull();
  expect(screen.getByTestId('home-header-actions-btn')).toBeTruthy();
  expect(screen.getByText('Bitcoin').closest('[style*="min-height"]')).toBe(
    content,
  );
  expect(screen.getByTestId('home-market-content')).toBe(content);
  expect(content.style.minHeight).toBe(height);
});

it('does not reserve table height for mobile recommendation cards', async () => {
  mockShowFavorites = true;
  mockRecommendationResult = [mockRecord];
  const view = render(<PopularTrading />);
  await act(async () => mockRefreshFavorites());
  const content = screen.getByTestId('home-market-content');
  expect(content.style.minHeight).toBe('');
  expect(screen.getByText('Bitcoin')).toBeTruthy();
  expect(
    screen.getByTestId('home-header-actions-btn').hasAttribute('disabled'),
  ).toBe(false);
  view.unmount();
});

it.each(
  [1, 2, 3, 4].flatMap((count) => [
    { count, tableLayout: true },
    { count, tableLayout: false },
  ]),
)(
  'sizes $count favorites to their content in table layout $tableLayout',
  async ({ count, tableLayout }) => {
    mockShowFavorites = true;
    getWatchList.mockResolvedValue({
      data: Array.from({ length: count }, (_, index) => ({
        assetId: `asset-${index}`,
        chainId: '',
        contractAddress: '',
      })),
    });
    render(<PopularTrading tableLayout={tableLayout} />);
    await act(async () => mockRefreshFavorites());

    const list = screen.getByTestId('favorite-list');
    expect(list.textContent).toBe(
      Array.from(
        { length: Math.min(count, 3) },
        (_, index) => `asset-${index}`,
      ).join(', '),
    );
    expect(list.closest('[style*="min-height"]')).toBeNull();
    expect(
      screen
        .getByTestId('home-market-content')
        .querySelector('[style*="height: 50px"]'),
    ).toBeNull();
    expect(
      Boolean(screen.queryByTestId('home-show-view-more-button-btn')),
    ).toBe(count > 3);
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

it('clears removed favorites even when recommendations fail before the preload succeeds', async () => {
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
  fetchRecommendations.mockRejectedValue(new Error('offline'));
  await act(async () => mockRefreshFavorites());
  expect(screen.queryByTestId('favorite-list')).toBeNull();
  expect(screen.getByText(ETranslations.global_no_data)).toBeTruthy();
});

describe('recommendation refresh lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseRealPromiseResult = true;
    mockShowFavorites = true;
    fetchRecommendations.mockResolvedValue({
      data: { recommendTokens: [{ assetId: 'ethereum' }] },
    } as IMarketBasicConfigResponse);
    fetchListingQuote.mockResolvedValue({
      symbol: 'ETH',
      name: 'Ethereum',
      logoUrl: '',
    });
  });

  it('refreshes recommendations after preloading and retains them during a failed poll', async () => {
    const view = render(<PopularTrading tableLayout />);
    await act(async () => jest.advanceTimersByTimeAsync(0));
    expect(screen.getByText('Ethereum')).toBeTruthy();

    fetchListingQuote.mockResolvedValue({
      symbol: 'SOL',
      name: 'Solana',
      logoUrl: '',
    });
    fetchRecommendations.mockResolvedValue({
      data: { recommendTokens: [{ assetId: 'solana' }] },
    } as IMarketBasicConfigResponse);
    await act(async () => jest.advanceTimersByTimeAsync(30_000));
    expect(screen.getByText('Solana')).toBeTruthy();
    expect(screen.queryByText('Ethereum')).toBeNull();

    fetchRecommendations.mockRejectedValue(new Error('offline'));
    await act(async () => jest.advanceTimersByTimeAsync(30_000));
    expect(screen.getByText('Solana')).toBeTruthy();
    expect(screen.queryByText(ETranslations.global_no_data)).toBeNull();
    view.unmount();
  });

  it('isolates failed optional preloads while showing favorites', async () => {
    getWatchList.mockResolvedValue({
      data: [{ assetId: 'bitcoin', chainId: '', contractAddress: '' }],
    });
    fetchListingQuote.mockResolvedValue({
      symbol: 'BTC',
      name: 'Bitcoin',
      logoUrl: '',
    });
    const error = Object.assign(new Error('recommendations unavailable'), {
      autoToast: true,
    });
    fetchRecommendations.mockRejectedValue(error);
    const view = render(<PopularTrading tableLayout />);
    await act(async () => jest.advanceTimersByTimeAsync(0));
    expect(screen.getByTestId('favorite-list').textContent).toBe('BTC');
    expect(error.autoToast).toBe(false);
    expect(Toast.error).not.toHaveBeenCalled();
    view.unmount();
  });
});

describe('recommendation selection during refresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseRealPromiseResult = true;
    mockShowFavorites = true;
    fetchRecommendations.mockResolvedValue({
      data: {
        recommendTokens: [{ assetId: 'ethereum' }, { assetId: 'solana' }],
      },
    } as IMarketBasicConfigResponse);
    fetchListingQuote.mockImplementation(async ({ assetId }) => ({
      symbol: assetId === 'ethereum' ? 'ETH' : 'SOL',
      name: assetId === 'ethereum' ? 'Ethereum' : 'Solana',
      logoUrl: '',
      price: '1',
    }));
  });

  it.each([true, false])(
    'keeps a deselected recommendation out of Add after polling in table layout %p',
    async (tableLayout) => {
      const view = render(<PopularTrading tableLayout={tableLayout} />);
      await act(async () => jest.advanceTimersByTimeAsync(0));
      expect(screen.getAllByTestId('recommend-selected')).toHaveLength(2);
      fireEvent.click(screen.getByText('Ethereum'));
      expect(screen.getAllByTestId('recommend-selected')).toHaveLength(1);

      await act(async () => jest.advanceTimersByTimeAsync(30_000));
      expect(screen.getAllByTestId('recommend-selected')).toHaveLength(1);
      await act(async () =>
        fireEvent.click(screen.getByTestId('home-header-actions-btn')),
      );
      expect(addWatchList).toHaveBeenCalledTimes(1);
      expect(addWatchList).toHaveBeenCalledWith({
        callerName: 'PopularTrading',
        watchList: [expect.objectContaining({ assetId: 'solana' })],
      });
      expect(Toast.error).not.toHaveBeenCalled();
      view.unmount();
    },
  );

  it('keeps all recommendations deselected after polling', async () => {
    const view = render(<PopularTrading tableLayout />);
    await act(async () => jest.advanceTimersByTimeAsync(0));
    fireEvent.click(screen.getByText('Ethereum'));
    fireEvent.click(screen.getByText('Solana'));
    expect(screen.queryAllByTestId('recommend-selected')).toHaveLength(0);
    await act(async () => jest.advanceTimersByTimeAsync(30_000));
    expect(screen.queryAllByTestId('recommend-selected')).toHaveLength(0);
    expect(
      screen.getByTestId('home-header-actions-btn').hasAttribute('disabled'),
    ).toBe(true);
    await act(async () =>
      fireEvent.click(screen.getByTestId('home-header-actions-btn')),
    );
    expect(addWatchList).not.toHaveBeenCalled();
    view.unmount();
  });

  it('selects newly recommended tokens while preserving deselections and dropping removed tokens', async () => {
    const view = render(<PopularTrading tableLayout />);
    await act(async () => jest.advanceTimersByTimeAsync(0));
    fireEvent.click(screen.getByText('Ethereum'));
    fetchRecommendations.mockResolvedValue({
      data: {
        recommendTokens: [{ assetId: 'ethereum' }, { assetId: 'bitcoin' }],
      },
    } as IMarketBasicConfigResponse);
    fetchListingQuote.mockImplementation(async ({ assetId }) => ({
      symbol: assetId ?? '',
      name: assetId ?? '',
      logoUrl: '',
    }));
    await act(async () => jest.advanceTimersByTimeAsync(30_000));
    expect(screen.getAllByTestId('recommend-selected')).toHaveLength(1);
    await act(async () =>
      fireEvent.click(screen.getByTestId('home-header-actions-btn')),
    );
    expect(addWatchList).toHaveBeenCalledWith({
      callerName: 'PopularTrading',
      watchList: [expect.objectContaining({ assetId: 'bitcoin' })],
    });
    view.unmount();
  });
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
