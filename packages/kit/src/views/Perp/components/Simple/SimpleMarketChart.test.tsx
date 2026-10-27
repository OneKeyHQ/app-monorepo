/** @jest-environment jsdom */

import { type ReactNode, useState } from 'react';

import { fireEvent, render } from '@testing-library/react';

import type { ISegmentControlProps } from '@onekeyhq/components';
import type { ILightweightChartProps } from '@onekeyhq/kit/src/components/LightweightChart/types';
import { StockPriceLineChart } from '@onekeyhq/kit/src/components/StockPriceLineChart';
import { MobileSimpleChartFrame } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/components/MobileSimpleChartFrame';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { getSimpleChartDisplayPerformance } from '../../utils/simpleChart';

import { SimpleMarketChart } from './SimpleMarketChart';
import { SimpleMarketHeader } from './SimpleMarketHeader';

import type { ISimpleMarketChartPrice } from './SimpleMarketChart';

const mockSubscribe = jest.fn();
const mockUnsubscribe = jest.fn();
let mockChartProps: ILightweightChartProps;
let mockIsLoading = false;
let mockSeries:
  | {
      coin: string;
      range: string;
      data?: IMarketTokenChart;
      error: boolean;
    }
  | undefined;

jest.mock('@onekeyhq/kit/src/components/RollingNumberText', () => ({
  RollingNumberText: (
    props: import('@onekeyhq/components').ISizableTextProps,
  ) => {
    const { SizableText } = jest.requireMock(
      '@onekeyhq/components',
    ) as typeof import('@onekeyhq/components');
    return <SizableText {...props} />;
  },
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  PerpDexBadge: () => null,
}));
jest.mock('@onekeyhq/shared/src/utils/perpsUtils', () => ({
  getHyperliquidTokenImageUris: () => [],
  parseDexCoin: (coin: string) => ({ displayName: coin }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en',
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
    SegmentControl: ({
      value,
      options,
      onChange,
      testID,
    }: ISegmentControlProps) => (
      <div data-testid={testID}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            data-testid={option.testID}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {typeof option.label === 'function'
              ? option.label({
                  active: option.value === value,
                  hovered: false,
                  color: '$text',
                })
              : option.label}
          </button>
        ))}
      </div>
    ),
    Icon: Box,
    SizableText: Box,
    NumberSizeableText: Box,
    Skeleton: (props: { width?: string; height?: string }) => (
      <Box {...props} testID="loading-skeleton" />
    ),
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
  usePromiseResult: () => ({
    result: mockSeries,
    isLoading: mockIsLoading,
    run: jest.fn(),
  }),
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
  mockIsLoading = false;
  jest.clearAllMocks();
  mockSeries = undefined;
  Object.assign(platformEnv, { isNative: false, isNativeAndroid: false });
});

function PriceHeader({
  coin = 'BTC',
  active = true,
  dayPerformance = {},
}: {
  coin?: string;
  active?: boolean;
  dayPerformance?: { change?: string; changePercent?: number };
}) {
  const [price, setPrice] = useState<ISimpleMarketChartPrice>();
  const performance = getSimpleChartDisplayPerformance(price, dayPerformance);
  const changeKnown =
    performance.changePercent !== undefined &&
    Number.isFinite(performance.changePercent);
  return (
    <>
      <output data-testid="price-header">
        {JSON.stringify(price) ?? 'live'}
      </output>
      <div data-testid="market-header">
        <SimpleMarketHeader
          coin={coin}
          width={200}
          price="120"
          changeLabel={changeKnown ? String(performance.changePercent) : '--'}
          changeLoading={!changeKnown && price?.isLoading}
          changeColor="$textSubdued"
        />
      </div>
      <SimpleMarketChart coin={coin} active={active} onPriceChange={setPrice} />
    </>
  );
}

