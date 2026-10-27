/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { ITableColumn } from '@onekeyhq/components';

import { useBannerDetailTableSort } from './useBannerDetailTableSort';

type IStockRow = { stockId: string; marketCap?: string };
type IPerpsRow = { name: string; change24hPercent: number };

const stockColumns: ITableColumn<IStockRow>[] = [
  { dataIndex: 'company', title: 'Company' },
  { dataIndex: 'marketCap', title: 'Market cap' },
];
const STOCK_SORTABLE_FIELDS = { marketCap: 'marketCap' } as const;

const stocks: IStockRow[] = [
  { stockId: 'A', marketCap: '200' },
  { stockId: 'B' },
  { stockId: 'C', marketCap: '1000' },
  { stockId: 'D', marketCap: '50' },
];

describe('useBannerDetailTableSort', () => {
  it('returns rows unsorted and no handler for an unsortable column', () => {
    const { result } = renderHook(() =>
      useBannerDetailTableSort({
        data: stocks,
        columns: stockColumns,
        sortableFields: STOCK_SORTABLE_FIELDS,
      }),
    );
    expect(result.current.sortedData).toBe(stocks);
    expect(result.current.handleHeaderRow(stockColumns[0], 0)).toBeUndefined();
  });

  it('sorts a numeric-string field both ways with missing values last', () => {
    const { result } = renderHook(() =>
      useBannerDetailTableSort({
        data: stocks,
        columns: stockColumns,
        sortableFields: STOCK_SORTABLE_FIELDS,
      }),
    );
    act(() => {
      result.current
        .handleHeaderRow(stockColumns[1], 1)
        ?.onSortTypeChange?.('desc');
    });
    expect(result.current.sortedData.map((row) => row.stockId)).toEqual([
      'C',
      'A',
      'D',
      'B',
    ]);
    expect(
      result.current.handleHeaderRow(stockColumns[1], 1)?.initialSortOrder,
    ).toBe('desc');
    act(() => {
      result.current
        .handleHeaderRow(stockColumns[1], 1)
        ?.onSortTypeChange?.('asc');
    });
    expect(result.current.sortedData.map((row) => row.stockId)).toEqual([
      'D',
      'A',
      'C',
      'B',
    ]);
    act(() => {
      result.current
        .handleHeaderRow(stockColumns[1], 1)
        ?.onSortTypeChange?.(undefined);
    });
    expect(result.current.sortedData).toBe(stocks);
    expect(
      result.current.handleHeaderRow(stockColumns[1], 1)?.initialSortOrder,
    ).toBeUndefined();
  });

  it('sorts perps rows by change24hPercent through the change24h column', () => {
    const perpsColumns: ITableColumn<IPerpsRow>[] = [
      { dataIndex: 'name', title: 'Name' },
      { dataIndex: 'change24h', title: '24h' },
    ];
    const perps: IPerpsRow[] = [
      { name: 'BTC', change24hPercent: 1.5 },
      { name: 'ETH', change24hPercent: -2 },
      { name: 'SOL', change24hPercent: 4 },
    ];
    const { result } = renderHook(() =>
      useBannerDetailTableSort({
        data: perps,
        columns: perpsColumns,
        sortableFields: { change24h: 'change24hPercent' } as const,
      }),
    );
    act(() => {
      result.current
        .handleHeaderRow(perpsColumns[1], 1)
        ?.onSortTypeChange?.('desc');
    });
    expect(result.current.sortedData.map((row) => row.name)).toEqual([
      'SOL',
      'BTC',
      'ETH',
    ]);
  });

  it('resets the sort when the sorted column is no longer visible', () => {
    const { result, rerender } = renderHook(
      ({ columns }: { columns: ITableColumn<IStockRow>[] }) =>
        useBannerDetailTableSort({
          data: stocks,
          columns,
          sortableFields: STOCK_SORTABLE_FIELDS,
        }),
      { initialProps: { columns: stockColumns } },
    );
    act(() => {
      result.current
        .handleHeaderRow(stockColumns[1], 1)
        ?.onSortTypeChange?.('desc');
    });
    expect(result.current.sortedData[0].stockId).toBe('C');
    rerender({ columns: [stockColumns[0]] });
    expect(result.current.sortedData).toBe(stocks);
  });
});
