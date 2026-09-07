/**
 * @jest-environment jsdom
 */

import type { ReactNode, SetStateAction } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type {
  ITradingViewNativeChartSettings,
  ITradingViewNativeIndicatorSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

import {
  createTradingViewNativeIndicatorSettingsValue,
  getTradingViewNativeIndicatorSettings,
} from './indicatorSettingsAdapter';
import {
  TradingViewNativeContainer,
  updateTradingViewNativeSubIndicatorInstances,
} from './TradingViewNativeContainer';
import { TRADING_VIEW_NATIVE_SUB_INDICATORS } from './utils/chartIndicators';

import type {
  ITradingViewNativeChartType,
  ITradingViewNativeDataState,
} from './types';
import type { ITradingViewNativeSubIndicatorInstanceConfig } from './utils/subIndicatorRender/types';

const mockHandleRetry = jest.fn();
const mockHandleHistoryBoundaryPrefetch = jest.fn();
const mockHandleIntervalChange = jest.fn();
const mockHandleViewportRequestApplied = jest.fn();
const mockHandleViewportTargetChange = jest.fn<Promise<void>, [unknown]>(
  async () => undefined,
);
let mockChartAreaOnLayout:
  | ((event: {
      nativeEvent: { layout: { height: number; width: number } };
    }) => void)
  | undefined;
const mockTradingViewNativeChartControlsContainer = jest.fn<null, [unknown]>(
  () => null,
);
const mockTradingViewNativeChart = jest.fn<null, [unknown]>(() => null);
const mockTradingViewNativeChartSettingsButton = jest.fn<
  null,
  [
    {
      priceAxisWidth: number;
      isChartSwitchDisabled?: boolean;
      onChartSwitch?: () => void;
    },
  ]
>(() => null);
const mockShowTradingViewNativeIndicatorSettingsDialog = jest.fn<
  void,
  [unknown]
>();
const mockTradingViewNativeFullscreenButton = jest.fn<
  ReactNode,
  [{ onPress: () => void }]
>(({ onPress }) => (
  <button
    aria-label="Toggle fullscreen"
    data-testid="trading-view-native-fullscreen-toggle"
    onClick={onPress}
    type="button"
  />
));
let mockDataProviderKey = 'market:evm--1:0xabc:TOKEN';
let mockDataState: ITradingViewNativeDataState;
let mockActiveInterval = '60';
let mockChartType: 'candlestick' | 'line' = 'candlestick';
let mockPoints: IMarketTokenKLineDataPoint[];
let mockVisibleTimeRange: { from: number; to: number } | undefined;
let mockViewportRequest: unknown;
let mockInitialChartSettings: ITradingViewNativeChartSettings | undefined;
let mockPersistedChartSettings: ITradingViewNativeChartSettings | undefined;
let mockInitialIndicatorSettings:
  | ITradingViewNativeIndicatorSettings
  | undefined;
let mockPersistedIndicatorSettings:
  | ITradingViewNativeIndicatorSettings
  | undefined;
let mockRealtimePointListener:
  | ((point: IMarketTokenKLineDataPoint) => void)
  | undefined;
const mockUseTradingViewNativeKLine = jest.fn(
  ({
    onRealtimePoint,
  }: {
    onRealtimePoint?: (point: IMarketTokenKLineDataPoint) => void;
  }) => {
    mockRealtimePointListener = onRealtimePoint;
    return {
      calendarAvailableTimeRange: { from: 100 },
      candleIntervalSeconds: 3600,
      chartType: mockChartType,
      chartPictureVersion: 0,
      dataProviderKey: mockDataProviderKey,
      dataState: mockDataState,
      getVisibleTimeRange: () => mockVisibleTimeRange,
      handleHistoryBoundaryPrefetch: mockHandleHistoryBoundaryPrefetch,
      handleIntervalChange: mockHandleIntervalChange,
      handleRetry: mockHandleRetry,
      handleViewportTargetChange: mockHandleViewportTargetChange,
      handleViewportRequestApplied: mockHandleViewportRequestApplied,
      handleVisiblePointRangeChange: jest.fn(),
      intervalConfig: { activeInterval: mockActiveInterval, intervals: [] },
      isSwitchingInterval: false,
      points: mockPoints,
      viewportRequest: mockViewportRequest,
    };
  },
);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
    locale: 'zh-CN',
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Button: ({
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
  ),
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  LottieView: () => <div data-testid="trading-view-native-loading-animation" />,
  Stack: ({
    children,
    onLayout,
    testID,
  }: {
    children?: ReactNode;
    onLayout?: (event: {
      nativeEvent: { layout: { height: number; width: number } };
    }) => void;
    testID?: string;
  }) => {
    if (onLayout) {
      mockChartAreaOnLayout = onLayout;
    }
    return <div data-testid={testID}>{children}</div>;
  },
  useTheme: () => ({
    amber9: { val: '#amber9' },
    bgApp: { val: '#bgApp' },
    bgSubdued: { val: '#bgSubdued' },
    blue3: { val: '#blue3' },
    blue9: { val: '#blue9' },
    borderSubdued: { val: '#borderSubdued' },
    brand9: { val: '#brand9' },
    cyan9: { val: '#cyan9' },
    green6: { val: '#green6' },
    green9: { val: '#green9' },
    neutral9: { val: '#neutral9' },
    orange9: { val: '#orange9' },
    pink9: { val: '#pink9' },
    purple9: { val: '#purple9' },
    red6: { val: '#red6' },
    red9: { val: '#red9' },
    textDisabled: { val: '#textDisabled' },
    textSubdued: { val: '#textSubdued' },
  }),
  YStack: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const tradingViewNative = jest.requireActual<
    typeof import('@onekeyhq/shared/types/tradingViewNative')
  >('@onekeyhq/shared/types/tradingViewNative');

  return {
    useMarketTradingViewChartSettingsPersistAtom: () => {
      const [settings, setSettings] = React.useState(
        () =>
          mockInitialChartSettings ??
          tradingViewNative.createTradingViewNativeChartSettings(),
      );
      const setTrackedSettings = React.useCallback(
        (nextSettings: SetStateAction<ITradingViewNativeChartSettings>) => {
          setSettings((currentSettings) => {
            const resolvedSettings =
              typeof nextSettings === 'function'
                ? nextSettings(currentSettings)
                : nextSettings;
            mockPersistedChartSettings = resolvedSettings;
            return resolvedSettings;
          });
        },
        [],
      );
      return [settings, setTrackedSettings] as const;
    },
    useMarketTradingViewIndicatorSettingsPersistAtom: () => {
      const [settings, setSettings] = React.useState(
        () =>
          mockInitialIndicatorSettings ??
          tradingViewNative.createTradingViewNativeIndicatorSettings(),
      );
      const setTrackedSettings = React.useCallback(
        (nextSettings: SetStateAction<ITradingViewNativeIndicatorSettings>) => {
          setSettings((currentSettings) => {
            const resolvedSettings =
              typeof nextSettings === 'function'
                ? nextSettings(currentSettings)
                : nextSettings;
            mockPersistedIndicatorSettings = resolvedSettings;
            return resolvedSettings;
          });
        },
        [],
      );
      return [settings, setTrackedSettings] as const;
    },
  };
});

