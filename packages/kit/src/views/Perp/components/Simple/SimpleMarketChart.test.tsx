/** @jest-environment jsdom */

import { type ReactNode, useState } from 'react';

import { act, fireEvent, render } from '@testing-library/react';
import { atom, createStore, useAtom } from 'jotai';

import type { ISegmentControlProps } from '@onekeyhq/components';
import type { ILightweightChartProps } from '@onekeyhq/kit/src/components/LightweightChart/types';
import { StockPriceLineChart } from '@onekeyhq/kit/src/components/StockPriceLineChart';
import { tradingViewNativeHyperliquidGateway } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/providers/hyperliquid/tradingViewNativeHyperliquidGateway';
import type { ITradingViewNativeProps } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/types';
import { MobileSimpleChartFrame } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/components/MobileSimpleChartFrame';
import type { IPerpsCustomSettings } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { getSimpleChartDisplayPerformance } from '../../utils/simpleChart';

import { SIMPLE_CHART_CONTROLS } from './SimpleChartControls';
import { SimpleMarketChart } from './SimpleMarketChart';
import { SimpleMarketHeader } from './SimpleMarketHeader';

import type { ISimpleMarketChartPrice } from './SimpleMarketChart';

const mockSettingsAtom = atom<
  Pick<IPerpsCustomSettings, 'simpleMarketChartMode'>
