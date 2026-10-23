/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  MobileSelectorCategoryTokenList,
  MobileSelectorSearchTokenRow,
  MobileSelectorStockTable,
  MobileSelectorTopCoinsList,
  MobileSelectorWatchlistList,
} from './MobileMarketSelectorBrowseLists';

import type { useMarketStockSelectorList } from './useMarketStockSelectorList';
import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

const mockRefreshWatchListV2 = jest.fn(() => Promise.resolve());
const mockRefetch = jest.fn(() => Promise.resolve());
let mockListState: { isError: boolean } = { isError: false };
const mockLoadMore = jest.fn(() => Promise.resolve());
let mockBrowseData: IMarketToken[] = [];
let mockIsLoadMoreError = false;
let mockWatchlistCount = 0;
let mockIsMounted = true;
let mockIsWatchlistLoading = false;
const mockEventHandlers = new Map<string, () => Promise<void>>();
const mockOn = jest.fn((name: string, handler: () => Promise<void>) => {
  mockEventHandlers.set(name, handler);
});
const mockOff = jest.fn((name: string) => {
  mockEventHandlers.delete(name);
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('react-native', () => ({
  FlatList: ({
    data,
    renderItem,
    ListFooterComponent,
    onEndReached,
    keyboardDismissMode,
  }: {
    data: unknown[];
    renderItem: (info: { item: unknown }) => ReactNode;
    ListFooterComponent?: ReactNode;
    onEndReached?: () => void;
    keyboardDismissMode?: string;
  }) => (
    <div data-testid="browse-list" data-keyboard-mode={keyboardDismissMode}>
      {data.map((item, index) => (
        <div key={index}>{renderItem({ item })}</div>
      ))}
      {ListFooterComponent}
      <button type="button" onClick={onEndReached}>
        Reach end
      </button>
    </div>
  ),
}));

jest.mock('@onekeyhq/components', () => {
  const Container = ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <div role="presentation" onClick={onPress}>
      {children}
    </div>
  );
  return {
    Badge: Object.assign(Container, { Text: Container }),
    Button: ({
      children,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button data-testid={testID} type="button" onClick={onPress}>
        {children}
      </button>
    ),
    NumberSizeableText: ({ children }: { children?: ReactNode }) => (
      <span data-testid="number">{children}</span>
    ),
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Skeleton: () => null,
    Spinner: () => <div role="progressbar" />,
    Stack: Container,
    XStack: Container,
    YStack: Container,
  };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));
jest.mock('@onekeyhq/kit/src/hooks/useNetworkLogoUri', () => ({
  useNetworkLogoUri: () => undefined,
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [
    {
      data: Array.from({ length: mockWatchlistCount }, () => ({})),
      isMounted: mockIsMounted,
    },
  ],
  useWatchListV2Actions: () => ({
    current: { refreshWatchListV2: mockRefreshWatchListV2 },
  }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/MarketStockStar',
  () => ({ MarketStockStar: () => null }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/utils',
  () => ({ parseMarketStockNumber: () => undefined }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketHomeTokenListWebSocket',
  () => ({ applyMarketTokenListLiveOverrides: () => [] }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenList',
  () => ({
    useMarketTokenList: () => ({
      data: mockBrowseData,
      isLoading: false,
      isError: mockListState.isError,
      isLoadMoreError: mockIsLoadMoreError,
      isLoadingMore: false,
      canLoadMore: true,
      loadMore: mockLoadMore,
      refetch: mockRefetch,
    }),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketWatchlistTokenList',
  () => ({
    useMarketWatchlistTokenList: ({ pageSize }: { pageSize: number }) => ({
      data: mockBrowseData.slice(0, pageSize),
      isLoading: mockIsWatchlistLoading,
      isError: mockListState.isError,
      refetch: mockRefetch,
    }),
  }),
);
jest.mock('@onekeyhq/kit/src/views/Market/MarketHomeV2/utils', () => ({
  isTrendingStyleSpotCategory: () => false,
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    RefreshMarketWatchList: 'RefreshMarketWatchList',
    MarketWatchListV2Changed: 'MarketWatchListV2Changed',
  },
  appEventBus: {
    on: (name: string, handler: () => Promise<void>) => mockOn(name, handler),
    off: (name: string) => mockOff(name),
  },
}));
jest.mock('../../../components/CommunityRecognizedBadge', () => ({
  CommunityRecognizedBadge: () => null,
}));
jest.mock('../../../components/MarketListingStar', () => ({
  MarketListingStar: () => null,
}));
jest.mock('../../../components/PerpsBadges', () => ({
  LeverageBadge: ({ leverage }: { leverage: number }) => (
    <span>{`${leverage}x`}</span>
  ),
  PerpDexBadge: ({ dexLabel }: { dexLabel?: string }) =>
    dexLabel ? <span>{dexLabel}</span> : null,
}));
jest.mock('../../utils/marketDetailImagePreload', () => ({
  prewarmMarketTokenImages: jest.fn(),
}));
jest.mock('./selectorStar', () => ({
  SelectorTokenStar: () => null,
}));
jest.mock('./SelectorWatchlistRecommendations', () => ({
  SelectorWatchlistRecommendations: () => (
    <div data-testid="recommendations">Recommend tokens</div>
  ),
}));

jest.mock('./useMarketStockSelectorList', () => ({
  useMarketStockSelectorList: () => ({ items: [] }),
}));

const searchToken: IMarketToken = {
  id: 'evm--1_0xaapl',
  name: 'Apple xStock',
  symbol: 'AAPLx',
  address: '0xaapl',
  decimals: 18,
  price: 100,
  change24h: 0,
  marketCap: 0,
  liquidity: 1000,
  transactions: 0,
  uniqueTraders: 0,
  holders: 0,
  turnover: 500,
  tokenImageUri: '',
  networkLogoUri: '',
  networkId: 'evm--1',
};

describe('MobileSelectorSearchTokenRow price change', () => {
  // The price renders through NumberSizeableText too, so the change is the
  // second number when present.
  it('shows -- when the feed omits the change', () => {
    render(
      <MobileSelectorSearchTokenRow
        item={{ ...searchToken, priceChangeRaw: undefined }}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getAllByTestId('number')).toHaveLength(1);
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });

  it("shows -- when the feed sends '-'", () => {
    render(
      <MobileSelectorSearchTokenRow
        item={{ ...searchToken, priceChangeRaw: '-' }}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getAllByTestId('number')).toHaveLength(1);
  });

  it("keeps a real '0' as a number", () => {
    render(
      <MobileSelectorSearchTokenRow
        item={{ ...searchToken, priceChangeRaw: '0' }}
        onPress={jest.fn()}
      />,
    );
    const numbers = screen.getAllByTestId('number');
    expect(numbers).toHaveLength(2);
    expect(numbers[1]?.textContent).toBe('0');
  });
});

describe('MobileSelectorWatchlistList', () => {
  beforeEach(() => {
    mockRefreshWatchListV2.mockClear();
    mockOn.mockClear();
    mockOff.mockClear();
    mockEventHandlers.clear();
  });

  it('refreshes the watchlist on watchlist events until unmounted', async () => {
    const { unmount } = render(
      <MobileSelectorWatchlistList onItemPress={jest.fn()} />,
    );

    expect([...mockEventHandlers.keys()].toSorted()).toEqual([
      'MarketWatchListV2Changed',
      'RefreshMarketWatchList',
    ]);
    await mockEventHandlers.get('MarketWatchListV2Changed')?.();
    expect(mockRefreshWatchListV2).toHaveBeenCalledTimes(1);

    unmount();
    expect(mockEventHandlers.size).toBe(0);
  });
});

describe('mobile selector list load failures', () => {
  beforeEach(() => {
    mockRefetch.mockClear();
    mockListState = { isError: true };
  });

  afterAll(() => {
    mockListState = { isError: false };
  });

  it('offers a retry when Favorites fail to load', () => {
    render(<MobileSelectorWatchlistList onItemPress={jest.fn()} />);

    expect(screen.queryByText('market.favorites_empty')).toBeNull();
    fireEvent.click(
      screen.getByTestId('mobile-market-token-selector-favorites-retry'),
    );
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('offers a retry when a token category fails to load', () => {
    render(
      <MobileSelectorCategoryTokenList
        category="trending"
        timeRange="24h"
        onItemPress={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByTestId('mobile-market-token-selector-category-retry'),
    );
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});

describe('mobile selector review regressions', () => {
  beforeEach(() => {
    mockListState = { isError: false };
    mockBrowseData = [];
    mockIsLoadMoreError = false;
    mockWatchlistCount = 0;
    mockLoadMore.mockClear();
  });

  it('offers a retry for an empty failed Top Coins list', () => {
    const retry = jest.fn();
    render(
      <MobileSelectorTopCoinsList
        data={[]}
        isLoading={false}
        isError
        onRetry={retry}
        onItemPress={jest.fn()}
      />,
    );
    fireEvent.click(
      screen.getByTestId('mobile-market-token-selector-top-coins-retry'),
    );
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keeps favorites beyond the first 100 rows available', () => {
    mockWatchlistCount = 101;
    mockBrowseData = Array.from({ length: 101 }, (_, index) => ({
      ...searchToken,
      id: String(index),
      symbol: `TOKEN${index}`,
    }));
    render(<MobileSelectorWatchlistList onItemPress={jest.fn()} />);
    expect(screen.getByText('TOKEN100')).toBeTruthy();
  });

  it('keeps token rows visible and retries a failed page on demand', () => {
    mockBrowseData = [searchToken];
    mockIsLoadMoreError = true;
    render(
      <MobileSelectorCategoryTokenList
        category="trending"
        timeRange="24h"
        onItemPress={jest.fn()}
      />,
    );
    expect(screen.getByText('AAPLx')).toBeTruthy();
    fireEvent.click(screen.getByText('Reach end'));
    expect(mockLoadMore).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByTestId(
        'mobile-market-token-selector-category-load-more-retry',
      ),
    );
    expect(mockLoadMore).toHaveBeenCalledTimes(1);
  });

  it('keeps stock rows visible and retries a failed page on demand', () => {
    const result: ReturnType<typeof useMarketStockSelectorList> = {
      items: [
        {
          stockId: 'AAPL',
          symbol: 'AAPL',
          name: 'Apple',
          logoUrl: '',
          assetType: 'stock',
          currency: 'USD',
        },
      ],
      total: 2,
      isLoading: false,
      isError: false,
      isLoadingMore: false,
      isLoadMoreError: true,
      isImagePrewarming: false,
      canLoadMore: true,
      isRevalidatingFirstPage: false,
      loadMore: mockLoadMore,
      refresh: jest.fn(),
    };
    render(
      <MobileSelectorStockTable result={result} onItemPress={jest.fn()} />,
    );
    expect(screen.getByText('AAPL')).toBeTruthy();
    fireEvent.click(screen.getByText('Reach end'));
    expect(mockLoadMore).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByTestId('mobile-market-token-selector-stock-load-more-retry'),
    );
    expect(mockLoadMore).toHaveBeenCalledTimes(1);
  });

  it.each([
    { isLoadingMore: false, isLoadMoreError: false, calls: 1 },
    { isLoadingMore: true, isLoadMoreError: false, calls: 0 },
    { isLoadingMore: false, isLoadMoreError: true, calls: 0 },
  ])(
    'queues cached stock pagination during revalidation: %j',
    ({ isLoadingMore, isLoadMoreError, calls }) => {
      const result: ReturnType<typeof useMarketStockSelectorList> = {
        items: Array.from({ length: 20 }, (_, index) => ({
          stockId: `stock-${index}`,
          symbol: `STOCK${index}`,
          name: `Stock ${index}`,
          logoUrl: '',
          assetType: 'stock',
          currency: 'USD',
        })),
        total: 21,
        isLoading: false,
        isError: false,
        isLoadingMore,
        isLoadMoreError,
        isImagePrewarming: false,
        canLoadMore: false,
        isRevalidatingFirstPage: true,
        loadMore: mockLoadMore,
        refresh: jest.fn(),
      };
      render(
        <MobileSelectorStockTable result={result} onItemPress={jest.fn()} />,
      );

      fireEvent.click(screen.getByText('Reach end'));

      expect(mockLoadMore).toHaveBeenCalledTimes(calls);
    },
  );
});

describe('mobile selector recommendations', () => {
  beforeEach(() => {
    mockBrowseData = [];
    mockWatchlistCount = 0;
    mockListState = { isError: false };
    mockIsMounted = true;
    mockIsWatchlistLoading = false;
  });
  afterEach(() => {
    mockIsMounted = true;
    mockIsWatchlistLoading = false;
  });

  it('shows recommendations for an empty Favorites tab and replaces them with added rows', () => {
    const onItemPress = jest.fn();
    const { rerender } = render(
      <MobileSelectorWatchlistList onItemPress={onItemPress} />,
    );
    expect(screen.getByTestId('recommendations')).toBeTruthy();
    mockWatchlistCount = 1;
    mockBrowseData = [searchToken];
    rerender(<MobileSelectorWatchlistList onItemPress={onItemPress} />);
    expect(screen.queryByTestId('recommendations')).toBeNull();
    expect(screen.getByText('AAPLx')).toBeTruthy();
    expect(onItemPress).not.toHaveBeenCalled();
  });

  it('lists perps favorites instead of recommendations', () => {
    mockWatchlistCount = 1;
    mockBrowseData = [
      {
        ...searchToken,
        symbol: 'BTC',
        perpsCoin: 'xyz:BTC',
        perpsSubtitle: 'Bitcoin',
        maxLeverage: 40,
        priceChangeRaw: undefined,
        change24h: -1.9,
      },
    ];
    render(<MobileSelectorWatchlistList onItemPress={jest.fn()} />);
    expect(screen.queryByTestId('recommendations')).toBeNull();
    expect(screen.getByText('BTC')).toBeTruthy();
    expect(screen.getByText('40x')).toBeTruthy();
    expect(screen.getByText('xyz')).toBeTruthy();
    expect(screen.getByText('Bitcoin')).toBeTruthy();
    // A perp's change has no `priceChangeRaw` and still renders as a number.
    expect(screen.getByText('-1.9')).toBeTruthy();
  });

  it('shows no results, not recommendations, on an empty Perps view', () => {
    mockWatchlistCount = 0;
    mockBrowseData = [];
    render(
      <MobileSelectorWatchlistList
        watchlistFilter="perps"
        onItemPress={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('recommendations')).toBeNull();
  });

  it.each(['initializing', 'loading', 'error'])(
    'does not show recommendations while %s',
    (state) => {
      mockIsMounted = state !== 'initializing';
      mockIsWatchlistLoading = state === 'loading';
      mockListState = { isError: state === 'error' };
      render(<MobileSelectorWatchlistList onItemPress={jest.fn()} />);
      expect(screen.queryByTestId('recommendations')).toBeNull();
    },
  );
});

describe('mobile Favorites categories', () => {
  beforeEach(() => {
    mockListState = { isError: false };
    mockIsMounted = true;
    mockIsWatchlistLoading = false;
    mockBrowseData = [
      {
        ...searchToken,
        id: 'btc',
        symbol: 'BTC',
        assetId: 'bitcoin',
        address: '',
        networkId: '',
      },
      { ...searchToken, id: 'aapl', symbol: 'AAPL', stockId: 'AAPL' },
      {
        ...searchToken,
        id: 'nvda',
        symbol: 'NVDAx',
        stock: { subtitle: 'NVIDIA', source: 'xstock', sourceLogoUri: '' },
      },
      { ...searchToken, id: 'eth', symbol: 'ETH', isNative: true, address: '' },
      { ...searchToken, id: 'perp', symbol: 'PERP', perpsCoin: 'BTC' },
    ];
    mockWatchlistCount = mockBrowseData.length;
  });

  it.each([
    ['all', ['BTC', 'AAPL', 'NVDAx', 'ETH', 'PERP']],
    ['spot', ['BTC', 'ETH']],
    ['stocks', ['AAPL', 'NVDAx']],
    ['perps', ['PERP']],
  ] as const)(
    'shows only %s favorites and keeps row navigation intact',
    (filter, expected) => {
      const onItemPress = jest.fn();
      render(
        <MobileSelectorWatchlistList
          watchlistFilter={filter}
          onItemPress={onItemPress}
        />,
      );
      for (const item of mockBrowseData) {
        expect(Boolean(screen.queryByText(item.symbol))).toBe(
          expected.some((symbol) => symbol === item.symbol),
        );
      }
      fireEvent.click(screen.getByText(expected[0]));
      expect(onItemPress).toHaveBeenCalledWith(
        mockBrowseData.find((item) => item.symbol === expected[0]),
      );
    },
  );

  it('shows an empty result rather than recommendations for an empty category', () => {
    mockBrowseData = [mockBrowseData[0]];
    render(
      <MobileSelectorWatchlistList
        watchlistFilter="stocks"
        onItemPress={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('recommendations')).toBeNull();
    expect(screen.getByText('global.no_results')).toBeTruthy();
  });

  it.each([
    ['stocks', 0],
    ['spot', 1],
  ] as const)(
    'keeps an empty %s category visible while other favorites refresh',
    (filter, itemIndex) => {
      mockBrowseData = [mockBrowseData[itemIndex]];
      mockWatchlistCount = mockBrowseData.length;
      const onItemPress = jest.fn();
      const content = (
        <MobileSelectorWatchlistList
          watchlistFilter={filter}
          onItemPress={onItemPress}
        />
      );
      const { rerender } = render(content);
      expect(screen.getByText('global.no_results')).toBeTruthy();

      mockIsWatchlistLoading = true;
      rerender(
        <MobileSelectorWatchlistList
          watchlistFilter={filter}
          onItemPress={onItemPress}
        />,
      );
      expect(screen.getByText('global.no_results')).toBeTruthy();
      expect(screen.queryByRole('progressbar')).toBeNull();
      expect(screen.queryByTestId('recommendations')).toBeNull();

      mockIsWatchlistLoading = false;
      rerender(content);
      expect(screen.getByText('global.no_results')).toBeTruthy();
    },
  );

  it('shows loading before any favorites have been loaded', () => {
    mockBrowseData = [];
    mockIsWatchlistLoading = true;
    render(
      <MobileSelectorWatchlistList
        watchlistFilter="stocks"
        onItemPress={jest.fn()}
      />,
    );
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText('global.no_results')).toBeNull();
    expect(screen.queryByTestId('recommendations')).toBeNull();
  });

  it.each(['spot', 'stocks'] as const)(
    'uses the correct %s empty state when no favorites exist',
    (filter) => {
      mockBrowseData = [];
      mockWatchlistCount = 0;
      render(
        <MobileSelectorWatchlistList
          watchlistFilter={filter}
          onItemPress={jest.fn()}
        />,
      );
      expect(Boolean(screen.queryByTestId('recommendations'))).toBe(
        filter === 'spot',
      );
    },
  );
});

describe('selector browse keyboard behavior', () => {
  afterEach(() => {
    platformEnv.isNative = false;
  });
  it.each([false, true])(
    'limits scroll dismissal to native=%s across all browse lists',
    (isNative) => {
      platformEnv.isNative = isNative;
      mockBrowseData = [searchToken];
      mockWatchlistCount = 1;
      mockIsMounted = true;
      mockIsWatchlistLoading = false;
      mockListState = { isError: false };
      const onItemPress = jest.fn();
      const { rerender } = render(
        <MobileSelectorWatchlistList onItemPress={onItemPress} />,
      );
      const expectPolicy = () =>
        expect(
          screen.getByTestId('browse-list').getAttribute('data-keyboard-mode'),
        ).toBe(isNative ? 'on-drag' : 'none');
      expectPolicy();
      rerender(
        <MobileSelectorTopCoinsList
          data={[]}
          isLoading={false}
          isError={false}
          onRetry={jest.fn()}
          onItemPress={onItemPress}
        />,
      );
      expectPolicy();
      rerender(
        <MobileSelectorStockTable
          result={{
            items: [],
            total: 0,
            isLoading: false,
            isError: false,
            isLoadingMore: false,
            isLoadMoreError: false,
            isImagePrewarming: false,
            canLoadMore: false,
            isRevalidatingFirstPage: false,
            loadMore: mockLoadMore,
            refresh: jest.fn(),
          }}
          onItemPress={jest.fn()}
        />,
      );
      expectPolicy();
    },
  );
});