it('does not report unchanged display prices after quote or history refreshes', () => {
  const onPriceChange = jest.fn();
  const { rerender } = render(
    <SimpleMarketChart
      coin="BTC"
      active
      livePrice="120"
      onPriceChange={onPriceChange}
    />,
  );
  expect(onPriceChange).toHaveBeenCalledTimes(1);
  rerender(
    <SimpleMarketChart
      coin="BTC"
      active
      livePrice="121"
      onPriceChange={onPriceChange}
    />,
  );
  expect(onPriceChange).toHaveBeenCalledTimes(1);

  mockSeries = {
    coin: 'BTC',
    range: '1D',
    data: [
      [1000, 100],
      [2000, 120],
    ],
    error: false,
  };
  rerender(
    <SimpleMarketChart coin="BTC" active onPriceChange={onPriceChange} />,
  );
  expect(onPriceChange).toHaveBeenCalledTimes(2);
  mockSeries = {
    ...mockSeries,
    data: [
      [1000, 100],
      [2000, 120],
    ],
  };
  rerender(
    <SimpleMarketChart coin="BTC" active onPriceChange={onPriceChange} />,
  );
  expect(onPriceChange).toHaveBeenCalledTimes(2);

  mockSeries = {
    ...mockSeries,
    data: [
      [1000, 100],
      [2000, 130],
    ],
  };
  rerender(
    <SimpleMarketChart coin="BTC" active onPriceChange={onPriceChange} />,
  );
  expect(onPriceChange).toHaveBeenCalledTimes(3);
  expect(onPriceChange).toHaveBeenLastCalledWith({
    coin: 'BTC',
    range: '1D',
    price: 130,
    change: '30',
    changePercent: 30,
  });
});

it('keeps a held price when the parent replaces its callback and clears only on unmount', () => {
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
  const firstCallback = jest.fn();
  const nextCallback = jest.fn();
  const { getByTestId, rerender, unmount } = render(
    <SimpleMarketChart coin="BTC" active onPriceChange={firstCallback} />,
  );
  fireEvent.pointerDown(getByTestId('perps-simple-price-line-chart'));
  fireEvent.click(getByTestId('scrub-price'));
  expect(firstCallback).toHaveBeenLastCalledWith(
    expect.objectContaining({ price: 110, isScrubbing: true }),
  );
  firstCallback.mockClear();
  rerender(
    <SimpleMarketChart coin="BTC" active onPriceChange={nextCallback} />,
  );
  expect(firstCallback).not.toHaveBeenCalled();
  expect(nextCallback).not.toHaveBeenCalled();
  fireEvent.touchEnd(getByTestId('perps-simple-price-line-chart'));
  expect(nextCallback).toHaveBeenCalledTimes(1);
  expect(nextCallback).toHaveBeenLastCalledWith(
    expect.objectContaining({ price: 120 }),
  );
  unmount();
  expect(nextCallback).toHaveBeenCalledTimes(2);
  expect(nextCallback).toHaveBeenLastCalledWith(undefined);
});

it.each([
  { isNative: false, isNativeAndroid: false },
  { isNative: true, isNativeAndroid: false },
  { isNative: true, isNativeAndroid: true },
])(
  'links the header to the selected point and restores the latest price on release (%j)',
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
      '{"coin":"BTC","range":"1D","price":120,"change":"20","changePercent":20}',
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
        '{"coin":"BTC","range":"1D","price":120,"change":"20","changePercent":20}',
      );
    }
    fireEvent.pointerDown(chart);
    fireEvent.click(getByTestId('scrub-price'));
    expect(getByTestId('price-header').textContent).toBe(
      '{"coin":"BTC","range":"1D","price":110,"change":"10","changePercent":10,"isScrubbing":true}',
    );
    fireEvent.touchEnd(chart);
    expect(getByTestId('price-header').textContent).toBe(
      '{"coin":"BTC","range":"1D","price":120,"change":"20","changePercent":20}',
    );
    fireEvent.pointerDown(chart);
    fireEvent.click(getByTestId('scrub-price'));
    fireEvent.touchCancel(chart);
    expect(getByTestId('price-header').textContent).toBe(
      '{"coin":"BTC","range":"1D","price":120,"change":"20","changePercent":20}',
    );
    fireEvent.pointerDown(chart);
    fireEvent.click(getByTestId('scrub-price'));
    fireEvent.pointerUp(chart);
    expect(getByTestId('price-header').textContent).toBe(
      '{"coin":"BTC","range":"1D","price":120,"change":"20","changePercent":20}',
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
    '{"coin":"BTC","range":"1H","price":121,"change":"11","changePercent":10}',
  );
  fireEvent.pointerDown(getByTestId('perps-simple-price-line-chart'));
  fireEvent.click(getByTestId('scrub-price'));
  rerender(<PriceHeader active={false} />);
  expect(getByTestId('price-header').textContent).toBe('live');
  rerender(<PriceHeader />);
  expect(getByTestId('price-header').textContent).toBe(
    '{"coin":"BTC","range":"1H","price":121,"change":"11","changePercent":10}',
  );
  fireEvent.pointerDown(getByTestId('perps-simple-price-line-chart'));
  fireEvent.click(getByTestId('scrub-price'));
  rerender(<PriceHeader coin="ETH" />);
  expect(getByTestId('price-header').textContent).toBe(
    '{"coin":"ETH","range":"1H","isLoading":true}',
  );
  rerender(<PriceHeader coin="ETH" active={false} />);
  expect(getByTestId('price-header').textContent).toBe('live');
});

