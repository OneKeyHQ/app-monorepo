/** @jest-environment jsdom */

import { type ReactNode, useContext } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { TradingViewDesktopToolbarContext } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/TradingViewDesktopToolbarContext';

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
    ScrollView: Stack,
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

jest.mock('./MarketDesktopChartContainer', () => ({
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

jest.mock('./MarketDetailProChartControls', () => ({
  MarketDetailProChartControls: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

function MockProChart() {
  const toolbar = useContext(TradingViewDesktopToolbarContext);
  return <div data-testid="market-token-pro-chart">{toolbar}</div>;
}

function renderTokenDetailChart(
  marketAssetId?: string,
  marketTradingView: ReactNode = <MockProChart />,
) {
  return render(
    <TokenDetailChart
      chartContainerTestID="market-token-chart"
      marketAssetId={marketAssetId}
      marketTradingView={marketTradingView}
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

  it('offers only the mode switch under the Pro chart', () => {
    mockChartDisplayMode = 'pro';

    const view = renderTokenDetailChart();

    // TradingView owns interval switching in Pro (it calls the K-line
    // fallback with its own interval), so an app-side range selector there
    // would be a second control disagreeing with the widget.
    expect(view.getByTestId('market-token-chart-toolbar')).toBeTruthy();
    expect(view.queryByTestId('market-token-chart-range-1D')).toBeNull();
    expect(view.queryByTestId('market-token-chart-range-All')).toBeNull();
    expect(view.getByTestId('market-token-chart-mode-simple')).toBeTruthy();
    expect(view.getByTestId('market-token-chart-mode-pro')).toBeTruthy();
  });

  it('keeps the range selector beside the mode switch in Simple mode', () => {
    const view = renderTokenDetailChart();

    expect(view.getByTestId('market-token-chart-toolbar')).toBeTruthy();
    expect(view.getByTestId('market-token-chart-range-1D')).toBeTruthy();
    expect(view.getByTestId('market-token-chart-mode-pro')).toBeTruthy();
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

  it('allows returning to Simple mode when the Pro chart is unavailable', () => {
    mockChartDisplayMode = 'pro';
    const view = renderTokenDetailChart('bitcoin', null);

    expect(view.queryByTestId('market-token-pro-chart')).toBeNull();
    fireEvent.click(view.getByTestId('market-token-chart-mode-simple'));

    expect(mockSetChartDisplayMode).toHaveBeenCalledWith({ mode: 'simple' });
  });

  it('renders only one mode switch when the Pro chart is available', () => {
    mockChartDisplayMode = 'pro';
    const view = renderTokenDetailChart('bitcoin');

    expect(view.getAllByTestId('market-token-chart-mode-simple')).toHaveLength(
      1,
    );
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
