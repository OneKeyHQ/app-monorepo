/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import type { useStockDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import type {
  IMarketStockInfo,
  IMarketStockPublicDetail,
} from '@onekeyhq/shared/types/marketV2';

import {
  SwapStockMarketPanel,
  SwapStockMobileHeader,
} from './SwapStockMarketPanel';

const publicStockDetail: IMarketStockPublicDetail = {
  stockId: 'AAPL',
  symbol: 'AAPL',
  name: 'Apple',
  logoUrl: '',
  assetType: 'stock',
  currency: 'USD',
  categories: [],
  aliases: [],
  price: '340.97',
  priceUpdatedAt: '2026-10-12T20:00:00Z',
  marketStatus: { isOpen: false },
};

function createStockDetailState(): ReturnType<typeof useStockDetail> {
  return {
    stockId: 'AAPL',
    stockDetail: publicStockDetail,
    isStockRoute: true,
    isStockDetailReady: false,
    isStockDetailLoading: true,
    isStockDetailError: false,
    retryStockDetail: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    tokenVariants: [],
    isTokenVariantsLoading: false,
    isTokenVariantPending: false,
    isTokenVariantsError: false,
    retryTokenVariants: jest
      .fn<Promise<void>, []>()
      .mockResolvedValue(undefined),
    setSelectedTokenId: jest.fn(),
  };
}

let mockStockDetailState = createStockDetailState();
let mockStockSelectionPending = false;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/components', () => {
  const Frame = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return {
    Button: Frame,
    NumberSizeableText: Frame,
    SizableText: Frame,
    Stack: Frame,
    XStack: Frame,
    YStack: Frame,
    Skeleton: ({
      width,
      height,
    }: {
      width?: number | string;
      height?: number | string;
    }) => (
      <div
        data-testid={
          width === 220 && height === 20 ? 'stock-status-loading' : 'skeleton'
        }
      />
    ),
  };
});
jest.mock('@onekeyhq/kit/src/components/TradingView/TradingViewNative', () => ({
  TradingViewNative: () => null,
  getTradingViewNativeSourceKey: () => '',
}));
jest.mock('@onekeyhq/kit/src/views/Market/components/MarketTokenPrice', () => ({
  BaseMarketTokenPrice: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/components/MarketTooltipLabel',
  () => ({
    MarketTooltipLabel: ({ children }: { children?: ReactNode }) => children,
  }),
);
jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  StockMarketStatusBadge: ({ stock }: { stock?: IMarketStockInfo }) => (
    <div
      data-testid="stock-status"
      data-title={stock?.title}
      data-is-open={String(stock?.isOpen)}
      data-updated-at={stock?.priceUpdatedAt}
    />
  ),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage',
  () => ({
    PriceChangePercentage: () => null,
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockSimpleChart/StockSimpleChart',
  () => ({ StockSimpleChartContent: () => null }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockTokenInfo/StockTokenInfoPopover',
  () => ({ StockTokenInfoPopover: () => null }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/StockTokenVariantSelector',
  () => ({ StockTokenVariantSelector: () => null }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext',
  () => ({ useStockDetail: () => mockStockDetailState }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/components/StockChartModeControl',
  () => ({ StockChartModeControl: () => null }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/hooks/useToMarketStockDetailPage',
  () => ({ useToMarketStockDetailPage: () => jest.fn() }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketDetailChartDisplayModePersistAtom: () => [
    { mode: 'simple' },
    jest.fn(),
  ],
}));
jest.mock('../modal/swapKLineTradingViewNativeUtils', () => ({
  getSwapKLineTradingViewNativeSource: () => undefined,
}));
jest.mock('./SwapStockMarketData', () => ({
  SwapStockMarketDataGrid: () => null,
}));
jest.mock('./SwapStockMarketProvider', () => ({
  useSwapStockSelection: () => ({
    stockSelectionPending: mockStockSelectionPending,
  }),
}));
jest.mock('./SwapStockPortfolio', () => ({
  SwapStockMyPosition: () => null,
  useSwapStockPortfolio: () => undefined,
}));
jest.mock('./SwapStockTickerSelector', () => ({
  SwapStockTickerSelector: () => null,
}));
jest.mock('./SwapStockTokenDetails', () => ({
  SwapStockTokenDetails: () => null,
}));
jest.mock('./SwapStockTradeProvider', () => ({
  useSwapStockTradeContext: () => ({
    currentStockToken: {
      networkId: 'evm--1',
      contractAddress: '0xaapl',
      symbol: 'AAPLon',
    },
    displayStockTokenDetail: {
      price: '343.17',
      stock: { source: 'ondo', isOpen: true },
    },
  }),
}));

describe.each(['mobile', 'desktop'] as const)(
  'Swap Stock %s market status',
  (surface) => {
    const renderSurface = () =>
      render(
        surface === 'mobile' ? (
          <SwapStockMobileHeader />
        ) : (
          <SwapStockMarketPanel />
        ),
      );

    beforeEach(() => {
      mockStockDetailState = createStockDetailState();
      mockStockSelectionPending = false;
    });

    it('shows the matching cached public status while remount revalidation is pending', () => {
      renderSurface();

      expect(screen.queryByTestId('stock-status-loading')).toBeNull();
      const status = screen.getByTestId('stock-status');
      expect(status.getAttribute('data-title')).toBe('AAPL');
      expect(status.getAttribute('data-is-open')).toBe('false');
      expect(status.getAttribute('data-updated-at')).toBe(
        publicStockDetail.priceUpdatedAt,
      );
    });

    it('matches cached public stock identity without case sensitivity', () => {
      mockStockDetailState.stockId = 'aapl';
      renderSurface();

      expect(screen.queryByTestId('stock-status-loading')).toBeNull();
      expect(screen.getByTestId('stock-status')).toBeTruthy();
    });

    it('keeps the initial loading state without a public stock detail', () => {
      mockStockDetailState.stockDetail = undefined;
      renderSurface();

      expect(screen.getByTestId('stock-status-loading')).toBeTruthy();
      expect(screen.queryByTestId('stock-status')).toBeNull();
    });

    it('does not display a cached detail belonging to another stock', () => {
      mockStockDetailState.stockId = 'MSFT';
      renderSurface();

      expect(screen.getByTestId('stock-status-loading')).toBeTruthy();
      expect(screen.queryByTestId('stock-status')).toBeNull();
    });

    it('keeps the status loading while a new stock selection is pending', () => {
      mockStockSelectionPending = true;
      renderSurface();

      expect(screen.getByTestId('stock-status-loading')).toBeTruthy();
      expect(screen.queryByTestId('stock-status')).toBeNull();
    });
  },
);
