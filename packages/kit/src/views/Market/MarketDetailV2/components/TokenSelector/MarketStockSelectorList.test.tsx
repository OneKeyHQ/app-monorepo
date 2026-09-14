/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { ITableColumn } from '@onekeyhq/components';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { MarketStockSelectorList } from './MarketStockSelectorList';

const mockOnItemPress = jest.fn();
const mockColumns: ITableColumn<IMarketStockPublicItem>[] = [
  { title: 'Company', dataIndex: 'company' },
  { title: 'Price', dataIndex: 'price' },
  { title: '24h Change', dataIndex: 'priceChange24hPercent' },
  { title: 'MCap', dataIndex: 'marketCap' },
  { title: '24h Volume', dataIndex: 'volume24h' },
  { title: '24h price range', dataIndex: 'sparkline' },
];
const mockStock: IMarketStockPublicItem = {
  stockId: 'AAPL',
  symbol: 'AAPL',
  name: 'Apple',
  logoUrl: 'https://example.com/aapl.png',
  assetType: 'stock',
  price: '310.34',
  priceChange24hPercent: '0.32',
  marketCap: '4560000000000',
  volume24h: '10670000000',
  peRatio: '31.46',
  currency: 'USD',
  sparkline: [309, 310],
};

const mockTableProps = jest.fn();
const mockUseMarketStockColumns = jest.fn(
  (_options?: { compact?: boolean; showSparkline?: boolean }) => mockColumns,
);
const mockSelectorListResult = {
  items: [mockStock],
  isLoading: false,
  isError: false,
  isLoadingMore: false,
  isLoadMoreError: false,
  canLoadMore: false,
  loadMore: jest.fn(),
  refresh: jest.fn(),
};
const mockUseMarketStockSelectorList = jest.fn(
  (_options?: { query?: string }) => mockSelectorListResult,
);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Button: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  Empty: () => null,
  ListEndIndicator: () => null,
  Spinner: () => null,
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Table: ({
    columns,
    dataSource,
    estimatedItemSize,
    headerRowProps,
    onRow,
    rowProps,
    onEndReached,
    onEndReachedThreshold,
    TableFooterComponent,
  }: {
    columns: ITableColumn<IMarketStockPublicItem>[];
    dataSource: IMarketStockPublicItem[];
    estimatedItemSize: number;
    headerRowProps: { height: number };
    onRow: (
      item: IMarketStockPublicItem,
      index: number,
    ) => { onPress?: () => void } | undefined;
    rowProps: { height: number; minHeight: number };
    onEndReached: () => void;
    onEndReachedThreshold: number;
    TableFooterComponent: ReactNode;
  }) => {
    mockTableProps({
      columns,
      dataSource,
      estimatedItemSize,
      headerRowProps,
      rowProps,
      onEndReached,
      onEndReachedThreshold,
      TableFooterComponent,
    });
    return (
      <div data-testid="stock-table">
        {dataSource.map((item, index) => (
          <button
            key={item.stockId}
            data-testid={`stock-row-${item.stockId}`}
            type="button"
            onClick={() => onRow(item, index)?.onPress?.()}
          >
            {item.symbol}
          </button>
        ))}
      </div>
    );
  },
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/useMarketStockColumns',
  () => ({
    useMarketStockColumns: (options: {
      compact?: boolean;
      showSparkline?: boolean;
    }) => mockUseMarketStockColumns(options),
  }),
);
jest.mock('./useMarketStockSelectorList', () => ({
  useMarketStockSelectorList: (options: { query?: string }) => {
    mockUseMarketStockSelectorList(options);
    return mockSelectorListResult;
  },
}));

describe('MarketStockSelectorList', () => {
  beforeEach(() => {
    mockOnItemPress.mockReset();
    mockTableProps.mockClear();
    mockUseMarketStockColumns.mockClear();
    mockUseMarketStockSelectorList.mockClear();
    mockSelectorListResult.canLoadMore = false;
    mockSelectorListResult.items = [mockStock];
    mockSelectorListResult.isLoadMoreError = false;
    mockSelectorListResult.isLoadingMore = false;
    mockSelectorListResult.loadMore.mockClear();
  });

  it('uses the Market Stocks columns and preserves the selected stock preview', () => {
    render(<MarketStockSelectorList onItemPress={mockOnItemPress} query="" />);

    expect(screen.getByTestId('stock-table')).toBeTruthy();
    expect(mockUseMarketStockSelectorList).toHaveBeenCalledWith({ query: '' });
    expect(mockUseMarketStockColumns).toHaveBeenCalledWith({
      compact: true,
      showSparkline: false,
      showWatchlist: true,
      watchlistFrom: EWatchlistFrom.Search,
    });
    expect(mockTableProps).toHaveBeenCalledWith({
      columns: mockColumns,
      dataSource: [mockStock],
      estimatedItemSize: 56,
      headerRowProps: { height: 40, minHeight: 40 },
      rowProps: {
        width: '100%',
        height: 56,
        minHeight: 56,
        borderRadius: '$0',
      },
      onEndReached: expect.any(Function),
      onEndReachedThreshold: 0.2,
      TableFooterComponent: expect.anything(),
    });

    fireEvent.click(screen.getByTestId('stock-row-AAPL'));
    expect(mockOnItemPress).toHaveBeenCalledWith(mockStock);
  });

  it('triggers selector pagination when the table reaches the end', () => {
    mockSelectorListResult.canLoadMore = true;
    render(<MarketStockSelectorList onItemPress={mockOnItemPress} query="" />);

    const tableProps = mockTableProps.mock.calls[0]?.[0] as {
      onEndReached: () => void;
    };
    tableProps.onEndReached();

    expect(mockSelectorListResult.loadMore).toHaveBeenCalledTimes(1);
  });

  it('keeps the table mounted when an empty page has a continuation cursor', () => {
    mockSelectorListResult.items = [];
    mockSelectorListResult.canLoadMore = true;
    render(<MarketStockSelectorList onItemPress={mockOnItemPress} query="" />);

    expect(screen.getByTestId('stock-table')).toBeTruthy();
    expect(mockTableProps).toHaveBeenCalled();
  });
});
