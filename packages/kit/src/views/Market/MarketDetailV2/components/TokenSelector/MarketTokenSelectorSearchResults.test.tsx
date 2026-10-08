/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { MarketTokenSelectorSearchResults } from './MarketTokenSelectorSearchResults';

const mockStockPress = jest.fn();
const mockMarketPress = jest.fn();
const mockRefresh = jest.fn();
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

const createStock = (stockId: string): IMarketStockPublicItem => ({
  stockId,
  symbol: stockId,
  name: stockId,
  logoUrl: '',
  assetType: 'stock',
  currency: 'USD',
});

const defaultStockResult = {
  items: [createStock('AAPL')],
  isLoading: false,
  isError: false,
  isLoadingMore: false,
  isLoadMoreError: false,
  canLoadMore: false,
  loadMore: mockLoadMore,
  refresh: mockRefresh,
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
    Empty: ({ title }: { title?: string }) => (
      <div data-testid="empty">{title}</div>
    ),
    ScrollView: Container,
    SizableText: Container,
    Spinner: () => <div data-testid="spinner" />,
    Table: ({
      dataSource,
      onRow,
    }: {
      dataSource: Array<{ id?: string; stockId?: string }>;
      onRow: (item: { id?: string; stockId?: string }) => {
        onPress: () => void;
      };
    }) => (
      <div>
        {dataSource.map((item) => {
          const id = item.stockId ?? item.id ?? '';
          return (
            <button
              key={id}
              data-testid={`search-row-${id}`}
              type="button"
              onClick={onRow(item).onPress}
            >
              {id}
            </button>
          );
        })}
      </div>
    ),
    XStack: Container,
    YStack: Container,
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/useMarketStockColumns',
  () => ({ useMarketStockColumns: () => [] }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenColumns',
  () => ({ useMarketTokenColumns: () => [] }),
);
jest.mock('./useMarketStockSelectorList', () => ({
  useMarketStockSelectorList: (options: { query: string }) =>
    mockUseMarketStockSelectorList(options),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [{ data: [] }],
}));

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

describe('MarketTokenSelectorSearchResults', () => {
  beforeEach(() => {
    mockStockPress.mockReset();
    mockMarketPress.mockReset();
    mockRefresh.mockReset();
    mockLoadMore.mockClear();
    mockUseMarketStockSelectorList.mockReset();
    mockUseMarketStockSelectorList.mockReturnValue(defaultStockResult);
  });

  it('shows token and stock tabs with separate navigation identities', () => {
    render(
      <MarketTokenSelectorSearchResults
        query="aapl"
        marketItems={[marketItem]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    expect(
      screen.getByTestId('market-token-selector-search-tab-all'),
    ).toBeTruthy();
    expect(
      screen.getByTestId('market-token-selector-search-tab-stocks'),
    ).toBeTruthy();
    expect(
      screen.getByTestId('market-token-selector-search-tab-tokens'),
    ).toBeTruthy();
    expect(
      screen.queryByTestId('market-token-selector-search-tab-watchlist'),
    ).toBeNull();
    expect(screen.getByTestId('search-row-AAPL')).toBeTruthy();
    expect(mockUseMarketStockSelectorList).toHaveBeenCalledWith({
      query: 'aapl',
      searchOnly: true,
    });

    fireEvent.click(screen.getByTestId('search-row-evm--1_0xaapl'));
    expect(mockMarketPress).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'evm--1_0xaapl',
        address: '0xaapl',
        networkId: 'evm--1',
      }),
    );

    fireEvent.click(
      screen.getByTestId('market-token-selector-search-tab-stocks'),
    );
    fireEvent.click(screen.getByTestId('search-row-AAPL'));
    expect(mockStockPress).toHaveBeenCalledWith(defaultStockResult.items[0]);
  });

  it('filters stock and token rows and resets to tokens for a new query', () => {
    const { rerender } = render(
      <MarketTokenSelectorSearchResults
        query="aapl"
        marketItems={[marketItem]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    fireEvent.click(
      screen.getByTestId('market-token-selector-search-tab-stocks'),
    );
    expect(screen.getByTestId('search-row-AAPL')).toBeTruthy();
    expect(screen.queryByTestId('search-row-evm--1_0xaapl')).toBeNull();

    fireEvent.click(
      screen.getByTestId('market-token-selector-search-tab-tokens'),
    );
    expect(screen.queryByTestId('search-row-AAPL')).toBeNull();
    expect(screen.getByTestId('search-row-evm--1_0xaapl')).toBeTruthy();

    rerender(
      <MarketTokenSelectorSearchResults
        query="apple"
        marketItems={[marketItem]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );
    expect(screen.getByTestId('search-row-AAPL')).toBeTruthy();
    expect(screen.getByTestId('search-row-evm--1_0xaapl')).toBeTruthy();
  });

  it('keeps market results available when stock search fails', () => {
    mockUseMarketStockSelectorList.mockReturnValue({
      ...defaultStockResult,
      items: [],
      isError: true,
    });

    render(
      <MarketTokenSelectorSearchResults
        query="aapl"
        marketItems={[marketItem]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    expect(screen.getByTestId('search-row-evm--1_0xaapl')).toBeTruthy();
    expect(
      screen.queryByTestId('market-token-selector-search-tab-stocks'),
    ).toBeNull();
  });

  it('expands a stock section without mixing token rows', () => {
    mockUseMarketStockSelectorList.mockReturnValue({
      ...defaultStockResult,
      items: ['AAPL', 'MSFT', 'NVDA', 'TSLA'].map(createStock),
    });

    render(
      <MarketTokenSelectorSearchResults
        query="stock"
        marketItems={[]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    fireEvent.click(
      screen.getByTestId('market-token-selector-search-tab-stocks'),
    );
    expect(screen.getByTestId('search-row-TSLA')).toBeTruthy();
    expect(screen.queryByTestId('search-row-evm--1_0xaapl')).toBeNull();
  });

  it('loads and retries additional stock search pages', () => {
    mockUseMarketStockSelectorList.mockReturnValue({
      ...defaultStockResult,
      canLoadMore: true,
    });
    const { rerender } = render(
      <MarketTokenSelectorSearchResults
        query="stock"
        marketItems={[]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );
    fireEvent.click(
      screen.getByTestId('market-token-selector-search-tab-stocks'),
    );
    fireEvent.click(
      screen.getByTestId('market-token-selector-stock-search-load-more'),
    );
    expect(mockLoadMore).toHaveBeenCalledTimes(1);

    mockUseMarketStockSelectorList.mockReturnValue({
      ...defaultStockResult,
      canLoadMore: true,
      isLoadMoreError: true,
    });
    rerender(
      <MarketTokenSelectorSearchResults
        query="stock"
        marketItems={[]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );
    fireEvent.click(
      screen.getByTestId('market-token-selector-stock-search-load-more-retry'),
    );
    expect(mockLoadMore).toHaveBeenCalledTimes(2);
  });

  it('previews three chain tokens on All and hides Stocks for a non-stock query', () => {
    mockUseMarketStockSelectorList.mockReturnValue({
      ...defaultStockResult,
      items: [],
    });
    const tokens = ['1', '2', '3', '4'].map((suffix) => ({
      ...marketItem,
      address: `0x${suffix}`,
      symbol: `BTC${suffix}`,
    }));

    render(
      <MarketTokenSelectorSearchResults
        query="btc"
        marketItems={tokens}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    expect(
      screen.queryByTestId('market-token-selector-search-tab-stocks'),
    ).toBeNull();
    expect(screen.getByTestId('search-row-evm--1_0x1')).toBeTruthy();
    expect(screen.getByTestId('search-row-evm--1_0x3')).toBeTruthy();
    expect(screen.queryByTestId('search-row-evm--1_0x4')).toBeNull();
    fireEvent.click(
      screen.getByTestId('market-token-selector-market-search-show-more'),
    );
    expect(screen.getByTestId('search-row-evm--1_0x4')).toBeTruthy();
  });

  it('keeps a bare stock listing out of the Tokens list', () => {
    render(
      <MarketTokenSelectorSearchResults
        query="aapl"
        marketItems={[
          marketItem,
          {
            ...marketItem,
            name: 'Apple',
            symbol: 'AAPL',
            address: '',
            network: '',
            stockId: 'AAPL',
          },
        ]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    fireEvent.click(
      screen.getByTestId('market-token-selector-search-tab-tokens'),
    );
    expect(screen.getByTestId('search-row-evm--1_0xaapl')).toBeTruthy();
    expect(screen.queryByTestId('search-row-AAPL')).toBeNull();
  });

  it('asks the stock hook for search-only results', () => {
    render(
      <MarketTokenSelectorSearchResults
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