jest.mock('./data/useTradingViewNativeKLine', () => ({
  useTradingViewNativeKLine: (params: {
    onRealtimePoint?: (point: IMarketTokenKLineDataPoint) => void;
  }) => mockUseTradingViewNativeKLine(params),
}));

jest.mock('./TradingViewNativeChart', () => ({
  TradingViewNativeChart: (props: unknown) => mockTradingViewNativeChart(props),
}));

jest.mock('./TradingViewNativeChartControlsContainer', () => ({
  TradingViewNativeChartControlsContainer: (props: unknown) =>
    mockTradingViewNativeChartControlsContainer(props),
}));

jest.mock('./TradingViewNativeChartSettingsButton', () => ({
  TradingViewNativeChartSettingsButton: (props: {
    priceAxisWidth: number;
    isChartSwitchDisabled?: boolean;
    onChartSwitch?: () => void;
  }) => mockTradingViewNativeChartSettingsButton(props),
}));

jest.mock('./showTradingViewNativeIndicatorSettingsDialog', () => ({
  showTradingViewNativeIndicatorSettingsDialog: (options: unknown) =>
    mockShowTradingViewNativeIndicatorSettingsDialog(options),
}));

jest.mock('./TradingViewNativeFullscreenButton', () => ({
  TradingViewNativeFullscreenButton: (props: { onPress: () => void }) =>
    mockTradingViewNativeFullscreenButton(props),
}));

