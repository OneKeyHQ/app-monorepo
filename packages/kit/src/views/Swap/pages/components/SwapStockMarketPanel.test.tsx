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
  SwapStockVariantSelector,
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
    isTokenVariantsFresh: true,
    retryTokenVariants: jest
      .fn<Promise<void>, []>()
      .mockResolvedValue(undefined),
    setSelectedTokenId: jest.fn(),
  };
}

let mockStockDetailState = createStockDetailState();
let mockStockSelectionPending = false;
let mockUseRealStockDetail = false;
let mockChartMode: 'simple' | 'pro' = 'simple';
let mockProSourceAvailable = false;
let mockGtLg = false;
let mockCurrentStockToken = {
  networkId: 'evm--1',
  contractAddress: '0xaapl',
  symbol: 'AAPLon',
};
const mockSimpleChart = jest.fn<
  null,
  [{ onPriceUpdate?: (price: number | undefined) => void }]
>(() => null);
const mockProChart = jest.fn<
  null,
  [{ onPriceUpdate?: (data: { price: number }) => void }]
>(() => null);
const initialPlatformEnv = {
  isDesktop: platformEnv.isDesktop,
  isWeb: platformEnv.isWeb,
  isExtension: platformEnv.isExtension,
  isNative: platformEnv.isNative,
  isNativeIOS: platformEnv.isNativeIOS,
  isNativeAndroid: platformEnv.isNativeAndroid,
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
    useMedia: () => ({ gtLg: mockGtLg }),
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
  TradingViewNative: (props: {
    onPriceUpdate?: (data: { price: number }) => void;
  }) => mockProChart(props),
  getTradingViewNativeSourceKey: () => '',
}));
jest.mock('@onekeyhq/kit/src/views/Market/components/MarketTokenPrice', () => ({
  BaseMarketTokenPrice: ({ price }: { price: string }) => <span>{price}</span>,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/components/MarketTooltipLabel',
  () => ({
    MarketTooltipLabel: ({ children }: { children?: ReactNode }) => children,
  }),
);
jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  StockMarketStatusBadge: ({
    stock,
    showLastUpdate = true,
  }: {
    stock?: IMarketStockInfo;
    showLastUpdate?: boolean;
  }) => (
    <div
      data-testid="stock-status"
      data-title={stock?.title}
      data-is-open={String(stock?.isOpen)}
      data-updated-at={stock?.priceUpdatedAt}
      data-show-last-update={String(showLastUpdate)}
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
  () => ({
    StockSimpleChartContent: (props: {
      onPriceUpdate?: (price: number | undefined) => void;
    }) => mockSimpleChart(props),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/components/MarketDesktopChartContainer',
  () => ({
    MarketDesktopChartContainer: ({
      children,
      footer,
      testID,
    }: {
      children: ReactNode;
      footer?: ReactNode;
      testID: string;
    }) => (
      <div>
        <div data-testid={testID}>{children}</div>
        {footer}
      </div>
    ),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockTokenInfo/StockTokenInfoPopover',
  () => ({
    StockTokenInfoPopover: ({ label }: { label: ReactNode }) => (
      <div data-testid="stock-token-info">{label}</div>
    ),
  }),
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
    { mode: mockChartMode },
    jest.fn(),
  ],
  useSwapStockIssuerPreferencePersistAtom: () => [{}, jest.fn()],
}));
jest.mock('../modal/swapKLineTradingViewNativeUtils', () => ({
  getSwapKLineTradingViewNativeSource: () =>
    mockProSourceAvailable ? { kind: 'token' } : undefined,
}));
jest.mock('./SwapStockMarketData', () => ({
  SwapStockMarketDataGrid: () => null,
}));
jest.mock('./SwapStockMarketProvider', () => ({
  useSwapStockSelection: () => ({
    stockSelectionPending: mockStockSelectionPending,
    loadingScopes: { tradeTarget: mockStockSelectionPending },
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
    currentStockToken: mockCurrentStockToken,
    displayStockTokenDetail: {
      price: '343.17',
      stock: { source: 'ondo', isOpen: true },
    },
  }),
}));

describe('Swap Stock trade target price', () => {
  beforeEach(() => {
    mockStockDetailState = createStockDetailState();
    mockStockSelectionPending = false;
    mockGtLg = false;
  });

  afterEach(() => {
    Object.assign(platformEnv, initialPlatformEnv);
    mockGtLg = false;
  });

  it.each(['ios', 'android', 'web', 'extension'] as const)(
    'shows the selected token price on small-screen %s and keeps the loading placeholder',
    (platform) => {
      platformEnv.isNative = platform === 'ios' || platform === 'android';
      platformEnv.isNativeIOS = platform === 'ios';
      platformEnv.isNativeAndroid = platform === 'android';
      platformEnv.isWeb = platform === 'web';
      platformEnv.isExtension = platform === 'extension';
      const { rerender } = render(
        <SwapStockVariantSelector hasMarketPanel={false} />,
      );

      expect(screen.getByTestId('stock-token-info').textContent).toBe('343.17');
      mockStockDetailState.isTokenVariantPending = true;
      rerender(<SwapStockVariantSelector hasMarketPanel={false} />);
      expect(screen.queryByTestId('stock-token-info')).toBeNull();
      expect(screen.getByTestId('skeleton')).toBeTruthy();

      mockStockDetailState.isTokenVariantPending = false;
      rerender(<SwapStockVariantSelector hasMarketPanel={false} />);
      expect(screen.getByTestId('stock-token-info').textContent).toBe('343.17');
    },
  );

  it.each(['desktop', 'web', 'extension'] as const)(
    'hides the selected token price when the market panel is present on %s',
    (platform) => {
      platformEnv.isNative = false;
      platformEnv.isDesktop = platform === 'desktop';
      platformEnv.isWeb = platform === 'web';
      platformEnv.isExtension = platform === 'extension';
      mockGtLg = true;
      mockStockDetailState.isTokenVariantPending = true;
      const { rerender } = render(<SwapStockVariantSelector hasMarketPanel />);

      expect(screen.queryByTestId('stock-token-info')).toBeNull();
      expect(screen.queryByTestId('skeleton')).toBeNull();
      mockStockDetailState.isTokenVariantPending = false;
      rerender(<SwapStockVariantSelector hasMarketPanel />);
      expect(screen.queryByTestId('stock-token-info')).toBeNull();
      expect(screen.queryByText('343.17')).toBeNull();
    },
  );

  it.each(['desktop', 'web', 'extension'] as const)(
    'shows the price without a details entry when no market panel exists on large-screen %s',
    (platform) => {
      platformEnv.isNative = false;
      platformEnv.isDesktop = platform === 'desktop';
      platformEnv.isWeb = platform === 'web';
      platformEnv.isExtension = platform === 'extension';
      mockGtLg = true;
      const { rerender } = render(
        <SwapStockVariantSelector hasMarketPanel={false} />,
      );

      expect(screen.getByText('343.17')).toBeTruthy();
      expect(screen.queryByTestId('stock-token-info')).toBeNull();
      mockStockDetailState.isTokenVariantPending = true;
      rerender(<SwapStockVariantSelector hasMarketPanel={false} />);
      expect(screen.getByTestId('skeleton')).toBeTruthy();
    },
  );

  it.each(['ios', 'android'] as const)(
    'retains the selected token price without a details entry on large native %s screens',
    (platform) => {
      platformEnv.isNative = true;
      platformEnv.isNativeIOS = platform === 'ios';
      platformEnv.isNativeAndroid = platform === 'android';
      mockGtLg = true;
      const { rerender } = render(
        <SwapStockVariantSelector hasMarketPanel={false} />,
      );

      expect(screen.getByText('343.17')).toBeTruthy();
      expect(screen.queryByTestId('stock-token-info')).toBeNull();
      mockStockDetailState.isTokenVariantPending = true;
      rerender(<SwapStockVariantSelector hasMarketPanel={false} />);
      expect(screen.getByTestId('skeleton')).toBeTruthy();
      expect(screen.queryByTestId('stock-token-info')).toBeNull();
      mockStockDetailState.isTokenVariantPending = false;
      mockGtLg = false;
      rerender(<SwapStockVariantSelector hasMarketPanel={false} />);
      expect(screen.getByTestId('stock-token-info').textContent).toBe('343.17');
    },
  );

  it('updates the price when the market panel appears or disappears', () => {
    platformEnv.isNative = false;
    platformEnv.isExtension = true;
    const { rerender } = render(
      <SwapStockVariantSelector hasMarketPanel={false} />,
    );

    expect(screen.getByTestId('stock-token-info').textContent).toBe('343.17');
    mockGtLg = true;
    rerender(<SwapStockVariantSelector hasMarketPanel />);
    expect(screen.queryByTestId('stock-token-info')).toBeNull();
    expect(screen.queryByText('343.17')).toBeNull();
    mockGtLg = false;
    rerender(<SwapStockVariantSelector hasMarketPanel={false} />);
    expect(screen.getByTestId('stock-token-info').textContent).toBe('343.17');
  });
});

describe('Swap Stock chart and headline price ownership', () => {
  beforeEach(() => {
    mockStockDetailState = createStockDetailState();
    mockStockDetailState.isStockDetailReady = true;
    mockStockSelectionPending = false;
    mockChartMode = 'simple';
    mockProSourceAvailable = false;
    mockCurrentStockToken = {
      networkId: 'evm--1',
      contractAddress: '0xaapl',
      symbol: 'AAPLon',
    };
    mockSimpleChart.mockClear();
    mockProChart.mockClear();
  });

  afterEach(() => {
    mockChartMode = 'simple';
    mockProSourceAvailable = false;
  });

  it('keeps the toolbar outside the resizable chart in Simple and Pro modes', () => {
    mockProSourceAvailable = true;
    const { rerender } = render(<SwapStockMarketPanel />);
    const chart = screen.getByTestId('swap-stock-chart');
    expect(chart.contains(screen.getByTestId('swap-stock-chart-toolbar'))).toBe(
      false,
    );
    expect(mockSimpleChart).toHaveBeenCalled();

    mockChartMode = 'pro';
    rerender(<SwapStockMarketPanel />);
    expect(screen.getByTestId('swap-stock-chart')).toBe(chart);
    expect(chart.contains(screen.getByTestId('swap-stock-chart-toolbar'))).toBe(
      false,
    );
    expect(mockProChart).toHaveBeenCalled();
  });

  it('uses the visible chart close and rejects callbacks from a previous token or mode', () => {
    const { rerender } = render(<SwapStockMarketPanel />);
    fireEvent.click(screen.getByTestId('swap-stock-price-mode-token'));
    const oldSimpleUpdate =
      mockSimpleChart.mock.calls.at(-1)?.[0].onPriceUpdate;
    act(() => oldSimpleUpdate?.(343.4));
    expect(screen.getByTestId('swap-stock-price').textContent).toContain(
      '343.4',
    );

    mockCurrentStockToken = {
      ...mockCurrentStockToken,
      contractAddress: '0xnew',
    };
    rerender(<SwapStockMarketPanel />);
    expect(screen.getByTestId('swap-stock-price').textContent).toContain(
      '343.17',
    );
    act(() => oldSimpleUpdate?.(999));
    expect(screen.getByTestId('swap-stock-price').textContent).toContain(
      '343.17',
    );
    const nextSimpleUpdate =
      mockSimpleChart.mock.calls.at(-1)?.[0].onPriceUpdate;
    act(() => nextSimpleUpdate?.(350));
    expect(screen.getByTestId('swap-stock-price').textContent).toContain('350');

    mockCurrentStockToken = {
      ...mockCurrentStockToken,
      contractAddress: '0xaapl',
    };
    rerender(<SwapStockMarketPanel />);
    act(() => oldSimpleUpdate?.(999));
    expect(screen.getByTestId('swap-stock-price').textContent).toContain(
      '343.17',
    );

    fireEvent.click(screen.getByTestId('swap-stock-price-mode-share'));
    act(() => nextSimpleUpdate?.(999));
    expect(screen.getByTestId('swap-stock-price').textContent).toContain(
      '340.97',
    );
    fireEvent.click(screen.getByTestId('swap-stock-price-mode-token'));
    expect(screen.getByTestId('swap-stock-price').textContent).toContain(
      '343.17',
    );
  });

  it('uses the Pro close after switching modes and falls back when Simple has no chart', () => {
    mockProSourceAvailable = true;
    const { rerender } = render(<SwapStockMarketPanel />);
    fireEvent.click(screen.getByTestId('swap-stock-price-mode-token'));
    const simpleUpdate = mockSimpleChart.mock.calls.at(-1)?.[0].onPriceUpdate;
    act(() => simpleUpdate?.(343.4));
    act(() => simpleUpdate?.(undefined));
    expect(screen.getByTestId('swap-stock-price').textContent).toContain(
      '343.17',
    );

    mockChartMode = 'pro';
    rerender(<SwapStockMarketPanel />);
    const proUpdate = mockProChart.mock.calls.at(-1)?.[0].onPriceUpdate;
    act(() => proUpdate?.({ price: 345 }));
    expect(screen.getByTestId('swap-stock-price').textContent).toContain('345');
    act(() => simpleUpdate?.(999));
    expect(screen.getByTestId('swap-stock-price').textContent).toContain('345');
  });
});

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

    it('notes the share price update only where the share price shows', () => {
      mockStockDetailState.isStockDetailReady = true;
      renderSurface();

      // Mobile trade quotes the token only; desktop opens on the share price.
      expect(
        screen
          .getByTestId('stock-status')
          .getAttribute('data-show-last-update'),
      ).toBe(surface === 'mobile' ? 'false' : 'true');
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
