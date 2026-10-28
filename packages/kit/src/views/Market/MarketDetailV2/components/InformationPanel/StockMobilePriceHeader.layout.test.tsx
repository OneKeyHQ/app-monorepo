/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import type {
  IMarketStockDetailPreview,
  IMarketStockInfo,
  IMarketStockPublicDetail,
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
let mockStockDetail: Partial<IMarketStockPublicDetail> | undefined;
let mockStockId = 'AAPL';
let mockPreview: IMarketStockDetailPreview | undefined;
let mockPriceMode: 'share' | 'token' = 'token';
jest.mock('../../hooks/StockDetailContext', () => ({
  useStockDetail: () => ({
    stockId: mockStockId,
    stockPreview: mockPreview,
    stockDetail: mockStockDetail,
  }),
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

beforeEach(() => {
  mockPreview = undefined;
  mockPriceMode = 'token';
  mockStockDetail = undefined;
  mockStockId = 'AAPL';
  mockPriceSourceReady = true;
  mockLoaded = false;
});
afterEach(() => jest.restoreAllMocks());

it('keeps header geometry while waiting for the initial price mode', () => {
  mockLoaded = true;
  mockPriceSourceReady = false;
  const { rerender } = render(<StockMobilePriceHeader />);
  const header = screen.getByTestId('stock-mobile-price-header');
  const statusRow = screen.getByTestId('stock-mobile-market-status-row');
  expect(statusRow.style.minHeight).toBe('16px');
  expect(screen.queryByText('100')).toBeNull();
  expect(screen.queryByText('Market closed')).toBeNull();

  mockPriceSourceReady = true;
  rerender(<StockMobilePriceHeader />);
  expect(screen.getByTestId('stock-mobile-price-header')).toBe(header);
  expect(screen.getByTestId('stock-mobile-market-status-row')).toBe(statusRow);
  expect(statusRow.style.minHeight).toBe('16px');
  expect(screen.getByText('100')).toBeTruthy();
  expect(screen.getByText('Market closed')).toBeTruthy();
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
  expect(screen.getByText('123.45').textContent).toBe('123.45');
  mockPriceMode = 'token';
  rerender(<StockMobilePriceHeader />);
  expect(screen.queryByText('123.45')).toBeNull();
});

it.each(['share', 'token'] as const)(
  'replaces the pending preview with the resolved %s price in the same header',
  (resolvedMode) => {
    mockPriceSourceReady = false;
    mockLoaded = true;
    mockPreview = {
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple',
      logoUrl: '',
      quote: { source: 'share', price: '123.45', priceChange24hPercent: '1.5' },
    };
    const { rerender } = render(<StockMobilePriceHeader />);
    const header = screen.getByTestId('stock-mobile-price-header');
    const statusRow = screen.getByTestId('stock-mobile-market-status-row');
    expect(screen.getByText('123.45')).toBeTruthy();
    expect(screen.getByText('1.5')).toBeTruthy();
    expect(
      screen.getByTestId('stock-mobile-share-price-preview-label').textContent,
    ).toBe('market.share_price · preview__action');
    expect(screen.queryByText('100')).toBeNull();
    expect(screen.queryByText('Market closed')).toBeNull();
    mockPriceSourceReady = true;
    mockPriceMode = resolvedMode;
    mockStockDetail = {
      price: '200',
      marketStatus: { isOpen: resolvedMode === 'share' },
    };
    rerender(<StockMobilePriceHeader />);
    expect(screen.getByTestId('stock-mobile-price-header')).toBe(header);
    expect(screen.getByTestId('stock-mobile-market-status-row')).toBe(
      statusRow,
    );
    expect(
      screen.getByText(resolvedMode === 'share' ? '200' : '100'),
    ).toBeTruthy();
    expect(screen.queryByText('123.45')).toBeNull();
    expect(
      screen.queryByTestId('stock-mobile-share-price-preview-label'),
    ).toBeNull();
  },
);

it.each([undefined, '2030-01-01T00:00:00Z'])(
  'lets an authoritative quote replace a preview regardless of its timestamp (%s)',
  (quoteUpdatedAt) => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2031-01-01T00:00:00Z'));
    mockPriceMode = 'share';
    mockStockId = `PREVIEW-${quoteUpdatedAt ?? 'missing'}`;
    mockPreview = {
      stockId: mockStockId,
      symbol: 'AAPL',
      name: 'Apple',
      logoUrl: '',
      quote: { source: 'share', price: '123.45', quoteUpdatedAt },
    };
    const { rerender, unmount } = render(<StockMobilePriceHeader />);
    expect(screen.getByText('123.45')).toBeTruthy();
    mockStockDetail = { price: '200', quoteUpdatedAt: '2029-01-01T00:00:00Z' };
    rerender(<StockMobilePriceHeader />);
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.queryByText('123.45')).toBeNull();
    unmount();
    render(<StockMobilePriceHeader />);
    expect(screen.getByText('200')).toBeTruthy();
  },
);