describe('TradingViewNativeContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDataProviderKey = 'market:evm--1:0xabc:TOKEN';
    mockActiveInterval = '60';
    mockChartType = 'candlestick';
    mockDataState = {
      status: 'error',
      error: new Error('history unavailable'),
    };
    mockPoints = [];
    mockVisibleTimeRange = undefined;
    mockRealtimePointListener = undefined;
    mockViewportRequest = null;
    mockChartAreaOnLayout = undefined;
    mockInitialChartSettings = undefined;
    mockPersistedChartSettings = undefined;
    mockInitialIndicatorSettings = undefined;
    mockPersistedIndicatorSettings = undefined;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the loading animation until the initial K-line points arrive', () => {
    mockDataState = { status: 'idle' };
    const source = {
      kind: 'market' as const,
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      symbol: 'TOKEN',
      realtime: 'disabled' as const,
    };
    const { rerender } = render(
      <TradingViewNativeContainer source={source} testID="chart" />,
    );

    expect(screen.getByTestId('chart-loading')).toBeTruthy();
    expect(
      screen.getByTestId('trading-view-native-loading-animation'),
    ).toBeTruthy();

    mockDataState = { status: 'loading' };
    rerender(
      <TradingViewNativeContainer source={{ ...source }} testID="chart" />,
    );
    expect(screen.getByTestId('chart-loading')).toBeTruthy();

    mockDataState = { status: 'live' };
    mockPoints = [{ c: 100, h: 101, l: 99, o: 100, t: 1, v: 10 }];
    rerender(
      <TradingViewNativeContainer source={{ ...source }} testID="chart" />,
    );
    expect(screen.queryByTestId('chart-loading')).toBeNull();
  });

  it('renders a retryable error state when history has no points', () => {
    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
        testID="chart"
      />,
    );

    expect(screen.getByTestId('chart-error')).toBeTruthy();
    expect(screen.queryByTestId('chart-loading')).toBeNull();
    fireEvent.click(screen.getByTestId('chart-retry'));
    expect(mockHandleRetry).toHaveBeenCalledTimes(1);
  });

  it('passes localized candle abbreviations to the chart', () => {
    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
      />,
    );

    expect(mockTradingViewNativeChart).toHaveBeenCalledWith(
      expect.objectContaining({
        candleLabels: {
          close: 'market.close_abbr',
          high: 'market.high_abbr',
          low: 'market.low_abbr',
          open: 'market.open_abbr',
        },
        locale: 'zh-CN',
      }),
    );
  });

  it('persists menu chart type changes and renders Heikin Ashi points', () => {
    mockDataState = { status: 'live' };
    mockPoints = [
      { c: 106, h: 110, l: 90, o: 100, t: 1, v: 10 },
      { c: 108, h: 112, l: 100, o: 106, t: 2, v: 20 },
    ];

    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
      />,
    );

    const controlsProps = mockTradingViewNativeChartControlsContainer.mock
      .calls[0][0] as {
      activeChartType: ITradingViewNativeChartType;
      onChartTypeChange: (chartType: ITradingViewNativeChartType) => void;
    };
    expect(controlsProps.activeChartType).toBe('candlestick');

    act(() => controlsProps.onChartTypeChange('heikinAshi'));

    expect(mockPersistedChartSettings?.chartType).toBe('heikinAshi');
    expect(mockTradingViewNativeChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        chartType: 'heikinAshi',
        points: [
          { c: 101.5, h: 110, l: 90, o: 103, t: 1, v: 10 },
          { c: 106.5, h: 112, l: 100, o: 102.25, t: 2, v: 20 },
        ],
      }),
    );
  });

  it('forwards the initial right-offset configuration to the chart', () => {
    const initialRightOffset = {
      type: 'chartWidthPercentage' as const,
      value: 5,
    };

    render(
      <TradingViewNativeContainer
        initialRightOffset={initialRightOffset}
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
      />,
    );

    expect(mockTradingViewNativeChart).toHaveBeenCalledWith(
      expect.objectContaining({ initialRightOffset }),
    );
  });

  it('forces candlesticks without changing the stored native chart preference', () => {
    mockChartType = 'line';

    render(
      <TradingViewNativeContainer
        forcedChartType="candlestick"
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
      />,
    );

    expect(mockTradingViewNativeChart).toHaveBeenCalledWith(
      expect.objectContaining({ chartType: 'candlestick' }),
    );
  });

  it('renders volume only as an explicitly selected sub-indicator', () => {
    mockDataState = { status: 'live' };
    mockPoints = [
      { c: 100, h: 101, l: 99, o: 100, t: 1000, v: 0 },
      { c: 101, h: 102, l: 100, o: 100, t: 2000, v: 0 },
    ];
    const source = {
      kind: 'market' as const,
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      symbol: 'TOKEN',
      realtime: 'disabled' as const,
    };
    const { rerender } = render(<TradingViewNativeContainer source={source} />);

    expect(mockTradingViewNativeChart).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasVolume: false }),
    );

    mockPoints = [...mockPoints, { ...mockPoints[1], t: 3000, v: 1 }];
    rerender(<TradingViewNativeContainer source={{ ...source }} />);

    expect(mockTradingViewNativeChart).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasVolume: false, subIndicatorPanes: [] }),
    );

    const controlsProps = mockTradingViewNativeChartControlsContainer.mock
      .calls[0][0] as {
      onIndicatorChange: (indicator: 'VOL', desiredActive: boolean) => void;
    };
    act(() => controlsProps.onIndicatorChange('VOL', true));

    const chartProps = mockTradingViewNativeChart.mock.calls.at(-1)?.[0] as {
      hasVolume: boolean;
      subIndicatorPanes: Array<{ indicator: string }>;
    };
    expect(chartProps.hasVolume).toBe(false);
    expect(
      chartProps.subIndicatorPanes.map(({ indicator }) => indicator),
    ).toEqual(['VOL']);
  });

  it('opens settings on the selected sub-indicator from its chart legend', () => {
    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
      />,
    );

    const chartProps = mockTradingViewNativeChart.mock.calls.at(-1)?.[0] as {
      onSubIndicatorSettingsPress: (indicator: 'RSI') => void;
    };
    act(() => chartProps.onSubIndicatorSettingsPress('RSI'));

    expect(
      mockShowTradingViewNativeIndicatorSettingsDialog,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        displayMode: 'focused',
        initialIndicatorId: 'RSI',
        onConfirm: expect.any(Function),
        value: expect.objectContaining({ indicators: expect.any(Array) }),
      }),
    );
  });

  it('opens the full indicator editor from desktop chart controls', () => {
    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
        nativeControlsLayoutMode="desktop"
      />,
    );

    const controlsProps =
      mockTradingViewNativeChartControlsContainer.mock.calls.at(-1)?.[0] as {
        onIndicatorSettingsPress: () => void;
      };
    act(() => controlsProps.onIndicatorSettingsPress());

    expect(
      mockShowTradingViewNativeIndicatorSettingsDialog,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        displayMode: 'full',
        initialIndicatorId: undefined,
      }),
    );
  });
  it('starts without indicators and updates series from indicator controls', () => {
    mockDataState = { status: 'live' };
    mockPoints = Array.from({ length: 25 }, (_, index) => ({
      c: 100 + index,
      h: 101 + index,
      l: 99 + index,
      o: 100 + index,
      t: 1000 + index,
      v: 1,
    }));

    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
      />,
    );

    expect(mockTradingViewNativeChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        indicatorSeries: [],
      }),
    );

    const controlsProps = mockTradingViewNativeChartControlsContainer.mock
      .calls[0][0] as {
      onIndicatorChange: (indicator: 'EMA', desiredActive: boolean) => void;
    };
    act(() => controlsProps.onIndicatorChange('EMA', true));

    const chartProps = mockTradingViewNativeChart.mock.calls.at(-1)?.[0] as {
      indicatorSeries: Array<{ key: string }>;
    };
    expect(chartProps.indicatorSeries.map(({ key }) => key)).toEqual([
      'ema-1',
      'ema-2',
      'ema-3',
    ]);
  });

  it('tracks visible sub-indicators without rebuilding main-chart series', () => {
    const handleSubIndicatorCountChange = jest.fn();
    mockDataState = { status: 'live' };
    mockPoints = Array.from({ length: 25 }, (_, index) => ({
      c: 100 + index,
      h: 101 + index,
      l: 99 + index,
      o: 100 + index,
      t: 1000 + index,
      v: 1,
    }));

    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
        onNativeSubIndicatorCountChange={handleSubIndicatorCountChange}
      />,
    );

    const initialChartProps = mockTradingViewNativeChart.mock.calls.at(
      -1,
    )?.[0] as { indicatorSeries: Array<{ key: string }> };
    expect(initialChartProps.indicatorSeries).toEqual([]);
    expect(handleSubIndicatorCountChange).toHaveBeenLastCalledWith(0);

    const initialControlsProps =
      mockTradingViewNativeChartControlsContainer.mock.calls.at(-1)?.[0] as {
        activeIndicatorValues: Set<string>;
        onIndicatorChange: (
          indicator: 'EMA' | 'RSI',
          desiredActive: boolean,
        ) => void;
      };
    act(() => initialControlsProps.onIndicatorChange('RSI', true));

    const activeControlsProps =
      mockTradingViewNativeChartControlsContainer.mock.calls.at(-1)?.[0] as {
        activeIndicatorValues: Set<string>;
        onIndicatorChange: (
          indicator: 'EMA' | 'RSI',
          desiredActive: boolean,
        ) => void;
      };
    const activeChartProps = mockTradingViewNativeChart.mock.calls.at(
      -1,
    )?.[0] as {
      indicatorSeries: Array<{ key: string }>;
      subIndicatorPanes: Array<{ indicator: string }>;
    };
    expect(activeControlsProps.activeIndicatorValues.has('RSI')).toBe(true);
    expect(handleSubIndicatorCountChange).toHaveBeenLastCalledWith(1);
    expect(activeChartProps.indicatorSeries).toBe(
      initialChartProps.indicatorSeries,
    );
    expect(
      activeChartProps.subIndicatorPanes.map(({ indicator }) => indicator),
    ).toEqual(['RSI']);

    act(() => activeControlsProps.onIndicatorChange('RSI', false));

    const inactiveControlsProps =
      mockTradingViewNativeChartControlsContainer.mock.calls.at(-1)?.[0] as {
        activeIndicatorValues: Set<string>;
      };
    const inactiveChartProps = mockTradingViewNativeChart.mock.calls.at(
      -1,
    )?.[0] as {
      indicatorSeries: Array<{ key: string }>;
      subIndicatorPanes: Array<{ indicator: string }>;
    };
    expect(inactiveControlsProps.activeIndicatorValues.has('RSI')).toBe(false);
    expect(handleSubIndicatorCountChange).toHaveBeenLastCalledWith(0);
    expect(inactiveChartProps.indicatorSeries).toBe(
      initialChartProps.indicatorSeries,
    );
    expect(inactiveChartProps.subIndicatorPanes).toEqual([]);
  });

  it('enforces the sub-indicator selection cap while keeping main indicators independent', () => {
    const handleSubIndicatorCountChange = jest.fn();
    mockDataState = { status: 'live' };
    mockPoints = Array.from({ length: 25 }, (_, index) => ({
      c: 100 + index,
      h: 101 + index,
      l: 99 + index,
      o: 100 + index,
      t: 1000 + index,
      v: 1,
    }));

    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
        maxSelectableSubIndicatorCount={4}
        onNativeSubIndicatorCountChange={handleSubIndicatorCountChange}
      />,
    );

    const controlsProps =
      mockTradingViewNativeChartControlsContainer.mock.calls.at(-1)?.[0] as {
        activeIndicatorValues: Set<string>;
        maxSelectableSubIndicatorCount?: number;
        onIndicatorChange: (indicator: string, desiredActive: boolean) => void;
      };
    expect(controlsProps.maxSelectableSubIndicatorCount).toBe(4);

    act(() => {
      controlsProps.onIndicatorChange('VOL', true);
      controlsProps.onIndicatorChange('MACD', true);
      controlsProps.onIndicatorChange('RSI', true);
      controlsProps.onIndicatorChange('OBV', true);
      controlsProps.onIndicatorChange('MFI', true);
      controlsProps.onIndicatorChange('EMA', true);
    });

    let latestControlsProps =
      mockTradingViewNativeChartControlsContainer.mock.calls.at(-1)?.[0] as {
        activeIndicatorValues: Set<string>;
        onIndicatorChange: (indicator: string, desiredActive: boolean) => void;
      };
    expect([...latestControlsProps.activeIndicatorValues]).toEqual([
      'EMA',
      'VOL',
      'MACD',
      'RSI',
      'OBV',
    ]);
    expect(latestControlsProps.activeIndicatorValues.has('MFI')).toBe(false);
    expect(handleSubIndicatorCountChange).toHaveBeenLastCalledWith(4);

    const cappedChartProps = mockTradingViewNativeChart.mock.calls.at(
      -1,
    )?.[0] as {
      indicatorSeries: Array<{ key: string }>;
    };
    expect(cappedChartProps.indicatorSeries.map(({ key }) => key)).toEqual([
      'ema-1',
      'ema-2',
      'ema-3',
    ]);

    act(() => {
      latestControlsProps.onIndicatorChange('RSI', false);
      latestControlsProps.onIndicatorChange('MFI', true);
    });

    latestControlsProps =
      mockTradingViewNativeChartControlsContainer.mock.calls.at(-1)?.[0] as {
        activeIndicatorValues: Set<string>;
        onIndicatorChange: (indicator: string, desiredActive: boolean) => void;
      };
    expect([...latestControlsProps.activeIndicatorValues]).toEqual([
      'EMA',
      'VOL',
      'MACD',
      'OBV',
      'MFI',
    ]);
    expect(handleSubIndicatorCountChange).toHaveBeenLastCalledWith(4);
  });

  it('renders a snapshot above the selection cap in every layout', () => {
    const handleSubIndicatorCountChange = jest.fn();
    const activeSubIndicatorIds = new Set<string>(
      TRADING_VIEW_NATIVE_SUB_INDICATORS,
    );
    const settingsValue = createTradingViewNativeIndicatorSettingsValue();
    settingsValue.indicators.forEach((indicator) => {
      if (activeSubIndicatorIds.has(indicator.id)) {
        indicator.active = true;
      }
    });
    mockInitialIndicatorSettings =
      getTradingViewNativeIndicatorSettings(settingsValue);
    mockDataState = { status: 'live' };
    mockPoints = Array.from({ length: 25 }, (_, index) => ({
      c: 100 + index,
      h: 101 + index,
      l: 99 + index,
      o: 100 + index,
      t: 1000 + index,
      v: 1,
    }));

    const { rerender } = render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
        maxSelectableSubIndicatorCount={4}
        nativeControlsLayoutMode="mobile"
        onNativeSubIndicatorCountChange={handleSubIndicatorCountChange}
      />,
    );

    const chartProps = mockTradingViewNativeChart.mock.calls.at(-1)?.[0] as {
      subIndicatorPanes: Array<{ indicator: string }>;
    };
    expect(
      chartProps.subIndicatorPanes.map(({ indicator }) => indicator),
    ).toEqual(TRADING_VIEW_NATIVE_SUB_INDICATORS);
    const controlsProps =
      mockTradingViewNativeChartControlsContainer.mock.calls.at(-1)?.[0] as {
        activeIndicatorValues: Set<string>;
      };
    expect([...controlsProps.activeIndicatorValues]).toEqual(
      TRADING_VIEW_NATIVE_SUB_INDICATORS,
    );
    expect(handleSubIndicatorCountChange).toHaveBeenLastCalledWith(
      TRADING_VIEW_NATIVE_SUB_INDICATORS.length,
    );
    expect(
      mockInitialIndicatorSettings.subIndicators.filter(
        (indicator) => indicator.active,
      ),
    ).toHaveLength(TRADING_VIEW_NATIVE_SUB_INDICATORS.length);
    expect(mockPersistedIndicatorSettings).toBeUndefined();

    rerender(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
        nativeControlsLayoutMode="desktop"
        onNativeSubIndicatorCountChange={handleSubIndicatorCountChange}
      />,
    );

    const desktopChartProps = mockTradingViewNativeChart.mock.calls.at(
      -1,
    )?.[0] as {
      subIndicatorPanes: Array<{ indicator: string }>;
    };
    expect(
      desktopChartProps.subIndicatorPanes.map(({ indicator }) => indicator),
    ).toEqual(TRADING_VIEW_NATIVE_SUB_INDICATORS);
    expect(mockPersistedIndicatorSettings).toBeUndefined();
  });

  it('only removes the explicitly deselected indicator above the selection cap', () => {
    const activeSubIndicatorIds = new Set([
      'VOL',
      'MACD',
      'RSI',
      'StochRSI',
      'OBV',
    ]);
    const settingsValue = createTradingViewNativeIndicatorSettingsValue();
    settingsValue.indicators.forEach((indicator) => {
      if (activeSubIndicatorIds.has(indicator.id)) {
        indicator.active = true;
      }
    });
    mockInitialIndicatorSettings =
      getTradingViewNativeIndicatorSettings(settingsValue);
    mockDataState = { status: 'live' };
    mockPoints = Array.from({ length: 25 }, (_, index) => ({
      c: 100 + index,
      h: 101 + index,
      l: 99 + index,
      o: 100 + index,
      t: 1000 + index,
      v: 1,
    }));

    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
        maxSelectableSubIndicatorCount={4}
      />,
    );

    const controlsProps =
      mockTradingViewNativeChartControlsContainer.mock.calls.at(-1)?.[0] as {
        onIndicatorSelectionConfirm: (selection: {
          activeIndicatorValues: ReadonlySet<string>;
          replaceMainIndicators: boolean;
          replaceSubIndicators: boolean;
        }) => void;
      };
    act(() => {
      controlsProps.onIndicatorSelectionConfirm({
        activeIndicatorValues: new Set([
          'MA',
          'VOL',
          'MACD',
          'RSI',
          'StochRSI',
        ]),
        replaceMainIndicators: true,
        replaceSubIndicators: false,
      });
    });

    expect(
      mockPersistedIndicatorSettings?.subIndicators
        .filter((indicator) => indicator.active)
        .map((indicator) => indicator.id),
    ).toEqual(['VOL', 'MACD', 'RSI', 'StochRSI', 'OBV']);
    const updatedControlsProps =
      mockTradingViewNativeChartControlsContainer.mock.calls.at(-1)?.[0] as {
        onIndicatorSelectionConfirm: (selection: {
          activeIndicatorValues: ReadonlySet<string>;
          replaceMainIndicators: boolean;
          replaceSubIndicators: boolean;
        }) => void;
      };
    act(() => {
      updatedControlsProps.onIndicatorSelectionConfirm({
        activeIndicatorValues: new Set(['MA', 'VOL', 'RSI', 'StochRSI', 'OBV']),
        replaceMainIndicators: false,
        replaceSubIndicators: true,
      });
    });

    const latestControlsProps =
      mockTradingViewNativeChartControlsContainer.mock.calls.at(-1)?.[0] as {
        activeIndicatorValues: Set<string>;
      };
    expect([...latestControlsProps.activeIndicatorValues]).toEqual([
      'MA',
      'VOL',
      'RSI',
      'StochRSI',
      'OBV',
    ]);
    const chartProps = mockTradingViewNativeChart.mock.calls.at(-1)?.[0] as {
      subIndicatorPanes: Array<{ indicator: string }>;
    };
    expect(
      chartProps.subIndicatorPanes.map(({ indicator }) => indicator),
    ).toEqual(['VOL', 'RSI', 'StochRSI', 'OBV']);
    expect(
      mockPersistedIndicatorSettings?.subIndicators
        .filter((indicator) => indicator.active)
        .map((indicator) => indicator.id),
    ).toEqual(['VOL', 'RSI', 'StochRSI', 'OBV']);
  });

  it('preserves a sub-indicator instance and settings when visibility changes', () => {
    const settings = {
      inputs: { period: 7 },
      plots: { rsi: { visible: false } },
    };
    const instances: ITradingViewNativeSubIndicatorInstanceConfig[] = [
      { id: 'RSI', indicator: 'RSI', settings },
    ];

    const hiddenInstances = updateTradingViewNativeSubIndicatorInstances(
      instances,
      'RSI',
      false,
    );
    const blockedInstances = updateTradingViewNativeSubIndicatorInstances(
      hiddenInstances,
      'RSI',
      true,
      0,
    );
    const restoredInstances = updateTradingViewNativeSubIndicatorInstances(
      blockedInstances,
      'RSI',
      true,
      1,
    );

    expect(hiddenInstances).toEqual([
      { id: 'RSI', indicator: 'RSI', isVisible: false, settings },
    ]);
    expect(restoredInstances).toEqual([
      { id: 'RSI', indicator: 'RSI', isVisible: true, settings },
    ]);
    expect(blockedInstances).toBe(hiddenInstances);
    expect(restoredInstances[0].settings).toBe(settings);
  });

  it('forwards desktop controlled fullscreen props to chart controls', () => {
    const handleFullscreenChange = jest.fn();
    const fullscreenHeader = <div>Token info</div>;

    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
        isNativeChartFullscreen
        nativeControlsLayoutMode="desktop"
        nativeChartFullscreenHeader={fullscreenHeader}
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );

    expect(mockTradingViewNativeChartControlsContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        isFullscreen: true,
        fullscreenHeader,
        onFullscreenChange: handleFullscreenChange,
      }),
    );
    expect(mockTradingViewNativeChart).toHaveBeenCalledWith(
      expect.objectContaining({ isMobileLayout: false }),
    );
  });

  it('renders the mobile fullscreen control after initial loading finishes', () => {
    const handleFullscreenChange = jest.fn();
    mockDataState = { status: 'loading' };
    const source = {
      kind: 'market' as const,
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      symbol: 'TOKEN',
      realtime: 'disabled' as const,
    };

    const { rerender } = render(
      <TradingViewNativeContainer
        source={source}
        nativeControlsLayoutMode="mobile"
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );

    expect(mockTradingViewNativeChartControlsContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        onFullscreenChange: undefined,
      }),
    );
    expect(
      screen.queryByTestId('trading-view-native-fullscreen-toggle'),
    ).toBeNull();
    expect(mockTradingViewNativeChart).toHaveBeenCalledWith(
      expect.objectContaining({ isMobileLayout: true }),
    );

    mockDataState = { status: 'live' };
    mockPoints = [{ c: 100, h: 101, l: 99, o: 100, t: 1, v: 10 }];
    rerender(
      <TradingViewNativeContainer
        source={{ ...source }}
        nativeControlsLayoutMode="mobile"
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );
    expect(mockTradingViewNativeFullscreenButton).toHaveBeenCalledWith(
      expect.objectContaining({
        isFullscreen: false,
        visibleSubIndicatorCount: 0,
      }),
    );

    fireEvent.click(
      screen.getByTestId('trading-view-native-fullscreen-toggle'),
    );
    expect(handleFullscreenChange).toHaveBeenCalledWith(true);
  });

  it('renders chart settings inside the opted-in mobile native chart', () => {
    const handleChartSwitch = jest.fn();
    const source = {
      kind: 'market' as const,
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      symbol: 'TOKEN',
      realtime: 'disabled' as const,
    };

    render(
      <TradingViewNativeContainer
        source={source}
        enableNativeChartSettings
        isChartSwitchDisabled
        nativeControlsLayoutMode="mobile"
        onChartSwitch={handleChartSwitch}
      />,
    );

    expect(mockTradingViewNativeChartSettingsButton).toHaveBeenCalledWith({
      isChartSwitchDisabled: true,
      onChartSwitch: handleChartSwitch,
      priceAxisWidth: 0,
    });

    mockTradingViewNativeChartSettingsButton.mockClear();
    render(
      <TradingViewNativeContainer
        source={source}
        enableNativeChartSettings
        nativeControlsLayoutMode="desktop"
      />,
    );

    expect(mockTradingViewNativeChartSettingsButton).not.toHaveBeenCalled();
  });

  it('keeps the settings trigger on its fallback until plot width is ready', () => {
    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
        enableNativeChartSettings
        nativeControlsLayoutMode="mobile"
      />,
    );

    act(() => {
      mockChartAreaOnLayout?.({
        nativeEvent: { layout: { height: 240, width: 360 } },
      });
    });
    expect(mockTradingViewNativeChartSettingsButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ priceAxisWidth: 0 }),
    );

    const chartProps = mockTradingViewNativeChart.mock.calls.at(-1)?.[0] as {
      onChartWidthChange: (width: number) => void;
    };
    act(() => {
      chartProps.onChartWidthChange(300);
    });
    expect(mockTradingViewNativeChartSettingsButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ priceAxisWidth: 60 }),
    );
  });

  it('maps calendar submissions to native viewport targets', () => {
    const goToTimestamp = 1_751_328_000;
    const halfSevenDays = (7 * 24 * 60 * 60) / 2;
    mockDataState = { status: 'stale' };
    mockPoints = [
      {
        o: 100,
        h: 101,
        l: 99,
        c: 100,
        v: 10,
        t: 1000,
      },
    ];
    mockViewportRequest = {
      requestId: 1,
      target: { kind: 'timestamp', timestamp: 1000 },
    };

    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
      />,
    );

    const controlsProps = mockTradingViewNativeChartControlsContainer.mock
      .calls[0][0] as {
      onCalendarPanelOpen: () => void;
      onCalendarPanelSubmit: (payload: {
        panel: 'goToDate' | 'timeRange';
        timestamp?: number;
        from?: number;
        to?: number;
      }) => void;
    };
    controlsProps.onCalendarPanelOpen();
    controlsProps.onCalendarPanelSubmit({
      panel: 'goToDate',
      timestamp: goToTimestamp,
    });
    controlsProps.onCalendarPanelSubmit({
      panel: 'timeRange',
      from: 100,
      to: 200,
    });

    expect(mockHandleViewportTargetChange).toHaveBeenNthCalledWith(1, {
      kind: 'timeRange',
      from: goToTimestamp - halfSevenDays,
      to: goToTimestamp + halfSevenDays,
    });
    expect(mockHandleViewportTargetChange).toHaveBeenNthCalledWith(2, {
      kind: 'timeRange',
      from: 100,
      to: 200,
    });
    expect(mockHandleHistoryBoundaryPrefetch).toHaveBeenCalledTimes(1);
    expect(controlsProps).toEqual(
      expect.objectContaining({
        calendarAvailableTimeRange: { from: 100 },
      }),
    );
    expect(mockTradingViewNativeChart).toHaveBeenCalledWith(
      expect.objectContaining({
        onViewportRequestApplied: mockHandleViewportRequestApplied,
        viewportRequest: mockViewportRequest,
      }),
    );
  });

  it('switches to the V2 adaptive interval before navigating to a date', () => {
    const timestamp = 1_751_328_000;
    const halfSevenDays = (7 * 24 * 60 * 60) / 2;
    const handleIntervalChange = jest.fn();
    mockActiveInterval = '1';
    mockDataState = { status: 'stale' };
    mockPoints = [
      {
        o: 100,
        h: 101,
        l: 99,
        c: 100,
        v: 10,
        t: timestamp,
      },
    ];

    const renderChart = () => (
      <TradingViewNativeContainer
        source={{
          kind: 'market' as const,
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled' as const,
        }}
        onIntervalChange={handleIntervalChange}
      />
    );
    const { rerender } = render(renderChart());
    const controlsProps = mockTradingViewNativeChartControlsContainer.mock
      .calls[0][0] as {
      onCalendarPanelSubmit: (payload: {
        panel: 'goToDate';
        timestamp: number;
      }) => void;
    };

    act(() => {
      controlsProps.onCalendarPanelSubmit({
        panel: 'goToDate',
        timestamp,
      });
    });

    expect(mockHandleIntervalChange).toHaveBeenCalledWith('60', {
      skipNextHistoryRequest: true,
    });
    expect(handleIntervalChange).toHaveBeenCalledWith({
      fromInterval: '1',
      toInterval: '60',
    });
    expect(mockHandleViewportTargetChange).not.toHaveBeenCalled();

    mockActiveInterval = '60';
    rerender(renderChart());

    expect(mockHandleViewportTargetChange).toHaveBeenCalledWith({
      kind: 'timeRange',
      from: timestamp - halfSevenDays,
      to: timestamp + halfSevenDays,
    });
  });

  it('switches to the V2 adaptive interval before navigating a large time range', () => {
    const from = 1_751_328_000;
    const to = from + 2 * 24 * 60 * 60;
    const handleIntervalChange = jest.fn();
    mockActiveInterval = '1';
    mockDataState = { status: 'stale' };
    mockPoints = [
      {
        o: 100,
        h: 101,
        l: 99,
        c: 100,
        v: 10,
        t: to,
      },
    ];

    const renderChart = () => (
      <TradingViewNativeContainer
        source={{
          kind: 'market' as const,
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled' as const,
        }}
        onIntervalChange={handleIntervalChange}
      />
    );
    const { rerender } = render(renderChart());
    const controlsProps = mockTradingViewNativeChartControlsContainer.mock
      .calls[0][0] as {
      onCalendarPanelSubmit: (payload: {
        panel: 'timeRange';
        from: number;
        to: number;
      }) => void;
    };

    act(() => {
      controlsProps.onCalendarPanelSubmit({
        panel: 'timeRange',
        from,
        to,
      });
    });

    expect(mockHandleIntervalChange).toHaveBeenCalledWith('15', {
      skipNextHistoryRequest: true,
    });
    expect(handleIntervalChange).toHaveBeenCalledWith({
      fromInterval: '1',
      toInterval: '15',
    });
    expect(mockHandleViewportTargetChange).not.toHaveBeenCalled();

    mockActiveInterval = '15';
    rerender(renderChart());

    expect(mockHandleViewportTargetChange).toHaveBeenCalledWith({
      kind: 'timeRange',
      from,
      to,
    });
  });

  it('uses the measured chart width when choosing an adaptive interval', () => {
    const from = 1_751_328_000;
    const to = from + 2 * 24 * 60 * 60;
    mockActiveInterval = '1';
    mockDataState = { status: 'stale' };
    mockPoints = [];

    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
      />,
    );
    const chartProps = mockTradingViewNativeChart.mock.calls.at(-1)?.[0] as {
      onChartWidthChange: (width: number) => void;
    };
    act(() => chartProps.onChartWidthChange(320));
    const controlsProps =
      mockTradingViewNativeChartControlsContainer.mock.calls.at(-1)?.[0] as {
        onCalendarPanelSubmit: (payload: {
          panel: 'timeRange';
          from: number;
          to: number;
        }) => void;
      };
    act(() => {
      controlsProps.onCalendarPanelSubmit({
        panel: 'timeRange',
        from,
        to,
      });
    });

    expect(mockHandleIntervalChange).toHaveBeenCalledWith('15', {
      skipNextHistoryRequest: true,
    });
  });

  it('discards a pending calendar target when the data provider changes', () => {
    const from = 1_751_328_000;
    const to = from + 2 * 24 * 60 * 60;
    mockActiveInterval = '1';
    mockDataState = { status: 'stale' };
    mockPoints = [];

    const renderChart = () => (
      <TradingViewNativeContainer
        source={{
          kind: 'market' as const,
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled' as const,
        }}
      />
    );
    const { rerender } = render(renderChart());
    const controlsProps = mockTradingViewNativeChartControlsContainer.mock
      .calls[0][0] as {
      onCalendarPanelSubmit: (payload: {
        panel: 'timeRange';
        from: number;
        to: number;
      }) => void;
    };
    act(() => {
      controlsProps.onCalendarPanelSubmit({
        panel: 'timeRange',
        from,
        to,
      });
    });

    mockDataProviderKey = 'market:evm--1:0xdef:OTHER';
    mockActiveInterval = '15';
    rerender(renderChart());

    expect(mockHandleViewportTargetChange).not.toHaveBeenCalled();
  });

  it('does not replace an interval that is already coarser than the range preset', () => {
    const from = 1_751_328_000;
    const to = from + 2 * 24 * 60 * 60;
    mockActiveInterval = '240';
    mockDataState = { status: 'stale' };
    mockPoints = [
      {
        o: 100,
        h: 101,
        l: 99,
        c: 100,
        v: 10,
        t: to,
      },
    ];

    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
      />,
    );
    const controlsProps = mockTradingViewNativeChartControlsContainer.mock
      .calls[0][0] as {
      onCalendarPanelSubmit: (payload: {
        panel: 'timeRange';
        from: number;
        to: number;
      }) => void;
    };

    controlsProps.onCalendarPanelSubmit({
      panel: 'timeRange',
      from,
      to,
    });

    expect(mockHandleIntervalChange).not.toHaveBeenCalled();
    expect(mockHandleViewportTargetChange).toHaveBeenCalledWith({
      kind: 'timeRange',
      from,
      to,
    });
  });

  it('reports the same latest close rendered by the chart for history and realtime updates', () => {
    const historyPoint = {
      o: 99,
      h: 101,
      l: 98,
      c: 100,
      v: 10,
      t: 1000,
    };
    const realtimePoint = {
      o: 100,
      h: 103,
      l: 99,
      c: 102,
      v: 12,
      t: 2000,
    };
    const handlePriceUpdate = jest.fn();
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1500);
    mockDataState = { status: 'stale', lastUpdatedAt: 1500 };
    mockPoints = [historyPoint];

    const renderChart = () => (
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'websocket',
        }}
        onPriceUpdate={handlePriceUpdate}
      />
    );
    const { rerender } = render(renderChart());

    expect(handlePriceUpdate).toHaveBeenLastCalledWith({
      price: historyPoint.c,
      receivedAt: 1500,
      source: 'history',
      timestamp: historyPoint.t,
    });
    expect(mockTradingViewNativeChart).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentPriceLabel: '100.00' }),
    );

    handlePriceUpdate.mockClear();
    dateNowSpy.mockReturnValue(2500);
    act(() => {
      mockRealtimePointListener?.(realtimePoint);
      mockDataState = { status: 'live', lastUpdatedAt: 2500 };
      mockPoints = [historyPoint, realtimePoint];
    });
    rerender(renderChart());

    expect(handlePriceUpdate).toHaveBeenCalledTimes(1);
    expect(handlePriceUpdate).toHaveBeenLastCalledWith({
      price: realtimePoint.c,
      receivedAt: 2500,
      source: 'realtime',
      timestamp: realtimePoint.t,
    });

    handlePriceUpdate.mockClear();
    dateNowSpy.mockReturnValue(3000);
    act(() => {
      mockRealtimePointListener?.(realtimePoint);
      mockDataState = { status: 'live', lastUpdatedAt: 3000 };
    });
    rerender(renderChart());

    expect(handlePriceUpdate).toHaveBeenCalledTimes(1);
    expect(handlePriceUpdate).toHaveBeenLastCalledWith({
      price: realtimePoint.c,
      receivedAt: 3000,
      source: 'realtime',
      timestamp: realtimePoint.t,
    });
  });

  it('uses the compact chart presentation without legends or volume', () => {
    mockDataState = { status: 'live' };
    mockPoints = [
      { c: 100, h: 101, l: 99, o: 100, t: 1000, v: 10 },
      { c: 101, h: 102, l: 100, o: 100, t: 2000, v: 20 },
    ];

    render(
      <TradingViewNativeContainer
        nativeChartDisplayMode="compact"
        nativeControlsLayoutMode="mobile"
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
        onNativeChartFullscreenChange={jest.fn()}
      />,
    );

    expect(mockTradingViewNativeChart).toHaveBeenCalledWith(
      expect.objectContaining({
        extendTimeAxisBorderToCanvasEdge: true,
        hasVolume: false,
        priceAxisFontSize: 11,
        priceAxisTickCount: 4,
        showLegend: false,
        timeAxisFontSize: 11,
        timeAxisHeight: 20,
        timeAxisBorderWidth: 0.5,
      }),
    );
    expect(mockTradingViewNativeChartControlsContainer).toHaveBeenCalledWith(
      expect.objectContaining({ compactMobileLayout: true }),
    );
    expect(mockTradingViewNativeFullscreenButton).toHaveBeenCalledWith(
      expect.objectContaining({ timeAxisHeight: 20 }),
    );
  });
  it('keeps shared chart defaults outside compact mode', () => {
    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
      />,
    );

    expect(mockTradingViewNativeChart).toHaveBeenCalledWith(
      expect.objectContaining({
        extendTimeAxisBorderToCanvasEdge: false,
        priceAxisFontSize: undefined,
        priceAxisTickCount: undefined,
        showLegend: true,
        timeAxisFontSize: undefined,
        timeAxisHeight: 24,
        timeAxisBorderWidth: undefined,
      }),
    );
    expect(mockTradingViewNativeChartControlsContainer).toHaveBeenCalledWith(
      expect.objectContaining({ compactMobileLayout: false }),
    );
  });
  it('forwards the native close action to chart controls', () => {
    const handleChartClose = jest.fn();

    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
        onNativeChartClose={handleChartClose}
      />,
    );

    expect(mockTradingViewNativeChartControlsContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        onChartClose: handleChartClose,
      }),
    );
  });
  it('forwards native close-control visibility to chart controls', () => {
    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
        onNativeChartClose={jest.fn()}
        showNativeChartCloseControl={false}
      />,
    );

    expect(mockTradingViewNativeChartControlsContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        showChartCloseControl: false,
      }),
    );
  });
});
