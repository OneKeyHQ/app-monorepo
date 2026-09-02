/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import type { IMarketSelectedTabAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { TokenDetailChart } from './TokenDetailChart';

const mockSetMarketSelectedTab = jest.fn();
const mockStockSimpleChart = jest.fn(() => (
  <div data-testid="market-token-simple-chart" />
));
let mockChartDisplayMode: 'simple' | 'pro' = 'simple';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
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
    Stack,
    XStack: Stack,
    YStack: Stack,
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketSelectedTabAtom: () => [
    { tab: 'trending', chartDisplayMode: mockChartDisplayMode },
    mockSetMarketSelectedTab,
  ],
}));

jest.mock('../../components/StockSimpleChart', () => ({
  StockSimpleChart: () => mockStockSimpleChart(),
  TOKEN_SIMPLE_CHART_RANGES: ['1H', '1D', '1W', '1M', '1Y'],
}));

jest.mock('./MarketDetailProChartControls', () => ({
  MarketDetailProChartControls: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

function renderTokenDetailChart() {
  return render(
    <TokenDetailChart
      marketTradingView={<div data-testid="market-token-pro-chart" />}
      isChartFullscreen={false}
      chartMode="native"
      onChartSwitch={jest.fn()}
      onEnterChartFullscreen={jest.fn()}
    />,
  );
}

describe('TokenDetailChart', () => {
  beforeEach(() => {
    mockChartDisplayMode = 'simple';
    mockSetMarketSelectedTab.mockReset();
    mockStockSimpleChart.mockClear();
  });

  it('restores the persisted Pro mode when the detail chart remounts', () => {
    mockChartDisplayMode = 'pro';

    const firstVisit = renderTokenDetailChart();
    expect(firstVisit.getByTestId('market-token-pro-chart')).toBeTruthy();
    expect(firstVisit.queryByTestId('market-token-simple-chart')).toBeNull();

    firstVisit.unmount();
    const secondVisit = renderTokenDetailChart();
    expect(secondVisit.getByTestId('market-token-pro-chart')).toBeTruthy();
  });

  it('persists a switch to Pro mode', () => {
    const view = renderTokenDetailChart();

    fireEvent.click(view.getByTestId('market-token-chart-mode-pro'));

    const update = mockSetMarketSelectedTab.mock.calls[0][0] as (
      prev: IMarketSelectedTabAtom,
    ) => IMarketSelectedTabAtom;
    expect(update({ tab: 'watchlist' })).toEqual({
      tab: 'watchlist',
      chartDisplayMode: 'pro',
    });
  });

  it('persists a switch back to Simple mode', () => {
    mockChartDisplayMode = 'pro';
    const view = renderTokenDetailChart();

    fireEvent.click(view.getByTestId('market-token-chart-mode-simple'));

    const update = mockSetMarketSelectedTab.mock.calls[0][0] as (
      prev: IMarketSelectedTabAtom,
    ) => IMarketSelectedTabAtom;
    expect(update({ tab: 'perps' })).toEqual({
      tab: 'perps',
      chartDisplayMode: 'simple',
    });
  });
});
