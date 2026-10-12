/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { MobileMarketTokenSelectorSearchResults } from './MobileMarketTokenSelectorSearchResults';

const mockStockPress = jest.fn();
const mockMarketPress = jest.fn();
const mockLoadMore = jest.fn(() => Promise.resolve());
type IMockStockSelectorResult = {
  items: IMarketStockPublicItem[];
  isLoading: boolean;
  isError: boolean;
  isLoadingMore: boolean;
  isLoadMoreError: boolean;
  canLoadMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => void;
};
const mockUseMarketStockSelectorList = jest.fn<
  IMockStockSelectorResult,
  [{ query: string; searchOnly?: boolean }]
>();

const stock: IMarketStockPublicItem = {
  stockId: 'AAPL',
  symbol: 'AAPL',
  name: 'Apple',
  logoUrl: '',
  assetType: 'stock',
  currency: 'USD',
};
const marketItem = {
  name: 'AAPL xStock',
  price: '100',
  symbol: 'AAPLx',
  address: '0xaapl',
  network: 'evm--1',
  logoUrl: '',
  isNative: false,
  decimals: 18,
  liquidity: '1000',
  volume_24h: '500',
  networkLogoURI: '',
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const Container = ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) =>
    onPress ? (
      <button data-testid={testID} type="button" onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  return {
    Button: Container,
    Empty: () => <div data-testid="empty" />,
    ScrollView: Container,
    SizableText: Container,
    XStack: Container,
    YStack: Container,
  };
});

jest.mock('react-native', () => ({
  FlatList: ({
    data,
    renderItem,
  }: {
    data: unknown[];
    renderItem: (info: { item: unknown }) => ReactNode;
  }) => <div>{data.map((item) => renderItem({ item }))}</div>,
}));

// Rows render as plain buttons so the tests can press them by id.
jest.mock('./MobileMarketSelectorBrowseLists', () => {
  const StockButton = ({
    item,
    onPress,
  }: {
    item: IMarketStockPublicItem;
    onPress: (item: IMarketStockPublicItem) => void;
  }) => (
    <button
      data-testid={`mobile-stock-${item.stockId}`}
      type="button"
      onClick={() => onPress(item)}
    >
      {item.symbol}
    </button>
  );
  return {
    MobileSelectorSearchSkeleton: () => <div data-testid="skeleton" />,
    MobileSelectorStockRow: StockButton,
    MobileSelectorStockTable: ({
      result,
      onItemPress,
    }: {
      result: { items: IMarketStockPublicItem[] };
      onItemPress: (item: IMarketStockPublicItem) => void;
    }) => (
      <div>
        {result.items.map((item) => (
          <StockButton key={item.stockId} item={item} onPress={onItemPress} />
        ))}
      </div>
    ),
    MobileSelectorSearchTokenRow: ({
      item,
      onPress,
    }: {
      item: { networkId: string; address: string; symbol: string };
      onPress: () => void;
    }) => (
      <button
        data-testid={`mobile-market-${item.networkId}:${item.address}`}
        type="button"
        onClick={onPress}
      >
        {item.symbol}
      </button>
    ),
  };
});

jest.mock('./useMarketStockSelectorList', () => ({
  useMarketStockSelectorList: (options: { query: string }) =>
    mockUseMarketStockSelectorList(options),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [{ data: [] }],
}));

describe('MobileMarketTokenSelectorSearchResults', () => {
  beforeEach(() => {
    mockStockPress.mockReset();
    mockMarketPress.mockReset();
    mockLoadMore.mockClear();
    mockUseMarketStockSelectorList.mockReset();
    mockUseMarketStockSelectorList.mockReturnValue({
      items: [stock],
      isLoading: false,
      isError: false,
      isLoadingMore: false,
      isLoadMoreError: false,
      canLoadMore: false,
      loadMore: mockLoadMore,
      refresh: jest.fn(),
    });
  });

  it('keeps stock and on-chain market rows on separate tabs', () => {
    render(
      <MobileMarketTokenSelectorSearchResults
        query="aapl"
        marketItems={[marketItem]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    expect(
      screen.getAllByText('global.universal_search_tabs_tokens').length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('mobile-market-evm--1:0xaapl'));
    expect(mockMarketPress).toHaveBeenCalledWith(marketItem);
    fireEvent.click(
      screen.getByTestId('market-token-selector-search-tab-stocks'),
    );
    fireEvent.click(screen.getByTestId('mobile-stock-AAPL'));
    expect(mockStockPress).toHaveBeenCalledWith(stock);
  });

  it('filters mobile rows with the shared search tabs', () => {
    render(
      <MobileMarketTokenSelectorSearchResults
        query="aapl"
        marketItems={[marketItem]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    fireEvent.click(
      screen.getByTestId('market-token-selector-search-tab-stocks'),
    );
    expect(screen.getByTestId('mobile-stock-AAPL')).toBeTruthy();
    expect(screen.queryByTestId('mobile-market-evm--1:0xaapl')).toBeNull();

    fireEvent.click(
      screen.getByTestId('market-token-selector-search-tab-tokens'),
    );
    expect(screen.queryByTestId('mobile-stock-AAPL')).toBeNull();
    expect(screen.getByTestId('mobile-market-evm--1:0xaapl')).toBeTruthy();
  });

  it('previews five per section and jumps to the tab on Show more', () => {
    const tokens = ['1', '2', '3', '4', '5', '6'].map((suffix) => ({
      ...marketItem,
      address: `0x${suffix}`,
    }));
    render(
      <MobileMarketTokenSelectorSearchResults
        query="aapl"
        marketItems={tokens}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    expect(screen.getByTestId('mobile-market-evm--1:0x5')).toBeTruthy();
    expect(screen.queryByTestId('mobile-market-evm--1:0x6')).toBeNull();
    fireEvent.click(
      screen.getByTestId(
        'mobile-market-token-selector-market-search-show-more',
      ),
    );
    expect(screen.getByTestId('mobile-market-evm--1:0x6')).toBeTruthy();
    expect(screen.queryByTestId('mobile-stock-AAPL')).toBeNull();
  });

  it('shows one skeleton until both searches answer', () => {
    render(
      <MobileMarketTokenSelectorSearchResults
        query="aapl"
        marketItems={[]}
        isMarketLoading
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    expect(screen.getByTestId('skeleton')).toBeTruthy();
    expect(screen.queryByTestId('mobile-stock-AAPL')).toBeNull();
    expect(
      screen.queryByTestId('market-token-selector-search-tab-stocks'),
    ).toBeNull();
  });

  it('asks the stock hook for search-only results', () => {
    render(
      <MobileMarketTokenSelectorSearchResults
        query="   "
        marketItems={[]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    expect(mockUseMarketStockSelectorList).toHaveBeenCalledWith({
      query: '   ',
      searchOnly: true,
    });
  });
});
