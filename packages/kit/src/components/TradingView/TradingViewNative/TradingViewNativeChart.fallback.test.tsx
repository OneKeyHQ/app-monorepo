/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import { createTradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import { TradingViewNativeChart } from './TradingViewNativeChart.native';
import { TradingViewNativeChartReadyContext } from './TradingViewNativeChartReadyContext';

import type { ITradingViewNativeChartProps } from './TradingViewNativeChart.types';

let mockOnSkiaError: (() => void) | undefined;

jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SizableText: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOSMacCatalyst: false },
}));
jest.mock('./native/TradingViewNativeChart', () => ({
  TradingViewNativeChart: function MockNativeChart({
    onSkiaError,
  }: {
    onSkiaError: () => void;
  }) {
    mockOnSkiaError = onSkiaError;
    return <div data-testid="native-chart" />;
  },
}));

test('replaces a failed native chart with text and reveals the fullscreen layer', () => {
  const onChartUnavailable = jest.fn();
  const onChartReady = jest.fn();
  const props: ITradingViewNativeChartProps = {
    candleIntervalSeconds: 60,
    chartComponents: [],
    chartSettings: createTradingViewNativeChartSettings(),
    chartType: 'candlestick',
    chartPictureVersion: 0,
    currentPriceLabel: '',
    hasVolume: false,
    indicatorSeries: [],
    indicatorSeriesSettingsKey: '',
    isSwitchingInterval: false,
    locale: 'zh-CN',
    onChartUnavailable,
    onSubIndicatorSettingsPress: jest.fn(),
    candleLabels: { close: 'Close', high: 'High', low: 'Low', open: 'Open' },
    points: [],
  };
  render(
    <TradingViewNativeChartReadyContext.Provider value={onChartReady}>
      <TradingViewNativeChart {...props} />
    </TradingViewNativeChartReadyContext.Provider>,
  );
  expect(screen.getByTestId('native-chart')).toBeTruthy();
  expect(onChartUnavailable).not.toHaveBeenCalled();

  act(() => mockOnSkiaError?.());

  expect(
    screen.getByText('Charts are not supported on this device.'),
  ).toBeTruthy();
  expect(screen.queryByTestId('native-chart')).toBeNull();
  expect(onChartUnavailable).toHaveBeenCalledTimes(1);
  expect(onChartReady).toHaveBeenCalledTimes(1);
});
