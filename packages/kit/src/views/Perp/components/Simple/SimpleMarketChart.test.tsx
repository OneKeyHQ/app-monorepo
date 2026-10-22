/** @jest-environment jsdom */

import { type ReactNode, useState } from 'react';

import { fireEvent, render } from '@testing-library/react';

import type { ILightweightChartProps } from '@onekeyhq/kit/src/components/LightweightChart/types';
import { StockPriceLineChart } from '@onekeyhq/kit/src/components/StockPriceLineChart';
import { MobileSimpleChartFrame } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/components/MobileSimpleChartFrame';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { SimpleMarketChart } from './SimpleMarketChart';

import type { ISimpleMarketChartPrice } from './SimpleMarketChart';

const mockSubscribe = jest.fn();
const mockUnsubscribe = jest.fn();
let mockChartProps: ILightweightChartProps;
let mockSeries:
  | {
      coin: string;
      range: string;
      data?: IMarketTokenChart;
      error: boolean;
    }
  | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@tamagui/core', () => ({
  useTheme: () =>
    Object.fromEntries(
      [
        'textSuccess',
        'textSubdued',
        'bgApp',
        'borderStrong',
        'primary10',
        'textInverse',
        'bgSuccessStrong',
        'bg',
        'borderSubdued',
        'text',
        'textDisabled',
      ].map((name) => [name, { val: '#123456' }]),
    ),
}));
jest.mock('@onekeyhq/components', () => {
  const Box = ({
    children,
    testID,
    height,
    onPress,
    onTouchEnd,
    onTouchCancel,
    onPointerUp,
    onPointerCancel,
    onPointerDown,
    onPointerLeave,
  }: {
    children?: ReactNode;
    testID?: string;
    height?: number | string;
    onPress?: () => void;
    onTouchEnd?: () => void;
    onTouchCancel?: () => void;
    onPointerUp?: () => void;
    onPointerCancel?: () => void;
    onPointerDown?: () => void;
    onPointerLeave?: () => void;
  }) =>
    onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div
        data-testid={testID}
        style={{ height }}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerDown={onPointerDown}
        onPointerLeave={onPointerLeave}
      >
        {children}
      </div>
    );
  return {
    Button: Box,
    Icon: Box,
    SizableText: Box,
    NumberSizeableText: Box,
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
  usePromiseResult: () => ({ result: mockSeries, run: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/components/LightweightChart', () => ({
  LightweightChart: (props: ILightweightChartProps) => {
    mockChartProps = props;
    return (
      <button
        type="button"
        data-testid="scrub-price"
        onClick={() => {
          const [time, price] = props.data[1];
          props.onHover?.({ time, price, x: 100, y: 100 });
        }}
      >
        Scrub
      </button>
    );
  },
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
    TOKEN_SIMPLE_CHART_RANGES: ['1H', '1D'],
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
  mockSeries = undefined;
  Object.assign(platformEnv, { isNative: false, isNativeAndroid: false });
});

function PriceHeader({
  coin = 'BTC',
  active = true,
}: {
  coin?: string;
  active?: boolean;
}) {
  const [price, setPrice] = useState<ISimpleMarketChartPrice>();
  return (
    <>
      <output data-testid="price-header">
        {JSON.stringify(price) ?? 'live'}
      </output>
      <SimpleMarketChart coin={coin} active={active} onPriceChange={setPrice} />
    </>
  );
}

it.each([
  { isNative: false, isNativeAndroid: false },
  { isNative: true, isNativeAndroid: false },
  { isNative: true, isNativeAndroid: true },
])(
  'links the header to the selected range and restores its latest price on release (%j)',
  (platform) => {
    Object.assign(platformEnv, platform);
    mockSeries = {
      coin: 'BTC',
      range: '1D',
      data: [
        [1000, 100],
        [2000, 110],
        [3000, 120],
      ],
      error: false,
    };
    const { getByTestId } = render(<PriceHeader />);
    expect(getByTestId('price-header').textContent).toBe(
      '{"coin":"BTC","price":120,"changePercent":"20"}',
    );
    expect(mockChartProps.showPriceScale).toBe(false);
    expect(mockChartProps.showLastValue).toBe(false);
    if (platform.isNative) {
      expect(mockChartProps.nativeScrubOptions).toMatchObject({
        showTooltip: false,
        exitOnTouchEnd: true,
      });
    }
    const chart = getByTestId('perps-simple-price-line-chart');
    if (!platform.isNative) {
      fireEvent.click(getByTestId('scrub-price'));
      expect(getByTestId('price-header').textContent).toBe(
        '{"coin":"BTC","price":120,"changePercent":"20"}',
      );
    }
    fireEvent.pointerDown(chart);
    fireEvent.click(getByTestId('scrub-price'));
    expect(getByTestId('price-header').textContent).toBe(
      '{"coin":"BTC","price":110,"changePercent":"10"}',
    );
    fireEvent.touchEnd(chart);
    expect(getByTestId('price-header').textContent).toBe(
      '{"coin":"BTC","price":120,"changePercent":"20"}',
    );
    fireEvent.pointerDown(chart);
    fireEvent.click(getByTestId('scrub-price'));
    fireEvent.touchCancel(chart);
    expect(getByTestId('price-header').textContent).toBe(
      '{"coin":"BTC","price":120,"changePercent":"20"}',
    );
    fireEvent.pointerDown(chart);
    fireEvent.click(getByTestId('scrub-price'));
    fireEvent.pointerUp(chart);
    expect(getByTestId('price-header').textContent).toBe(
      '{"coin":"BTC","price":120,"changePercent":"20"}',
    );
    fireEvent.click(getByTestId('perps-simple-chart-mode-toggle'));
    expect(getByTestId('price-header').textContent).toBe('live');
  },
);

it('discards a selected point when the range, coin, or focus changes', () => {
  mockSeries = {
    coin: 'BTC',
    range: '1D',
    data: [
      [1000, 100],
      [2000, 110],
      [3000, 120],
    ],
    error: false,
  };
  const { getByTestId, rerender } = render(<PriceHeader />);
  fireEvent.pointerDown(getByTestId('perps-simple-price-line-chart'));
  fireEvent.click(getByTestId('scrub-price'));
  mockSeries = {
    coin: 'BTC',
    range: '1H',
    data: [
      [2000, 110],
      [2500, 115.5],
      [3000, 121],
    ],
    error: false,
  };
  fireEvent.click(getByTestId('perps-simple-market-chart-range-1H'));
  expect(getByTestId('price-header').textContent).toBe(
    '{"coin":"BTC","price":121,"changePercent":"10"}',
  );
  fireEvent.pointerDown(getByTestId('perps-simple-price-line-chart'));
  fireEvent.click(getByTestId('scrub-price'));
  rerender(<PriceHeader active={false} />);
  expect(getByTestId('price-header').textContent).toBe('live');
  rerender(<PriceHeader />);
  expect(getByTestId('price-header').textContent).toBe(
    '{"coin":"BTC","price":121,"changePercent":"10"}',
  );
  fireEvent.pointerDown(getByTestId('perps-simple-price-line-chart'));
  fireEvent.click(getByTestId('scrub-price'));
  rerender(<PriceHeader coin="ETH" />);
  expect(getByTestId('price-header').textContent).toBe('{"coin":"ETH"}');
  rerender(<PriceHeader coin="ETH" active={false} />);
  expect(getByTestId('price-header').textContent).toBe('live');
});

it('reports unavailable range changes during loading, failure, and empty history', () => {
  const { getByTestId, rerender } = render(<PriceHeader />);
  expect(getByTestId('price-header').textContent).toBe('{"coin":"BTC"}');
  mockSeries = { coin: 'BTC', range: '1D', error: true };
  rerender(<PriceHeader />);
  expect(getByTestId('price-header').textContent).toBe('{"coin":"BTC"}');
  mockSeries = { coin: 'BTC', range: '1D', data: [], error: false };
  rerender(<PriceHeader />);
  expect(getByTestId('price-header').textContent).toBe('{"coin":"BTC"}');
});

it('retains a held historical point during live updates and releases to the new latest price', () => {
  mockSeries = {
    coin: 'BTC',
    range: '1D',
    error: false,
    data: [
      [1000, 100],
      [2000, 110],
      [3000, 120],
    ],
  };
  const { getByTestId, rerender } = render(<PriceHeader />);
  const chart = getByTestId('perps-simple-price-line-chart');
  fireEvent.pointerDown(chart);
  fireEvent.click(getByTestId('scrub-price'));
  mockSeries = {
    ...mockSeries,
    data: [
      [1000, 100],
      [2000, 110],
      [4000, 125],
    ],
  };
  rerender(<PriceHeader />);
  expect(getByTestId('price-header').textContent).toBe(
    '{"coin":"BTC","price":110,"changePercent":"10"}',
  );
  fireEvent.pointerCancel(chart);
  expect(getByTestId('price-header').textContent).toBe(
    '{"coin":"BTC","price":125,"changePercent":"25"}',
  );
  fireEvent.click(getByTestId('scrub-price'));
  expect(getByTestId('price-header').textContent).toBe(
    '{"coin":"BTC","price":125,"changePercent":"25"}',
  );
});

it('keeps the shared chart price axis and current-price label enabled by default', () => {
  render(
    <StockPriceLineChart
      data={[[1000, 100]]}
      height={200}
      showCurrentPriceLabel
    />,
  );
  expect(mockChartProps.showPriceScale).toBe(true);
  expect(mockChartProps.showLastValue).toBe(true);
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
