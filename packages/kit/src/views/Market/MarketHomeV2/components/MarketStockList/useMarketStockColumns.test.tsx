/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { renderHook } from '@testing-library/react';

import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { useMarketStockColumns } from './useMarketStockColumns';

// Mirrors the en_US values of the keys this suite asserts on; every other key
// falls through as its own id.
const MOCK_MESSAGES: Record<string, string> = {
  'global.price': 'Price',
  'market.stock_price_underlying_tooltip':
    'This is the price of the underlying security this token tracks, not the on-chain token price. While the market is closed, it shows the last close.',
};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => MOCK_MESSAGES[id] ?? id,
  }),
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/components/MarketListingStar',
  () => ({
    MarketListingStar: () => null,
  }),
);

jest.mock('./StockSparkline', () => ({
  StockSparkline: () => null,
}));

jest.mock('./MarketStockStar', () => ({
  MarketStockStar: ({ from }: { from: string }) => (
    <span data-testid="stock-favorite" data-from={from} />
  ),
}));

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

describe('useMarketStockColumns', () => {
  it.each([EWatchlistFrom.Homepage, EWatchlistFrom.Search])(
    'passes the %s source to the interactive stock favorite',
    (from) => {
      const { result } = renderHook(() =>
        useMarketStockColumns({ showWatchlist: true, watchlistFrom: from }),
      );
      const cell = result.current[0].render?.(
        undefined,
        mockStock,
        0,
      ) as ReactElement<{
        children: ReactElement<{
          children: ReactElement<{
            from: EWatchlistFrom;
            stock: IMarketStockPublicItem;
          }>;
        }>[];
      }>;
      expect(cell.props.children[0].props.children.props).toMatchObject({
        from,
        stock: mockStock,
      });
    },
  );

  it('uses the stock selector layout and Perps tooltip pattern', () => {
    const { result } = renderHook(() =>
      useMarketStockColumns({
        compact: true,
        showSparkline: false,
      }),
    );

    const columns = result.current;
    expect(columns).toHaveLength(5);
    expect(columns[0]?.columnWidth).toBe('32%');
    expect(columns.slice(1).map((column) => column.columnWidth)).toEqual([
      '17%',
      '17%',
      '17%',
      '17%',
    ]);
    const companyValue = columns[0]?.render?.(
      undefined,
      mockStock,
      0,
    ) as ReactElement<{ overflow?: string; width?: string }>;
    expect(companyValue.props).toMatchObject({
      overflow: 'hidden',
      width: '100%',
    });

    columns.slice(1).forEach((column) => {
      const value = column.render?.(undefined, mockStock, 0) as ReactElement<{
        size?: string;
      }>;
      expect(value.props.size).toBe('$bodyMdMedium');
    });

    // The header sorts, so the tooltip belongs to the table's own header
    // rather than to a trigger nested in the title.
    expect(columns[1]?.title).toBe('Price');
    expect(columns[1]?.titleTooltip).toBe(
      MOCK_MESSAGES['market.stock_price_underlying_tooltip'],
    );
  });

  it('keeps the full Stocks table presentation unchanged by default', () => {
    const { result } = renderHook(() =>
      useMarketStockColumns({ showSparkline: false }),
    );
    const priceColumn = result.current[1];
    const priceValue = priceColumn?.render?.(
      undefined,
      mockStock,
      0,
    ) as ReactElement<{ size?: string }>;

    expect(priceColumn?.title).toBe('Price');
    expect(priceColumn?.titleTooltip).toBe(
      MOCK_MESSAGES['market.stock_price_underlying_tooltip'],
    );
    expect(priceColumn?.titleProps).toBeUndefined();
    expect(priceValue.props.size).toBe('$bodyLgMedium');
  });
});
