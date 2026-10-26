/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import type { ITableColumn } from '@onekeyhq/components';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { BannerDetailStockTable } from './BannerDetailStockTable';

type IStockColumnsArgs = [
  options: { showWatchlist: boolean; watchlistFrom: EWatchlistFrom },
];
type IResponsiveColumnsArgs = [
  options: { columns: ITableColumn<IMarketStockPublicItem>[] },
];
const mockUseMarketStockColumns = jest.fn<
  ITableColumn<IMarketStockPublicItem>[],
  IStockColumnsArgs
>();
const mockUseMarketDesktopResponsiveColumns = jest.fn<
  {
    columns: ITableColumn<IMarketStockPublicItem>[];
    handleContainerLayout: () => void;
  },
  IResponsiveColumnsArgs
>();

const stockColumns: ITableColumn<IMarketStockPublicItem>[] = [
  { dataIndex: 'company', title: 'Company' },
  { dataIndex: 'marketCap', title: 'Market cap' },
];

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true, isNative: false },
}));
// Jest's `moduleNameMapper` maps every `@onekeyhq/components…` specifier onto
// one module, so this factory also has to answer the component's
// `@onekeyhq/components/src/layouts/Page/hooks` import.
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: import('react').PropsWithChildren) =>
    React.createElement('div', null, children);
  function Table<T extends { stockId: string }>({
    columns,
    dataSource,
    onHeaderRow,
    onRow,
  }: {
    columns: ITableColumn<T>[];
    dataSource: T[];
    onHeaderRow: (column: ITableColumn<T>, index: number) => unknown;
    onRow: (item: T) => { onPress: () => void };
  }) {
    return React.createElement(
      'div',
      null,
      columns.map((column, index) =>
        React.createElement(
          'span',
          {
            key: String(column.dataIndex),
            'data-testid': `header-${String(column.dataIndex)}`,
            'data-sortable': Boolean(onHeaderRow(column, index)),
          },
          String(column.dataIndex),
        ),
      ),
      dataSource.map((item) =>
        React.createElement(
          'button',
          {
            key: item.stockId,
            'data-testid': `row-${item.stockId}`,
            onClick: () => onRow(item).onPress(),
          },
          item.stockId,
        ),
      ),
    );
  }
  Object.assign(Table, {
    Skeleton: () => React.createElement('div', { 'data-testid': 'skeleton' }),
  });
  return {
    SizableText: Container,
    Stack: Container,
    YStack: Container,
    Table,
    useMedia: () => ({ md: false }),
    useTabBarHeight: () => 0,
  };
});
jest.mock(
  '../MarketHomeV2/components/MarketStockList/useMarketStockColumns',
  () => ({
    useMarketStockColumns: (...args: IStockColumnsArgs) =>
      mockUseMarketStockColumns(...args),
  }),
);
jest.mock(
  '../MarketHomeV2/components/useMarketDesktopResponsiveColumns',
  () => ({
    useMarketDesktopResponsiveColumns: (...args: IResponsiveColumnsArgs) =>
      mockUseMarketDesktopResponsiveColumns(...args),
  }),
);

const stock: IMarketStockPublicItem = {
  stockId: 'AAPL',
  symbol: 'AAPL',
  name: 'Apple',
  logoUrl: '',
  assetType: 'stock',
  currency: 'USD',
  marketCap: '100',
};

beforeEach(() => {
  mockUseMarketStockColumns.mockReturnValue(stockColumns);
  mockUseMarketDesktopResponsiveColumns.mockImplementation(
    ({ columns }: { columns: ITableColumn<IMarketStockPublicItem>[] }) => ({
      columns,
      handleContainerLayout: jest.fn(),
    }),
  );
});

it('builds the Stocks tab columns for the banner watchlist source', () => {
  render(
    <BannerDetailStockTable
      items={[stock]}
      isLoading={false}
      onItemPress={jest.fn()}
    />,
  );
  expect(mockUseMarketStockColumns).toHaveBeenCalledWith({
    showWatchlist: true,
    watchlistFrom: EWatchlistFrom.BannerList,
  });
  expect(mockUseMarketDesktopResponsiveColumns).toHaveBeenCalledWith(
    expect.objectContaining({
      columns: stockColumns,
      enabled: true,
      firstColumnCount: 1,
      horizontalInset: 24,
      metricColumnMinimumWidths: { priceChange24hPercent: 128, sparkline: 148 },
    }),
  );
});

it('sorts only the columns the Stocks tab sorts and presses rows', () => {
  const onItemPress = jest.fn();
  render(
    <BannerDetailStockTable
      items={[stock]}
      isLoading={false}
      onItemPress={onItemPress}
    />,
  );
  expect(
    screen.getByTestId('header-company').getAttribute('data-sortable'),
  ).toBe('false');
  expect(
    screen.getByTestId('header-marketCap').getAttribute('data-sortable'),
  ).toBe('true');
  fireEvent.click(screen.getByTestId('row-AAPL'));
  expect(onItemPress).toHaveBeenCalledWith(stock);
});

it('shows the skeleton while loading with no rows', () => {
  render(
    <BannerDetailStockTable items={[]} isLoading onItemPress={jest.fn()} />,
  );
  expect(screen.getByTestId('skeleton')).toBeTruthy();
});
