/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import type {
  IMarketStockDetailPreview,
  IMarketStockInfo,
} from '@onekeyhq/shared/types/marketV2';

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
    Skeleton: Frame,
    Button: Frame,
    NumberSizeableText: Frame,
    SizableText: Frame,
    Stack: Frame,
    XStack: Frame,
    YStack: Frame,
  };
});
jest.mock('@onekeyhq/kit/src/views/Market/components/MarketTokenPrice', () => ({
  MarketTokenPrice: ({ price }: { price: string }) => (
    <span>
      loaded price<span data-testid="displayed-price">{price}</span>
    </span>
  ),
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
let mockPreview: IMarketStockDetailPreview | undefined;
let mockPriceMode: 'share' | 'token' = 'token';
jest.mock('../../hooks/StockDetailContext', () => ({
  useStockDetail: () => ({ stockId: 'AAPL', stockPreview: mockPreview }),
}));
let mockPriceSourceReady = true;
jest.mock('../../hooks/useStockPriceSource', () => ({
  useStockPriceSource: () => ({
    priceMode: mockPriceMode,
    isPriceSourceReady: mockPriceSourceReady,
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

it('holds a stable price skeleton until the initial price mode is resolved', () => {
  mockLoaded = true;
  mockPriceSourceReady = false;
  const { rerender } = render(<StockMobilePriceHeader />);
  const header = screen.getByTestId('stock-mobile-price-header');
  expect(screen.queryByText('loaded price')).toBeNull();
  expect(screen.queryByText('Market closed')).toBeNull();
  mockPriceSourceReady = true;
  rerender(<StockMobilePriceHeader />);
  expect(screen.getByTestId('stock-mobile-price-header')).toBe(header);
  expect(screen.getByText('loaded price')).toBeTruthy();
});

it('uses a share preview only for the share price mode', () => {
  mockLoaded = false;
  mockPriceSourceReady = true;
  mockPriceMode = 'share';
  mockPreview = {
    stockId: 'AAPL',
    symbol: 'AAPL',
    name: 'Apple',
    logoUrl: '',
    quote: { source: 'share', price: '123.45' },
  };
  const { rerender } = render(<StockMobilePriceHeader />);
  expect(screen.getByTestId('displayed-price').textContent).toBe('123.45');
  mockPriceMode = 'token';
  rerender(<StockMobilePriceHeader />);
  expect(screen.queryByTestId('displayed-price')).toBeNull();
});
