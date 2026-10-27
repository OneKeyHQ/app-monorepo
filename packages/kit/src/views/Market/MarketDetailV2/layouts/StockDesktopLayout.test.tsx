/** @jest-environment jsdom */
// cspell:ignore Financials

import type { ReactNode } from 'react';

import { act, fireEvent, render, renderHook } from '@testing-library/react';

import type { IMarketAccountPortfolioDisplayItem } from '@onekeyhq/shared/types/marketV2';

import {
  StockChart,
  StockDesktopLayout,
  useStockDetailTab,
} from './StockDesktopLayout';

const mockSetChartDisplayMode = jest.fn();
const mockRecordTabChange = jest.fn();
let mockPreferPosition = false;
let mockPortfolioData: IMarketAccountPortfolioDisplayItem[] = [];
const mockStockSimpleChart = jest.fn(
  (_props: { priceMode: 'share' | 'token'; range: string }) => (
    <div data-testid="stock-simple-chart" />
  ),
);

jest.mock('react-intl', () => ({
  ...jest.requireActual<typeof import('react-intl')>('react-intl'),
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    testID,
    width,
    minWidth,
  }: {
    children?: ReactNode;
    testID?: string;
    width?: number | string;
    minWidth?: number | string;
  }) => (
    <div data-testid={testID} data-width={width} data-min-width={minWidth}>
      {children}
    </div>
  );
  const Button = ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button data-testid={testID} onClick={onPress} type="button">
      {children}
    </button>
  );

  return {
    Button,
    DashText: Stack,
    Empty: () => null,
    Tooltip: Stack,
    Icon: Stack,
    NumberSizeableText: Stack,
    SizableText: Stack,
    Skeleton: Stack,
    Stack,
    XStack: Stack,
    YStack: Stack,
    Tabs: { FlatList: Stack, ScrollView: Stack },
    useMedia: () => ({ gtLg: true }),
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
  useMarketDetailChartDisplayModePersistAtom: () => [
    { mode: 'simple' },
    mockSetChartDisplayMode,
  ],
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  Currency: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));
jest.mock(
  '../components/InformationTabs/components/Portfolio/components/PnlCell',
  () => ({ PnlCell: () => null }),
);
jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({ formatDate: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/views/Market/components/MarketTokenPrice', () => ({
  MarketTokenPrice: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage',
  () => ({ PriceChangePercentage: () => null }),
);
jest.mock('@onekeyhq/shared/src/logger/scopes/dex', () => ({
  EWatchlistFrom: {},
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../components/MarketStarV2', () => ({
  MarketStarV2: () => null,
}));
jest.mock('../../components/PerpsBadges', () => ({
  StockMarketStatusBadge: () => null,
}));
jest.mock('../components/StockFinancials/StockFinancials', () => ({
  StockFinancials: () => null,
}));
jest.mock('../components/StockAnalystGauge', () => ({
  StockAnalystGauge: () => null,
  parseStockAnalystRatingCounts: jest.fn(),
}));
jest.mock('./MarketEmbeddedSwap', () => ({
  MarketEmbeddedSwap: () => null,
}));
jest.mock('../components/TokenDetailHeader/ShareButton', () => ({
  ShareButton: () => null,
}));
jest.mock('../components/TokenSelector/MarketTokenSelector', () => ({
  MarketTokenSelector: () => null,
}));
jest.mock('../hooks/StockDetailContext', () => ({
  useStockDetail: () => ({
    stockId: 'AAPL',
    tokenVariants: [],
    priceSource: { priceMode: 'share', sharePriceAvailable: false },
  }),
}));
jest.mock('../hooks/useStockPortfolioData', () => ({
  useStockPortfolioData: () => ({
    portfolioData: mockPortfolioData,
    hasAccount: true,
    isRefreshing: false,
    resolvedVariantKeys: [],
  }),
}));
jest.mock('../hooks/useMarketDetailPositionTab', () => ({
  useMarketDetailPositionTab: () => ({
    preferPosition: mockPreferPosition,
    recordTabChange: mockRecordTabChange,
  }),
}));
jest.mock('../hooks/useTokenDetail', () => ({
  useTokenDetail: () => ({ networkId: 'evm--1' }),
}));
jest.mock('./components/StockEventsSection', () => ({
  StockEventsSection: () => null,
}));
jest.mock('./components/StockNewsSection', () => ({
  StockNewsSection: () => null,
}));

jest.mock('../components/StockSimpleChart', () => {
  const {
    STOCK_SHARE_SIMPLE_CHART_RANGES,
    TOKEN_SIMPLE_CHART_RANGES,
    resolveStockSimpleChartRangeForPriceMode,
  } = jest.requireActual<
    typeof import('../components/StockSimpleChart/stockSimpleChartData')
  >('../components/StockSimpleChart/stockSimpleChartData');

  return {
    StockSimpleChart: (props: {
      priceMode: 'share' | 'token';
      range: string;
    }) => mockStockSimpleChart(props),
    STOCK_SHARE_SIMPLE_CHART_RANGES,
    TOKEN_SIMPLE_CHART_RANGES,
    resolveStockSimpleChartRangeForPriceMode,
  };
});

jest.mock('./components/MarketDesktopChartContainer', () => ({
  MarketDesktopChartContainer: ({
    children,
    footer,
  }: {
    children?: ReactNode;
    footer?: ReactNode;
  }) => (
    <div>
      {children}
      {footer}
    </div>
  ),
}));

jest.mock('./components/MarketDetailProChartControls', () => ({
  MarketDetailProChartControls: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe('StockChart', () => {
  beforeEach(() => {
    mockSetChartDisplayMode.mockReset();
    mockStockSimpleChart.mockClear();
  });

  it('passes All through in token mode and sizes all six ranges', () => {
    const view = render(
      <StockChart
        chartContainerTestID="stock-chart"
        marketTradingView={<div />}
        priceMode="token"
        chartMode="native"
        onChartSwitch={jest.fn()}
        isChartFullscreen={false}
        onEnterChartFullscreen={jest.fn()}
      />,
    );

    // The selector row carries a minimum (not fixed) width so wider CJK
    // labels can grow the row instead of truncating.
    expect(
      view.getByTestId('stock-chart-range-selector').dataset.minWidth,
    ).toBe('226');

    fireEvent.click(view.getByTestId('stock-chart-range-All'));

    expect(mockStockSimpleChart).toHaveBeenLastCalledWith({
      priceMode: 'token',
      range: 'All',
      priceScaleFormat: 'full',
    });
  });

  it('offers 5Y instead of All for share prices and carries it across modes', () => {
    const renderChart = (priceMode: 'share' | 'token') => (
      <StockChart
        chartContainerTestID="stock-chart"
        marketTradingView={<div />}
        priceMode={priceMode}
        chartMode="native"
        onChartSwitch={jest.fn()}
        isChartFullscreen={false}
        onEnterChartFullscreen={jest.fn()}
      />
    );
    const view = render(renderChart('share'));

    expect(view.queryByTestId('stock-chart-range-All')).toBeNull();
    expect(view.getByTestId('stock-chart-range-5Y').textContent).toBe(
      'market.5y',
    );
    expect(
      view.getByTestId('stock-chart-range-selector').dataset.minWidth,
    ).toBe('226');

    fireEvent.click(view.getByTestId('stock-chart-range-5Y'));
    expect(mockStockSimpleChart).toHaveBeenLastCalledWith({
      priceMode: 'share',
      range: '5Y',
      priceScaleFormat: 'full',
    });

    view.rerender(renderChart('token'));
    expect(view.queryByTestId('stock-chart-range-5Y')).toBeNull();
    expect(mockStockSimpleChart).toHaveBeenLastCalledWith({
      priceMode: 'token',
      range: 'All',
      priceScaleFormat: 'full',
    });

    view.rerender(renderChart('share'));
    expect(mockStockSimpleChart).toHaveBeenLastCalledWith({
      priceMode: 'share',
      range: '5Y',
      priceScaleFormat: 'full',
    });
  });
});

describe('useStockDetailTab', () => {
  beforeEach(() => {
    mockRecordTabChange.mockClear();
    mockPreferPosition = true;
  });

  it('opens on the remembered My position tab by default', () => {
    const { result } = renderHook(() => useStockDetailTab());
    expect(result.current.activeTab).toBe('position');
  });

  it('opens an explicit Overview entry on Overview and keeps the preference', () => {
    const { result, rerender } = renderHook(
      ({ section }: { section?: 'overview' }) => useStockDetailTab(section),
      { initialProps: { section: 'overview' as 'overview' | undefined } },
    );
    expect(result.current.activeTab).toBe('overview');
    // The request is cleared once shown; the tab stays put.
    rerender({ section: undefined });
    expect(result.current.activeTab).toBe('overview');
    expect(mockRecordTabChange).not.toHaveBeenCalled();
  });

  it('switches an open page to Overview when the request arrives later', () => {
    const { result, rerender } = renderHook(
      ({ section }: { section?: 'overview' }) => useStockDetailTab(section),
      { initialProps: { section: undefined as 'overview' | undefined } },
    );
    expect(result.current.activeTab).toBe('position');
    rerender({ section: 'overview' });
    expect(result.current.activeTab).toBe('overview');
    act(() => result.current.selectTab('position'));
    expect(result.current.activeTab).toBe('position');
    expect(mockRecordTabChange).toHaveBeenCalledWith(true);
  });
});

describe('StockDesktopLayout positions', () => {
  it.each([
    ['', true],
    ['NaN', true],
    ['0.009', false],
    ['0.01', true],
  ] as const)(
    'handles a positive holding valued at %s',
    (totalPrice, visible) => {
      mockPreferPosition = true;
      mockPortfolioData = [
        {
          networkId: 'evm--1',
          tokenAddress: '0xaapl',
          accountAddress: '0xaccount',
          symbol: 'AAPL-HOLDING',
          amount: '2',
          tokenPrice: '1',
          totalPrice,
        },
      ];
      const view = render(
        <StockDesktopLayout
          marketTradingView={<div />}
          swapToken={{
            networkId: 'evm--1',
            contractAddress: '0xaapl',
            symbol: 'AAPL',
            decimals: 18,
          }}
          swapInputDraftKey="stock-portfolio-test"
          chartMode="native"
          showFavoriteButton={false}
          isChartFullscreen={false}
          chartFullscreenZIndex={1}
          onChartSwitch={jest.fn()}
          onEnterChartFullscreen={jest.fn()}
        />,
      );
      expect(Boolean(view.queryByText('AAPL-HOLDING'))).toBe(visible);
      if (visible && (!totalPrice || totalPrice === 'NaN')) {
        expect(view.getByText('--')).toBeTruthy();
        expect(view.queryByText('NaN')).toBeNull();
      }
    },
  );
});
