/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

import { StockMobilePriceHeader } from './StockMobilePriceHeader';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const Frame = ({
    children,
    testID,
    minHeight,
  }: PropsWithChildren<{ testID?: string; minHeight?: number }>) => (
    <div data-testid={testID} style={{ minHeight }}>
      {children}
    </div>
  );
  return {
    Button: Frame,
    NumberSizeableText: Frame,
    SizableText: Frame,
    Stack: Frame,
    XStack: Frame,
    YStack: Frame,
  };
});
jest.mock('@onekeyhq/kit/src/views/Market/components/MarketTokenPrice', () => ({
  MarketTokenPrice: () => <span>loaded price</span>,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage',
  () => ({
    PriceChangePercentage: ({ children }: PropsWithChildren) => (
      <span>{children}</span>
    ),
  }),
);
jest.mock('../../../components/PerpsBadges', () => ({
  StockMarketStatusBadge: ({ stock }: { stock?: IMarketStockInfo }) =>
    stock ? <span>Market closed</span> : null,
}));
jest.mock('../../hooks/StockDetailContext', () => ({
  useStockDetail: () => ({ stockId: 'AAPL' }),
}));
jest.mock('../../hooks/useStockPriceSource', () => ({
  useStockPriceSource: () => ({
    priceMode: 'token',
    sharePriceAvailable: true,
    handlePriceModeChange: jest.fn(),
  }),
}));
let mockLoaded = false;
jest.mock('../../hooks/useTokenDetail', () => ({
  useTokenDetail: () => ({
    tokenDetail: mockLoaded
      ? {
          price: '100',
          priceChange24hPercent: '1',
          stock: { subtitle: 'Apple', sourceLogoUri: '', isOpen: false },
        }
      : undefined,
  }),
}));

it('reserves the same market-status row before and after the first quote arrives', () => {
  mockLoaded = false;
  const { rerender } = render(<StockMobilePriceHeader />);
  const pendingRow = screen.getByTestId('stock-mobile-market-status-row');
  expect(pendingRow.style.minHeight).toBe('20px');
  expect(screen.queryByText('Market closed')).toBeNull();

  mockLoaded = true;
  rerender(<StockMobilePriceHeader />);
  const loadedRow = screen.getByTestId('stock-mobile-market-status-row');
  expect(loadedRow).toBe(pendingRow);
  expect(loadedRow.style.minHeight).toBe('20px');
  expect(screen.getByText('Market closed')).toBeTruthy();
  expect(screen.getByText('loaded price')).toBeTruthy();
});
