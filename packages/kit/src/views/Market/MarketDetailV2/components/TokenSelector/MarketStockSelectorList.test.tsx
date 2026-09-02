/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { ITableColumn } from '@onekeyhq/components';
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
  Spinner: () => null,
  Table: ({
    columns,
    dataSource,
    estimatedItemSize,
    headerRowProps,
    onRow,
    rowProps,
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
  }) => {
    mockTableProps({
      columns,
      dataSource,
      estimatedItemSize,
      headerRowProps,
      rowProps,
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

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: { items: [mockStock] },
    isLoading: false,
    run: jest.fn(),
  }),
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

describe('MarketStockSelectorList', () => {
  beforeEach(() => {
    mockOnItemPress.mockReset();
    mockTableProps.mockClear();
    mockUseMarketStockColumns.mockClear();
  });

  it('uses the Market Stocks columns and preserves the selected stock preview', () => {
    render(<MarketStockSelectorList onItemPress={mockOnItemPress} query="" />);

    expect(screen.getByTestId('stock-table')).toBeTruthy();
    expect(mockUseMarketStockColumns).toHaveBeenCalledWith({
      compact: true,
      showSparkline: false,
    });
    expect(mockTableProps).toHaveBeenCalledWith({
      columns: mockColumns,
      dataSource: [mockStock],
      estimatedItemSize: 56,
      headerRowProps: { height: 40 },
      rowProps: { width: '100%', height: 56, minHeight: 56 },
    });

    fireEvent.click(screen.getByTestId('stock-row-AAPL'));
    expect(mockOnItemPress).toHaveBeenCalledWith(mockStock);
  });
});
