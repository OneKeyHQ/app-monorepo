/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { TokenDetailChart } from './TokenDetailChart';

const mockSetChartDisplayMode = jest.fn();
const mockStockSimpleChart = jest.fn(
  (_props: { marketAssetId?: string; priceMode: 'token'; range: string }) => (
    <div data-testid="market-token-simple-chart" />
  ),
);
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
  useMarketDetailChartDisplayModePersistAtom: () => [
    { mode: mockChartDisplayMode },
    mockSetChartDisplayMode,
  ],
}));

jest.mock('../../components/StockSimpleChart', () => ({
  StockSimpleChart: (props: {
    marketAssetId?: string;
    priceMode: 'token';
    range: string;
  }) => mockStockSimpleChart(props),
  TOKEN_SIMPLE_CHART_RANGES: ['1H', '1D', '1W', '1M', '1Y', 'All'],
}));

jest.mock('./MarketDetailProChartControls', () => ({
  MarketDetailProChartControls: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

function renderTokenDetailChart(marketAssetId?: string) {
  return render(
    <TokenDetailChart
      marketAssetId={marketAssetId}
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
    mockSetChartDisplayMode.mockReset();
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

  it('keeps the complete-history range available in Simple mode', () => {
    const view = renderTokenDetailChart();

    expect(view.getByTestId('market-token-chart-range-All')).toBeTruthy();
  });

  it('forwards the Top Coins asset identity to Simple mode', () => {
    renderTokenDetailChart('doge');

    expect(mockStockSimpleChart).toHaveBeenCalledWith(
      expect.objectContaining({ marketAssetId: 'doge' }),
    );
  });

  it('persists a switch to Pro mode', () => {
    const view = renderTokenDetailChart();

    fireEvent.click(view.getByTestId('market-token-chart-mode-pro'));

    expect(mockSetChartDisplayMode).toHaveBeenCalledWith({ mode: 'pro' });
  });

  it('persists a switch back to Simple mode', () => {
    mockChartDisplayMode = 'pro';
    const view = renderTokenDetailChart();

    fireEvent.click(view.getByTestId('market-token-chart-mode-simple'));

    expect(mockSetChartDisplayMode).toHaveBeenCalledWith({ mode: 'simple' });
  });

  it('localizes All and passes it to the simple chart', () => {
    const view = renderTokenDetailChart();
    const allRangeButton = view.getByTestId('market-token-chart-range-All');

    expect(allRangeButton.textContent).toBe('global.all');
    fireEvent.click(allRangeButton);

    expect(mockStockSimpleChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        priceMode: 'token',
        range: 'All',
      }),
    );
  });
});