it('shows a change skeleton only while unavailable history is loading', () => {
  const { getByTestId, rerender } = render(<PriceHeader />);
  const header = () => getByTestId('market-header');
  expect(
    header().querySelector('[data-testid="loading-skeleton"]'),
  ).not.toBeNull();

  mockSeries = { coin: 'BTC', range: '1D', error: true };
  rerender(<PriceHeader />);
  expect(header().querySelector('[data-testid="loading-skeleton"]')).toBeNull();
  expect(header().textContent).toContain('--');

  mockIsLoading = true;
  rerender(<PriceHeader />);
  expect(
    header().querySelector('[data-testid="loading-skeleton"]'),
  ).not.toBeNull();

  mockIsLoading = false;
  mockSeries = { coin: 'BTC', range: '1D', data: [], error: false };
  rerender(<PriceHeader />);
  expect(header().querySelector('[data-testid="loading-skeleton"]')).toBeNull();
  expect(header().textContent).toContain('--');

  mockSeries = {
    coin: 'BTC',
    range: '1D',
    data: [
      [1000, 100],
      [2000, 120],
    ],
    error: false,
  };
  mockIsLoading = true;
  rerender(<PriceHeader />);
  expect(header().querySelector('[data-testid="loading-skeleton"]')).toBeNull();
  expect(getByTestId('price-header').textContent).toBe(
    '{"coin":"BTC","range":"1D","price":120,"change":"20","changePercent":20}',
  );
});

it('retains a held historical point during live updates and releases to the latest price', () => {
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
  expect(getByTestId('price-header').textContent).toBe(
    '{"coin":"BTC","range":"1D","price":110,"change":"10","changePercent":10,"isScrubbing":true}',
  );
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
    '{"coin":"BTC","range":"1D","price":110,"change":"10","changePercent":10,"isScrubbing":true}',
  );
  fireEvent.pointerCancel(chart);
  expect(getByTestId('price-header').textContent).toBe(
    '{"coin":"BTC","range":"1D","price":125,"change":"25","changePercent":25}',
  );
  fireEvent.click(getByTestId('scrub-price'));
  expect(getByTestId('price-header').textContent).toBe(
    '{"coin":"BTC","range":"1D","price":125,"change":"25","changePercent":25}',
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

it('keeps the selected range when switching chart modes', () => {
  const { getByTestId } = render(<SimpleMarketChart coin="BTC" active />);
  expect(getByTestId('perps-simple-market-chart-range-selector')).toBeTruthy();
  expect(
    getByTestId('perps-simple-market-chart-range-1D').getAttribute(
      'aria-pressed',
    ),
  ).toBe('true');
  fireEvent.click(getByTestId('perps-simple-market-chart-range-1H'));
  expect(
    getByTestId('perps-simple-market-chart-range-1H').getAttribute(
      'aria-pressed',
    ),
  ).toBe('true');
  expect(
    getByTestId('perps-simple-market-chart-range-1D').getAttribute(
      'aria-pressed',
    ),
  ).toBe('false');
  fireEvent.click(getByTestId('perps-simple-chart-mode-toggle'));
  fireEvent.click(getByTestId('perps-simple-chart-mode-toggle'));
  expect(
    getByTestId('perps-simple-market-chart-range-1H').getAttribute(
      'aria-pressed',
    ),
  ).toBe('true');
});

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

it('keeps available 1D performance visible during loading but shows the skeleton for another range', () => {
  const dayPerformance = { change: '-10', changePercent: -5 };
  const { getByTestId, rerender } = render(
    <PriceHeader dayPerformance={dayPerformance} />,
  );
  const header = () => getByTestId('market-header');
  expect(header().querySelector('[data-testid="loading-skeleton"]')).toBeNull();
  expect(header().textContent).toContain('-5');
  mockSeries = { coin: 'BTC', range: '1D', error: true };
  rerender(<PriceHeader dayPerformance={dayPerformance} />);
  expect(header().textContent).toContain('-5');
  fireEvent.click(getByTestId('perps-simple-market-chart-range-1H'));
  expect(
    header().querySelector('[data-testid="loading-skeleton"]'),
  ).not.toBeNull();
  mockSeries = { coin: 'BTC', range: '1H', error: true };
  rerender(<PriceHeader dayPerformance={dayPerformance} />);
  expect(header().querySelector('[data-testid="loading-skeleton"]')).toBeNull();
  expect(header().textContent).toContain('--');
  expect(header().textContent).not.toContain('-5');
});
