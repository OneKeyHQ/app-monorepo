/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { StockChart } from './StockDesktopLayout';

const mockSetChartDisplayMode = jest.fn();
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
    Icon: Stack,
    NumberSizeableText: Stack,
    SizableText: Stack,
    Skeleton: Stack,
    Stack,
    XStack: Stack,
    YStack: Stack,
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
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
jest.mock('../components/InformationTabs/components/Portfolio', () => ({
  Portfolio: () => null,
}));
jest.mock('../components/StockAnalystGauge', () => ({
  StockAnalystGauge: () => null,
  parseStockAnalystRatingCounts: jest.fn(),
}));
jest.mock('../components/SwapPanel/SwapPanel', () => ({
  SwapPanel: () => null,
}));
jest.mock('../components/TokenDetailHeader/ShareButton', () => ({
  ShareButton: () => null,
}));
jest.mock('../components/TokenSelector/MarketTokenSelector', () => ({
  MarketTokenSelector: () => null,
}));
jest.mock('../hooks/StockDetailContext', () => ({
  useStockDetail: jest.fn(),
}));
jest.mock('../hooks/useStockPortfolioData', () => ({
  useStockPortfolioData: jest.fn(),
}));
jest.mock('../hooks/useTokenDetail', () => ({
  useTokenDetail: jest.fn(),
}));
jest.mock('./components/StockEventsSection', () => ({
  StockEventsSection: () => null,
}));
jest.mock('./components/StockNewsSection', () => ({
  StockNewsSection: () => null,
}));

jest.mock('../components/StockSimpleChart', () => {
  const { STOCK_SHARE_SIMPLE_CHART_RANGES, TOKEN_SIMPLE_CHART_RANGES } =
    jest.requireActual<
      typeof import('../components/StockSimpleChart/stockSimpleChartData')
    >('../components/StockSimpleChart/stockSimpleChartData');

  return {
    StockSimpleChart: (props: {
      priceMode: 'share' | 'token';
      range: string;
    }) => mockStockSimpleChart(props),
    STOCK_SHARE_SIMPLE_CHART_RANGES,
    TOKEN_SIMPLE_CHART_RANGES,
  };
});

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
        marketTradingView={<div />}
        priceMode="token"
        chartMode="native"
        onHoverChange={jest.fn()}
        onChartSwitch={jest.fn()}
        isChartFullscreen={false}
        onEnterChartFullscreen={jest.fn()}
      />,
    );

    // The selector row carries a minimum (not fixed) width so wider CJK
    // labels can grow the row instead of truncating.
    expect(
      view.getByTestId('stock-chart-range-selector').dataset.minWidth,
    ).toBe('214');

    fireEvent.click(view.getByTestId('stock-chart-range-All'));

    expect(mockStockSimpleChart).toHaveBeenLastCalledWith({
      priceMode: 'token',
      range: 'All',
      onHoverChange: expect.any(Function),
    });
  });
});
