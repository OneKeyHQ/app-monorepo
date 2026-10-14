/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  readTradingViewNativeActiveInterval,
  saveTradingViewNativeActiveInterval,
} from '../../TradingViewNative/data/tradingViewNativeIntervalStorage';

import { usePerpsNativeChartControls } from './usePerpsNativeChartControls';

import type { IWebViewRef } from '../../../WebView/types';
import type { ITradingViewNativeChartControlsConfigData } from '../../TradingViewV2/types';

const mockStorage = new Map<string, unknown>();
jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    syncStorage: {
      getObject: (key: string) => mockStorage.get(key),
      setObject: (key: string, value: unknown) => mockStorage.set(key, value),
    },
  },
}));
jest.mock('../../TradingViewV2/components/TradingViewV2ChartControls', () => ({
  useNativeIndicatorActiveValues: jest.fn(),
}));

const config: ITradingViewNativeChartControlsConfigData = {
  intervals: ['1', '15', '1H', '4H', '1D'].map((value) => ({
    label: value,
    value,
  })),
  activeInterval: '1H',
  activeChartType: 1,
  chartTypes: [{ label: 'Candles', value: 1 }],
  indicators: [],
  layoutRestored: true,
};

function renderControls(enabled = true) {
  const sendMessageViaInjectedScript = jest.fn();
  const webRef = {
    current: { sendMessageViaInjectedScript } as unknown as IWebViewRef,
  };
  return {
    ...renderHook(() => usePerpsNativeChartControls({ enabled, webRef })),
    sendMessageViaInjectedScript,
  };
}

describe('Perps native chart controls', () => {
  beforeEach(() => mockStorage.clear());

  it('restores the Perps interval after layout restoration without using Market preferences', async () => {
    await saveTradingViewNativeActiveInterval({
      namespace: 'perps',
      interval: '240',
    });
    await saveTradingViewNativeActiveInterval({
      namespace: 'token',
      interval: '15',
    });
    const { result, sendMessageViaInjectedScript } = renderControls();
    expect(result.current.initialInterval).toBe('240');

    act(() =>
      result.current.onNativeChartControlsConfigChange({
        ...config,
        layoutRestored: false,
      }),
    );
    expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
    act(() => result.current.onNativeChartControlsConfigChange(config));
    expect(sendMessageViaInjectedScript).toHaveBeenCalledWith({
      type: 'TRADINGVIEW_INTERVAL_CHANGE',
      payload: { interval: '4H', resetPriceScaleRange: true },
    });
    expect(result.current.isRestoringInterval).toBe(true);
    act(() =>
      result.current.onIntervalConfigChange({
        intervals: config.intervals ?? [],
        activeInterval: '4H',
      }),
    );
    expect(result.current.isRestoringInterval).toBe(false);
    expect(readTradingViewNativeActiveInterval('token')).toBe('15');
  });

  it('keeps a selected interval through delayed snapshots and WebView reloads', () => {
    const { result, sendMessageViaInjectedScript } = renderControls();
    act(() => result.current.onNativeChartControlsConfigChange(config));
    act(() => result.current.controlsProps.onIntervalChange('15'));
    act(() => result.current.onNativeChartControlsConfigChange(config));
    expect(result.current.controlsProps.intervalConfig?.activeInterval).toBe(
      '15',
    );
    expect(readTradingViewNativeActiveInterval('perps')).toBe('15');
    act(() => result.current.reset());
    expect(result.current.controlsProps.nativeChartControlsConfig).toBeNull();
    sendMessageViaInjectedScript.mockClear();
    act(() => result.current.onNativeChartControlsConfigChange(config));
    expect(sendMessageViaInjectedScript).toHaveBeenCalledWith({
      type: 'TRADINGVIEW_INTERVAL_CHANGE',
      payload: { interval: '15', resetPriceScaleRange: true },
    });
  });

  it('does not restore desktop toolbar preferences when native controls are disabled', async () => {
    await saveTradingViewNativeActiveInterval({
      namespace: 'perps',
      interval: '240',
    });
    const { result, sendMessageViaInjectedScript } = renderControls(false);
    act(() => result.current.onNativeChartControlsConfigChange(config));
    expect(result.current.initialInterval).toBeUndefined();
    expect(result.current.isRestoringInterval).toBe(false);
    expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
  });
});