>({});
const mockSettingsStore = createStore();
const mockNativeChart = jest.fn<void, [ITradingViewNativeProps]>();
const mockChartLines = jest.fn((_enabled: boolean) => ({
  chartComponents: [{ id: 'position' }],
  onReferenceLineAction: jest.fn(),
}));
const mockChartMarks = jest.fn((_active: boolean) => [{ id: 'perps.fills' }]);
const mockSubscribe = jest.fn();
const mockUnsubscribe = jest.fn();
let mockChartProps: ILightweightChartProps;
let mockIsLoading = false;
let mockVisible = true;
let mockLocked = false;
let mockReady = true;
let mockLoadHistory: () => Promise<typeof mockSeries>;
const mockRun = jest.fn();
let mockSeries:
  | {
      coin: string;
      range: string;
      data?: IMarketTokenChart;
      fetchedAt?: number;
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
        'bgAccent',
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
      ].map((name) => [
        name,
        { val: name === 'bgAccent' ? '#1fab00' : '#123456' },
      ]),
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
    LottieView: Box,
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
  usePromiseResult: (
    load: typeof mockLoadHistory,
    _deps: unknown[],
    options?: { overrideIsFocused?: (focused: boolean) => boolean },
  ) => {
    mockLoadHistory = async () =>
      options?.overrideIsFocused?.(true) === false ? undefined : load();
    return { result: mockSeries, isLoading: mockIsLoading, run: mockRun };
  },
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
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  () => ({}),
);
jest.mock(
  '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketAssetKLineData',
  () => ({}),
);
jest.mock('../../hooks/usePerpsMarketDataFreshness', () => ({
  usePerpsMarketDataFreshness: () => ({ isReady: mockReady }),
}));
jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => mockVisible,
  onVisibilityStateChange: () => () => {},
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const { EventEmitter } =
    jest.requireActual<typeof import('events')>('events');
  return {
    EAppEventBusNames: { HyperliquidDataUpdate: 'data' },
    appEventBus: new EventEmitter(),
  };
});
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useAppIsLockedAtom: () => [mockLocked],
  usePerpsCustomSettingsAtom: () =>
    useAtom(mockSettingsAtom, { store: mockSettingsStore }),
  usePerpsTradingViewIndicatorSettingsPersistAtom: () => [{}],
}));
jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewNative/indicatorSettingsAdapter',
  () => ({
    getTradingViewNativeSubIndicatorInstances: () => ['RSI', 'MACD'],
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
jest.mock('../../hooks/usePerpsNativeChartLines', () => ({
  usePerpsNativeChartLines: (enabled: boolean) => mockChartLines(enabled),
}));
jest.mock('../../hooks/usePerpsNativeChartMarks', () => ({
  usePerpsNativeChartMarks: (active: boolean) => mockChartMarks(active),
}));
jest.mock('../../hooks/usePerpsNativeChartMetadata', () => ({
  usePerpsNativeChartMetadata: () => ({ priceDecimalPlaces: 3 }),
}));
jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewNative/TradingViewNative',
  () => {
    const React = jest.requireActual('react') as typeof import('react');
    return {
      TradingViewNative: (props: ITradingViewNativeProps) => {
        mockNativeChart(props);
        const { active, source, mobileToolbarExtra } = props;
        const [viewport, setViewport] = React.useState('latest');
        React.useEffect(() => {
          if (!active) return;
          if (source.kind !== 'hyperliquid') return;
          mockSubscribe(source.coin);
          return () => {
            mockUnsubscribe(source.coin);
          };
        }, [active, source]);
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
  mockSettingsStore.set(mockSettingsAtom, {});
  mockIsLoading = false;
  mockVisible = true;
  mockLocked = false;
  mockReady = true;
  jest.clearAllMocks();
  mockSeries = undefined;
  Object.assign(platformEnv, {
    isNative: false,
    isNativeAndroid: false,
    isNativeIOS: false,
  });
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

it('uses only a fresh quote for this market after the REST response', () => {
  const fetchedAt = 2_100_000;
  mockSeries = {
    coin: 'xyz:TEST',
    range: '1D',
    data: [
      [1000, 100],
      [2000, 120],
    ],
    fetchedAt: fetchedAt - 100,
    error: false,
  };
  const onPriceChange = jest.fn();
  const chart = () => (
    <SimpleMarketChart
      coin="xyz:TEST"
      assetId={110_000}
      active
      onPriceChange={onPriceChange}
    />
  );
  const view = render(chart());
  const emit = (
    subType: ESubscriptionType,
    data: unknown,
    receivedAt: number,
  ) =>
    act(() => {
      appEventBus.emit(EAppEventBusNames.HyperliquidDataUpdate, {
        type: 'market',
        subType,
        data,
        receivedAt,
      });
    });
  const expectPrice = (price: number) => {
    expect(mockChartProps.data.at(-1)?.[1]).toBe(price);
    expect(onPriceChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ price, changePercent: price - 100 }),
    );
  };
  emit(
    ESubscriptionType.ALL_MIDS,
    { mids: { 'xyz:TEST': '100' } },
    fetchedAt - 50,
  );
  expectPrice(100);
  mockSeries = { ...mockSeries, fetchedAt };
  view.rerender(chart());
  expectPrice(120);
  emit(ESubscriptionType.ALL_MIDS, { mids: { BTC: '999' } }, fetchedAt + 50);
  emit(ESubscriptionType.USER_FILLS, {}, fetchedAt + 100);
  expectPrice(120);
  emit(
    ESubscriptionType.ALL_MIDS,
    { mids: { 'xyz:TEST': '125' } },
    fetchedAt + 150,
  );
  expectPrice(125);
  mockReady = false;
  view.rerender(chart());
  emit(
    ESubscriptionType.ALL_MIDS,
    { mids: { 'xyz:TEST': '100' } },
    fetchedAt + 200,
  );
  expectPrice(120);
  mockReady = true;
  view.rerender(chart());
  emit(
    ESubscriptionType.ALL_DEXS_ASSET_CTXS,
    {
      ctxs: [
        ['', [{ midPx: '999' }]],
        ['xyz', [{ midPx: '130' }]],
      ],
    },
    fetchedAt + 250,
  );
  expectPrice(130);
  emit(
    ESubscriptionType.ALL_MIDS,
    { mids: { 'xyz:TEST': '130' } },
    fetchedAt + 300,
  );
  emit(
    ESubscriptionType.ALL_MIDS,
    { mids: { 'xyz:TEST': '99' } },
    fetchedAt + 275,
  );
  expectPrice(130);
});

it('keeps only the visible, unlocked iOS fullscreen chart live on route blur', () => {
  Object.assign(platformEnv, { isNative: true, isNativeIOS: true });
  mockSettingsStore.set(mockSettingsAtom, { simpleMarketChartMode: 'candles' });
  const view = render(<SimpleMarketChart coin="BTC" active />);
  const fullscreen = (enabled: boolean) =>
    act(() =>
      mockNativeChart.mock.lastCall?.[0].onNativeChartFullscreenChange?.(
        enabled,
      ),
    );
  fullscreen(true);
  const blur = () =>
    view.rerender(<SimpleMarketChart coin="BTC" active={false} />);
  const expectActive = (active: boolean) => {
    expect(mockNativeChart.mock.lastCall?.[0].active).toBe(active);
    expect(mockChartMarks).toHaveBeenLastCalledWith(active);
  };
  blur();
  expectActive(true);
  mockVisible = false;
  blur();
  expectActive(false);
  mockVisible = true;
  mockLocked = true;
  blur();
  expectActive(false);
  mockLocked = false;
  blur();
  expectActive(true);
  fullscreen(false);
  expectActive(false);
});

it('does not report unchanged display prices after parent or history refreshes', () => {
  const onPriceChange = jest.fn();
  const { rerender } = render(
    <SimpleMarketChart coin="BTC" active onPriceChange={onPriceChange} />,
  );
  expect(onPriceChange).toHaveBeenCalledTimes(1);
  rerender(
    <SimpleMarketChart coin="BTC" active onPriceChange={onPriceChange} />,
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
    expect(mockChartProps).toMatchObject({
      patternColor: '#1fab00',
      pulseLastPointColor: '#1fab00',
      secondaryLineColor: '#1fab00',
    });
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
  const { getByTestId, queryByTestId, rerender } = render(<PriceHeader />);
  expect(getByTestId('perps-simple-chart-loading')).toBeTruthy();
  const header = () => getByTestId('market-header');
  expect(
    header().querySelector('[data-testid="loading-skeleton"]'),
  ).not.toBeNull();

  mockSeries = { coin: 'BTC', range: '1D', error: true };
  rerender(<PriceHeader />);
  expect(queryByTestId('perps-simple-chart-loading')).toBeNull();
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

it('restores the last chart mode when reopening a different market', () => {
  const btc = render(<SimpleMarketChart coin="BTC" active />);
  expect(btc.getByTestId('perps-simple-market-chart')).toBeTruthy();
  fireEvent.click(btc.getByTestId('perps-simple-chart-mode-toggle'));
  btc.unmount();

  const eth = render(<SimpleMarketChart coin="ETH" active />);
  expect(eth.getByTestId('candle-chart')).toBeTruthy();
  fireEvent.click(eth.getByTestId('perps-simple-chart-mode-toggle'));
  eth.unmount();

  const reopened = render(<SimpleMarketChart coin="BTC" active />);
  expect(reopened.getByTestId('perps-simple-market-chart')).toBeTruthy();
});

it('shows Perps fills and price lines only on candles, with trading actions disabled', () => {
  const { getByTestId, rerender } = render(
    <SimpleMarketChart coin="BTC" active />,
  );
  expect(mockChartMarks).not.toHaveBeenCalled();
  fireEvent.click(getByTestId('perps-simple-chart-mode-toggle'));
  expect(mockChartMarks).toHaveBeenCalledWith(true);
  expect(mockChartLines).toHaveBeenCalledWith(false);
  expect(mockNativeChart.mock.lastCall?.[0]).toMatchObject({
    source: { coin: 'BTC' },
    showNativeIndicatorQuickBar: true,
    mobileControlsAppearance: {
      settingsButton: { width: 28, height: 28, bg: '$bgStrong' },
    },
    nativeChartDisplayMode: 'marketDetail',
    initialZoomScale: 0.45,
    defaultPriceRangeScale: 1.25,
    chartComponents: [{ id: 'position' }, { id: 'perps.fills' }],
    priceDecimalPlaces: 3,
    onReferenceLineAction: undefined,
  });
  act(() =>
    mockNativeChart.mock.lastCall?.[0].onNativeChartFullscreenChange?.(true),
  );
  expect(mockNativeChart.mock.lastCall?.[0].nativeChartDisplayMode).toBe(
    'default',
  );
  expect(
    mockNativeChart.mock.lastCall?.[0].mobileControlsAppearance,
  ).toBeUndefined();
  rerender(<SimpleMarketChart coin="BTC" active={false} />);
  expect(mockChartMarks).toHaveBeenLastCalledWith(false);
});

it('shows the active custom interval in More and switches quick intervals directly', () => {
  const onMorePress = jest.fn();
  const onSelect = jest.fn();
  const { getByTestId, getByText } = render(
    SIMPLE_CHART_CONTROLS.renderIntervals({
      activeInterval: '240',
      options: [{ value: '60', label: '1H' }],
      moreActive: true,
      moreLabel: '4H',
      onMorePress,
      onSelect,
    }),
  );
  const more = getByTestId('trading-view-native-interval-selector-more-select');
  expect(more.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(more);
  expect(onMorePress).toHaveBeenCalledTimes(1);
  fireEvent.click(getByText('1H'));
  expect(onSelect).toHaveBeenCalledWith('60');
});

it('reserves sub-indicator panes only while the candle chart is visible', () => {
  mockSettingsStore.set(mockSettingsAtom, { simpleMarketChartMode: 'candles' });
  mockSeries = { coin: 'BTC', range: '1D', data: [[1000, 100]], error: false };
  const { getByTestId } = render(<SimpleMarketChart coin="BTC" active />);
  expect(getByTestId('candle-chart').parentElement?.style.height).toBe('536px');

  fireEvent.click(getByTestId('perps-simple-chart-mode-toggle'));
  expect(
    getByTestId('perps-simple-market-chart').parentElement?.style.height,
  ).toBe('392px');
  expect(getByTestId('perps-simple-price-line-chart').style.height).toBe(
    '346px',
  );

  fireEvent.click(getByTestId('perps-simple-chart-mode-toggle'));
  expect(getByTestId('candle-chart').parentElement?.style.height).toBe('536px');
});

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

describe('history refresh', () => {
  let fetchCandles: jest.SpiedFunction<
    typeof tradingViewNativeHyperliquidGateway.fetchCandles
  >;
  const initialTime = 1_700_000_000_000;
  let now = initialTime;
  const candles = (price = 120) => ({
    total: 2,
    points: [
      { t: initialTime / 1000 - 600, o: 100, h: 100, l: 100, c: 100, v: 1 },
      {
        t: initialTime / 1000 - 300,
        o: price,
        h: price,
        l: price,
        c: price,
        v: 1,
      },
    ],
  });
  beforeEach(() => {
    now = initialTime;
    fetchCandles = jest.spyOn(
      tradingViewNativeHyperliquidGateway,
      'fetchCandles',
    );
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    fetchCandles.mockReset().mockResolvedValue(candles());
    mockRun.mockImplementation(() => mockLoadHistory());
  });
  afterEach(() => jest.restoreAllMocks());

  it('retains successful history on refresh failure and restores it on retry', async () => {
    const view = render(<PriceHeader />);
    mockSeries = await mockLoadHistory();
    view.rerender(<PriceHeader />);
    const initialHeader = view.getByTestId('price-header').textContent;
    const initialData = mockChartProps.data;
    now += 60_000;
    fetchCandles.mockRejectedValueOnce(new Error('offline'));
    mockSeries = await mockLoadHistory();
    view.rerender(<PriceHeader />);
    expect(mockChartProps.data).toEqual(initialData);
    expect(view.getByTestId('price-header').textContent).toBe(initialHeader);
    expect(view.queryByTestId('perps-simple-chart-error')).toBeNull();
    fireEvent.click(view.getByTestId('perps-simple-chart-refresh-retry'));
    mockSeries = await mockRun.mock.results[0].value;
    view.rerender(<PriceHeader />);
    expect(fetchCandles).toHaveBeenCalledTimes(3);
    expect(view.queryByTestId('perps-simple-chart-refresh-retry')).toBeNull();
  });

  it.each([
    ['1H', 30_000],
    ['1D', 60_000],
    ['1W', 300_000],
    ['1M', 300_000],
    ['1Y', 600_000],
    ['All', 600_000],
  ] as const)(
    'throttles %s history while loading range changes immediately',
    async (range, interval) => {
      const view = render(<SimpleMarketChart coin="BTC" active />);
      await mockLoadHistory();
      if (range !== '1D') {
        fireEvent.click(
          view.getByTestId(`perps-simple-market-chart-range-${range}`),
        );
        await mockLoadHistory();
      }
      const initialCalls = range === '1D' ? 1 : 2;
      expect(fetchCandles).toHaveBeenCalledTimes(initialCalls);
      for (let elapsed = 30_000; elapsed < interval; elapsed += 30_000) {
        now = initialTime + elapsed;
        // Exercise each poll rather than only the interval's endpoints.
        // eslint-disable-next-line no-await-in-loop
        await mockLoadHistory();
      }
      expect(fetchCandles).toHaveBeenCalledTimes(initialCalls);
      now = initialTime + interval;
      await mockLoadHistory();
      expect(fetchCandles).toHaveBeenCalledTimes(initialCalls + 1);
    },
  );

  it('never uses another coin or range as a failed request fallback', async () => {
    const view = render(<SimpleMarketChart coin="BTC" active />);
    await mockLoadHistory();
    view.rerender(<SimpleMarketChart coin="ETH" active />);
    fetchCandles.mockRejectedValueOnce(new Error('offline'));
    mockSeries = await mockLoadHistory();
    view.rerender(<SimpleMarketChart coin="ETH" active />);
    expect(mockSeries).toMatchObject({ coin: 'ETH', error: true, data: [] });
    expect(view.getByTestId('perps-simple-chart-error')).toBeTruthy();
    await mockLoadHistory();
    fireEvent.click(view.getByTestId('perps-simple-market-chart-range-1Y'));
    fetchCandles.mockRejectedValueOnce(new Error('offline'));
    expect(await mockLoadHistory()).toMatchObject({
      coin: 'ETH',
      range: '1Y',
      error: true,
      data: [],
    });
  });

  it('retries failed refreshes on the next poll without waiting for the range interval', async () => {
    const view = render(<SimpleMarketChart coin="BTC" active />);
    fireEvent.click(view.getByTestId('perps-simple-market-chart-range-1Y'));
    await mockLoadHistory();
    now += 600_000;
    fetchCandles.mockRejectedValueOnce(new Error('offline'));
    expect(await mockLoadHistory()).toMatchObject({ error: true });
    now += 30_000;
    expect(await mockLoadHistory()).toMatchObject({ error: false });
    expect(fetchCandles).toHaveBeenCalledTimes(3);
  });

  it('does not let an older response overwrite the latest fallback', async () => {
    render(<SimpleMarketChart coin="BTC" active />);
    let resolveOlder!: (value: ReturnType<typeof candles>) => void;
    fetchCandles.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOlder = resolve;
        }),
    );
    const older = mockLoadHistory();
    await mockLoadHistory();
    resolveOlder(candles(90));
    await older;
    now += 60_000;
    fetchCandles.mockRejectedValueOnce(new Error('offline'));
    const fallback = await mockLoadHistory();
    expect(fallback?.data?.at(-1)?.[1]).toBe(120);
  });
  it('discards in-flight fallback writes when the chart becomes inactive', async () => {
    const view = render(<SimpleMarketChart coin="BTC" active />);
    let resolveHidden!: (value: ReturnType<typeof candles>) => void;
    fetchCandles.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHidden = resolve;
        }),
    );
    const pending = mockLoadHistory();
    view.rerender(<SimpleMarketChart coin="BTC" active={false} />);
    resolveHidden(candles());
    await pending;
    expect(await mockLoadHistory()).toBeUndefined();
    view.rerender(<SimpleMarketChart coin="BTC" active />);
    await mockLoadHistory();
    expect(fetchCandles).toHaveBeenCalledTimes(2);
  });
});
