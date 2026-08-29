/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { renderHook } from '@testing-library/react';

import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { useMarketStockColumns } from './useMarketStockColumns';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) =>
      id === 'global.price' ? 'Price' : id,
  }),
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('./StockSparkline', () => ({
  StockSparkline: () => null,
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

    const priceTitle = columns[1]?.title as ReactElement<{
      placement?: string;
      renderTrigger?: ReactElement<{
        children?: string;
        dashSpacing?: number;
        dashThickness?: number;
      }>;
      renderContent?: ReactElement<{ children?: string }>;
    }>;
    expect(priceTitle.props.placement).toBe('top');
    expect(priceTitle.props.renderTrigger?.props).toMatchObject({
      children: 'Price',
      dashSpacing: 0,
      dashThickness: 0.5,
    });
    expect(priceTitle.props.renderContent?.props.children).toBe(
      'The displayed price is the underlying stock price.',
    );
  });

  it('shows the price tooltip in the full Stocks table', () => {
    const { result } = renderHook(() =>
      useMarketStockColumns({ showSparkline: false }),
    );
    const priceColumn = result.current[1];
    const priceValue = priceColumn?.render?.(
      undefined,
      mockStock,
      0,
    ) as ReactElement<{ size?: string }>;

    const priceTitle = priceColumn?.title as ReactElement<{
      renderContent?: ReactElement<{ children?: string }>;
    }>;
    expect(priceTitle.props.renderContent?.props.children).toBe(
      'The displayed price is the underlying stock price.',
    );
    expect(priceValue.props.size).toBe('$bodyLgMedium');
  });
});
