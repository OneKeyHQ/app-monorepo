/** @jest-environment jsdom */

import { isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

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

// The shared components mock is empty; the market badge reads `Badge.Text`
// while the cell element is built, so it needs a real static member.
jest.mock('@onekeyhq/components', () => {
  function Badge() {
    return null;
  }
  Badge.Text = function BadgeText() {
    return null;
  };
  return {
    ...jest.requireActual<Record<string, unknown>>('@onekeyhq/components'),
    Badge,
  };
});

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

// Flattens the visible strings of a rendered cell, including the hover line's
// `resting` and `revealed` slots, in document order.
function collectText(node: ReactNode): string[] {
  if (typeof node === 'string' || typeof node === 'number') {
    return [String(node)];
  }
  if (Array.isArray(node)) {
    return node.flatMap((child: ReactNode) => collectText(child));
  }
  if (isValidElement(node)) {
    const { children, resting, revealed } = node.props as {
      children?: ReactNode;
      resting?: ReactNode;
      revealed?: ReactNode;
    };
    return [resting, revealed, children].flatMap((child) => collectText(child));
  }
  return [];
}

// The first element in a rendered cell whose direct child is `text`.
function findElementByText(
  node: ReactNode,
  text: string,
): ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(node)) {
    for (const child of node as ReactNode[]) {
      const found = findElementByText(child, text);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(node)) {
    return undefined;
  }
  const props = node.props as {
    children?: ReactNode;
    resting?: ReactNode;
    revealed?: ReactNode;
  };
  if (props.children === text) {
    return node as ReactElement<Record<string, unknown>>;
  }
  return (
    findElementByText(props.resting, text) ??
    findElementByText(props.revealed, text) ??
    findElementByText(props.children, text)
  );
}

function renderCompanyText(
  columns: ReturnType<typeof useMarketStockColumns>,
  stock: IMarketStockPublicItem,
) {
  return collectText(columns[0]?.render?.(undefined, stock, 0) as ReactNode);
}

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

  describe('market tags', () => {
    const hkStock: IMarketStockPublicItem = {
      ...mockStock,
      stockId: 'XIAO',
      symbol: 'XIAO',
      name: 'Xiaomi',
      tags: ['HK'],
    };

    it('puts the market badge before the company name when enabled', () => {
      const { result } = renderHook(() =>
        useMarketStockColumns({ showMarketTags: true }),
      );

      expect(renderCompanyText(result.current, hkStock)).toEqual([
        'XIAO',
        'HK',
        'Xiaomi',
      ]);
    });

    it('shows the badge in the compact stock selector layout', () => {
      const { result } = renderHook(() =>
        useMarketStockColumns({
          compact: true,
          showSparkline: false,
          showMarketTags: true,
        }),
      );

      expect(renderCompanyText(result.current, hkStock)).toEqual([
        'XIAO',
        'HK',
        'Xiaomi',
      ]);
    });

    it('centers the compact company name on the badge row', () => {
      const { result } = renderHook(() =>
        useMarketStockColumns({ compact: true, showMarketTags: true }),
      );
      const cell = result.current[0]?.render?.(undefined, hkStock, 0);
      const row = findElementByText(cell as ReactNode, 'Xiaomi');

      // The compact name is 12/16 inside a 20px row; a fixed row height on
      // the text would keep it from centering beside the 16px badge.
      expect(row?.props.height).toBeUndefined();
      expect(row?.props.size).toBe('$bodySm');
    });

    it('keeps the untagged company name on its fixed line height', () => {
      const { result } = renderHook(() =>
        useMarketStockColumns({ compact: true, showMarketTags: true }),
      );
      const cell = result.current[0]?.render?.(
        undefined,
        { ...hkStock, tags: undefined },
        0,
      );

      expect(findElementByText(cell as ReactNode, 'Xiaomi')?.props.height).toBe(
        20,
      );
    });

    it('keeps the badge on the resting line so it slides away on hover', () => {
      const { result } = renderHook(() =>
        useMarketStockColumns({ showMarketTags: true }),
      );

      expect(
        renderCompanyText(result.current, {
          ...hkStock,
          variants: [{ tokenId: 'xiao-token', issuer: 'xstock' }],
        }),
      ).toEqual(['XIAO', 'HK', 'Xiaomi', 'market.number_tokens']);
    });

    it('hides the badge on surfaces that do not opt in', () => {
      const { result } = renderHook(() => useMarketStockColumns());

      expect(renderCompanyText(result.current, hkStock)).toEqual([
        'XIAO',
        'Xiaomi',
      ]);
    });

    it('shows only the company name when the feed sends no tags', () => {
      const { result } = renderHook(() =>
        useMarketStockColumns({ showMarketTags: true }),
      );

      expect(
        renderCompanyText(result.current, { ...hkStock, tags: [] }),
      ).toEqual(['XIAO', 'Xiaomi']);
    });
  });
});
