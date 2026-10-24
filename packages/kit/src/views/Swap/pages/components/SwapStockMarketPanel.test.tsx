/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { useStockDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import { StockDetailProvider } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
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
    priceSource: {
      priceMode: 'token',
      sharePriceAvailable: true,
      isPriceSourceReady: true,
      handlePriceModeChange: jest.fn(),
    },
    stockId: 'AAPL',
    stockDetail: publicStockDetail,
    isStockRoute: true,
    isStockDetailReady: false,
    isStockDetailLoading: true,
    isStockDetailError: false,
    isStockDetailStatusError: false,
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
let mockUseRealStockDetail = false;
const initialPlatformEnv = {
  isDesktop: platformEnv.isDesktop,
  isWeb: platformEnv.isWeb,
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketStockDetail: jest.fn(),
      fetchMarketStockTokenVariants: jest.fn(),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en-US',
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/components', () => {
  const deferredModule = jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
  >('../../../../../../components/src/hooks/useDeferredPromise');
  const Frame = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return {
    Button: ({
      children,
      testID,
      onPress,
    }: {
      children?: ReactNode;
      testID?: string;
      onPress?: () => void;
    }) => (
      <button data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ),
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise: deferredModule.useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
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
  () => {
    const actual = jest.requireActual<
      typeof import('@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext')
    >('@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext');
    return {
      ...actual,
      useStockDetail: () =>
        mockUseRealStockDetail ? actual.useStockDetail() : mockStockDetailState,
    };
  },
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
  useMarketPriceSourceAtom: () => {
    const { useState } = jest.requireActual<typeof import('react')>('react');
    return useState({ source: 'token' });
  },
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

describe.each(['mobile', 'desktop', 'web', 'extension'] as const)(
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
      platformEnv.isDesktop = surface === 'desktop';
      platformEnv.isWeb = surface === 'web';
    });

    afterEach(() => {
      Object.assign(platformEnv, initialPlatformEnv);
    });

    it('waits for authoritative status on every surface', () => {
      renderSurface();

      expect(screen.getByTestId('stock-status-loading')).toBeTruthy();
      expect(screen.queryByTestId('stock-status')).toBeNull();
    });

    it('matches cached public stock identity without case sensitivity', () => {
      mockStockDetailState.stockId = 'aapl';
      mockStockDetailState.isStockDetailReady = true;
      renderSurface();

      expect(screen.queryByTestId('stock-status-loading')).toBeNull();
      expect(screen.getByTestId('stock-status')).toBeTruthy();
    });

    it('shows the settled public status on every surface', () => {
      mockStockDetailState.isStockDetailReady = true;
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

    it('offers retry instead of an endless skeleton after status fails', () => {
      mockStockDetailState.isStockDetailStatusError = true;
      renderSurface();

      expect(screen.queryByTestId('stock-status-loading')).toBeNull();
      expect(screen.queryByTestId('stock-status')).toBeNull();
      fireEvent.click(screen.getByTestId('swap-stock-status-retry'));
      expect(mockStockDetailState.retryStockDetail).toHaveBeenCalledTimes(1);
    });
  },
);

describe('Swap Stock status with the real provider', () => {
  const service = jest.mocked(backgroundApiProxy.serviceMarketV2);
  const stockKey = swrKeys.marketStockDetail({
    stockId: 'AAPL',
    locale: 'en-us',
  });
  const App = ({ stockTab }: { stockTab: boolean }) =>
    stockTab ? (
      <StockDetailProvider stockId="AAPL">
        <SwapStockMobileHeader />
      </StockDetailProvider>
    ) : null;

  beforeEach(() => {
    jest.clearAllMocks();
    swrCacheUtils.clearAll();
    mockUseRealStockDetail = true;
    mockStockSelectionPending = false;
    service.fetchMarketStockTokenVariants.mockResolvedValue({
      stockId: 'AAPL',
      items: [],
    });
  });

  afterEach(() => {
    mockUseRealStockDetail = false;
    swrCacheUtils.clearAll();
    swrCacheUtils.flushNow();
  });

  it('does not flash a skeleton when returning to a freshly loaded stock', async () => {
    service.fetchMarketStockDetail.mockResolvedValueOnce(publicStockDetail);
    const app = render(<App stockTab />);
    await waitFor(() =>
      expect(screen.getByTestId('stock-status')).toBeTruthy(),
    );
    app.rerender(<App stockTab={false} />);
    service.fetchMarketStockDetail.mockReturnValueOnce(
      new Promise(() => undefined),
    );
    app.rerender(<App stockTab />);

    expect(screen.queryByTestId('stock-status-loading')).toBeNull();
    expect(screen.getByTestId('stock-status')).toBeTruthy();
    await waitFor(() =>
      expect(service.fetchMarketStockDetail.mock.calls).toHaveLength(2),
    );
    expect(screen.queryByTestId('stock-status-loading')).toBeNull();
  });

  it('does not show a cold cached status when the first request fails', async () => {
    swrCacheUtils.set(stockKey, {
      stockId: 'AAPL',
      data: publicStockDetail,
      fetchedAt: Date.now(),
      fetchedInSession: 'previous-ui-session',
    });
    service.fetchMarketStockDetail.mockRejectedValue(new Error('offline'));
    render(<App stockTab />);

    expect(screen.getByTestId('stock-status-loading')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId('swap-stock-status-retry')).toBeTruthy(),
    );
    expect(screen.queryByTestId('stock-status')).toBeNull();
    service.fetchMarketStockDetail.mockResolvedValue({
      ...publicStockDetail,
      marketStatus: { isOpen: true },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('swap-stock-status-retry'));
    });
    await waitFor(() =>
      expect(
        screen.getByTestId('stock-status').getAttribute('data-is-open'),
      ).toBe('true'),
    );
  });
});
