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
    Spinner: () => <div data-testid="spinner" />,
    XStack: Container,
    YStack: Container,
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/MobileMarketStockListItem',
  () => ({
    MobileMarketStockListItem: ({
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
    ),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Swap/pages/components/SwapProSearchTokenListItem',
  () => ({
    __esModule: true,
    default: ({
      item,
      onPress,
    }: {
      item: typeof marketItem;
      onPress: (item: typeof marketItem) => void;
    }) => (
      <button
        data-testid={`mobile-market-${item.network}:${item.address}`}
        type="button"
        onClick={() => onPress(item)}
      >
        {item.symbol}
      </button>
    ),
  }),
);

jest.mock('./useMarketStockSelectorList', () => ({
  useMarketStockSelectorList: (options: { query: string }) =>
    mockUseMarketStockSelectorList(options),
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

  it('keeps stock and on-chain market rows in separate sections', () => {
    render(
      <MobileMarketTokenSelectorSearchResults
        query="aapl"
        marketItems={[marketItem]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    expect(screen.getAllByText('perps.token_selector_stocks')).toHaveLength(2);
    expect(screen.getAllByText('global.market')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('mobile-stock-AAPL'));
    expect(mockStockPress).toHaveBeenCalledWith(stock);
    fireEvent.click(screen.getByTestId('mobile-market-evm--1:0xaapl'));
    expect(mockMarketPress).toHaveBeenCalledWith(marketItem);
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
      screen.getByTestId('market-token-selector-search-tab-market'),
    );
    expect(screen.queryByTestId('mobile-stock-AAPL')).toBeNull();
    expect(screen.getByTestId('mobile-market-evm--1:0xaapl')).toBeTruthy();
  });

  it('loads and retries additional mobile stock search pages', () => {
    const stockResult = {
      items: [stock],
      isLoading: false,
      isError: false,
      isLoadingMore: false,
      isLoadMoreError: false,
      canLoadMore: true,
      loadMore: mockLoadMore,
      refresh: jest.fn(),
    };
    mockUseMarketStockSelectorList.mockReturnValue(stockResult);
    const { rerender } = render(
      <MobileMarketTokenSelectorSearchResults
        query="aapl"
        marketItems={[]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );
    fireEvent.click(
      screen.getByTestId('market-token-selector-search-tab-stocks'),
    );
    fireEvent.click(
      screen.getByTestId('mobile-market-token-selector-stock-search-load-more'),
    );
    expect(mockLoadMore).toHaveBeenCalledTimes(1);

    mockUseMarketStockSelectorList.mockReturnValue({
      ...stockResult,
      isLoadMoreError: true,
    });
    rerender(
      <MobileMarketTokenSelectorSearchResults
        query="aapl"
        marketItems={[]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );
    fireEvent.click(
      screen.getByTestId(
        'mobile-market-token-selector-stock-search-load-more-retry',
      ),
    );
    expect(mockLoadMore).toHaveBeenCalledTimes(2);
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
