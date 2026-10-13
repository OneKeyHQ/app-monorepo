/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import {
  MobileSelectorCategoryTokenList,
  MobileSelectorSearchTokenRow,
  MobileSelectorStockTable,
  MobileSelectorTopCoinsList,
  MobileSelectorWatchlistList,
} from './MobileMarketSelectorBrowseLists';

import type { useMarketStockSelectorList } from './useMarketStockSelectorList';
import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

const mockRefreshWatchListV2 = jest.fn(() => Promise.resolve());
const mockRefetch = jest.fn(() => Promise.resolve());
let mockListState: { isError: boolean } = { isError: false };
const mockLoadMore = jest.fn(() => Promise.resolve());
let mockBrowseData: IMarketToken[] = [];
let mockIsLoadMoreError = false;
let mockWatchlistCount = 0;
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
  }: {
    data: unknown[];
    renderItem: (info: { item: unknown }) => ReactNode;
    ListFooterComponent?: ReactNode;
    onEndReached?: () => void;
  }) => (
    <div>
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
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
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
    Spinner: () => null,
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
    { data: Array.from({ length: mockWatchlistCount }, () => ({})) },
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
      isLoading: false,
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
jest.mock('../../utils/marketDetailImagePreload', () => ({
  prewarmMarketTokenImages: jest.fn(),
}));
jest.mock('./selectorStar', () => ({
  SelectorTokenStar: () => null,
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
});
