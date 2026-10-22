/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { MobileSimpleChartFrame } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/components/MobileSimpleChartFrame';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { SimpleMarketChart } from './SimpleMarketChart';

const mockSubscribe = jest.fn();
let mockChartResult: {
  coin: string;
  range: string;
  data: IMarketTokenChart;
  intervalSeconds: number;
};
const mockUnsubscribe = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const Box = ({
    children,
    testID,
    height,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    height?: number | string;
    onPress?: () => void;
  }) =>
    onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID} style={{ height }}>
        {children}
      </div>
    );
  return {
    Button: Box,
    Icon: Box,
    SizableText: Box,
    Skeleton: Box,
    Stack: Box,
    XStack: Box,
    YStack: Box,
    ScrollView: Box,
    useTheme: () => ({ bgSubdued: { val: 'white' } }),
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: mockChartResult, run: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/components/StockPriceLineChart', () => ({
  StockPriceLineChart: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockSimpleChart/stockSimpleChartData',
  () => ({
    mergeStockSimpleChartLivePrice: ({
      points,
    }: {
      points: IMarketTokenChart;
    }) => points,
  }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsTradingViewIndicatorSettingsPersistAtom: () => [{}],
}));
jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewNative/indicatorSettingsAdapter',
  () => ({
    getTradingViewNativeSubIndicatorInstances: () => [],
    normalizeTradingViewNativeIndicatorSettings: () => ({}),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/providers/hyperliquid/tradingViewNativeHyperliquidGateway',
  () => ({
    tradingViewNativeHyperliquidGateway: { fetchCandles: jest.fn() },
  }),
);
jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/TradingViewV2ChartControls',
  () => ({
    TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT: 46,
    TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT: 32,
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockSimpleChart',
  () => ({
    TOKEN_SIMPLE_CHART_RANGES: ['1H', '1D', '1W', '1M', '1Y', 'All'],
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/MobileSimpleChart',
  () => ({
    ...(jest.requireActual(
      '@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/components/MobileSimpleChartFrame',
    ) as typeof import('@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/components/MobileSimpleChartFrame')),
    ChartModeButton: ({
      testID,
      onPress,
    }: {
      testID: string;
      onPress: () => void;
    }) => (
      <button type="button" data-testid={testID} onClick={onPress}>
        Switch chart
      </button>
    ),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewNative/TradingViewNative',
  () => {
    const React = jest.requireActual('react') as typeof import('react');
    return {
      TradingViewNative: ({
        active,
        source,
        mobileToolbarExtra,
      }: {
        active: boolean;
        source: { coin: string };
        mobileToolbarExtra?: ReactNode;
      }) => {
        const [viewport, setViewport] = React.useState('latest');
        React.useEffect(() => {
          if (!active) return;
          mockSubscribe(source.coin);
          return () => {
            mockUnsubscribe(source.coin);
          };
        }, [active, source.coin]);
        return (
          <div data-testid="candle-chart">
            <button
              type="button"
              data-testid="chart-pan"
              onClick={() => setViewport('historical')}
            >
              {viewport}
            </button>
            {mobileToolbarExtra}
          </div>
        );
      },
    };
  },
);

beforeEach(() => {
  jest.clearAllMocks();
  mockChartResult = {
    coin: 'BTC',
    range: '1D',
    data: [
      [1, 100],
      [2, 110],
    ],
    intervalSeconds: 60,
  };
});

it.each([true, false])(
  'pauses candles on blur while retaining the viewport on focus (native: %s)',
  (isNative) => {
    (platformEnv as { isNative: boolean }).isNative = isNative;
    const { getByTestId, queryByTestId, rerender } = render(
      <SimpleMarketChart coin="BTC" active />,
    );
    fireEvent.click(getByTestId('perps-simple-chart-mode-toggle'));
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith('BTC');
    fireEvent.click(getByTestId('chart-pan'));

    rerender(<SimpleMarketChart coin="BTC" active={false} />);
    expect(getByTestId('chart-pan').textContent).toBe('historical');
    expect(queryByTestId('perps-simple-market-chart')).toBeNull();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).toHaveBeenCalledWith('BTC');

    rerender(<SimpleMarketChart coin="BTC" active />);
    expect(getByTestId('candle-chart')).toBeTruthy();
    expect(getByTestId('chart-pan').textContent).toBe('historical');
    expect(mockSubscribe).toHaveBeenCalledTimes(2);
    fireEvent.click(getByTestId('perps-simple-chart-mode-toggle'));
    expect(getByTestId('perps-simple-market-chart')).toBeTruthy();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(2);
  },
);

it('preserves the extracted frame height and range selection', () => {
  const onRangeChange = jest.fn();
  const { getByTestId } = render(
    <MobileSimpleChartFrame
      range="1D"
      chartRanges={['1H', '1D']}
      onRangeChange={onRangeChange}
      height={340}
      modeControl={<span>Mode</span>}
      testID="chart-frame"
    >
      <div data-testid="chart-content" />
    </MobileSimpleChartFrame>,
  );
  expect(getByTestId('chart-content').parentElement?.style.height).toBe(
    '294px',
  );
  fireEvent.click(getByTestId('chart-frame-range-1H'));
  expect(onRangeChange).toHaveBeenCalledWith('1H');
});

it('reports range changes, clears stale data and restores the summary after switching chart modes', () => {
  const onPerformanceChange = jest.fn();
  const { getByTestId, rerender } = render(
    <SimpleMarketChart
      coin="BTC"
      active
      onPerformanceChange={onPerformanceChange}
    />,
  );
  expect(onPerformanceChange).toHaveBeenLastCalledWith({
    coin: 'BTC',
    range: '1D',
    change: '10',
    changePercent: 10,
  });
  onPerformanceChange.mockClear();
  fireEvent.click(getByTestId('perps-simple-market-chart-range-1D'));
  expect(onPerformanceChange).not.toHaveBeenCalled();
  fireEvent.click(getByTestId('perps-simple-market-chart-range-1W'));
  expect(onPerformanceChange).toHaveBeenLastCalledWith({
    coin: 'BTC',
    range: '1W',
  });
  // The previous range's response cannot supply the new range's performance.
  mockChartResult = {
    ...mockChartResult,
    data: [
      [1, 10],
      [2, 110],
    ],
  };
  rerender(
    <SimpleMarketChart
      coin="BTC"
      active
      onPerformanceChange={onPerformanceChange}
    />,
  );
  expect(onPerformanceChange).toHaveBeenLastCalledWith({
    coin: 'BTC',
    range: '1W',
  });
  mockChartResult = {
    ...mockChartResult,
    range: '1W',
    data: [
      [1, 50],
      [2, 110],
    ],
  };
  rerender(
    <SimpleMarketChart
      coin="BTC"
      active
      onPerformanceChange={onPerformanceChange}
    />,
  );
  expect(onPerformanceChange).toHaveBeenLastCalledWith({
    coin: 'BTC',
    range: '1W',
    change: '60',
    changePercent: 120,
  });
  fireEvent.click(getByTestId('perps-simple-chart-mode-toggle'));
  expect(onPerformanceChange).toHaveBeenLastCalledWith(undefined);
  fireEvent.click(getByTestId('perps-simple-chart-mode-toggle'));
  expect(onPerformanceChange).toHaveBeenLastCalledWith({
    coin: 'BTC',
    range: '1W',
    change: '60',
    changePercent: 120,
  });
});
