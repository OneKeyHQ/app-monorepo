/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { TRADING_VIEW_NATIVE_ALL_INDICATORS } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/utils/chartIndicators/indicatorCatalog';

import {
  canToggleTradingViewNativeIndicatorOn,
  getAppNativeIndicators,
  getNativeIndicatorSelectionUpdates,
  getTradingViewNativeSubIndicatorCount,
  getTradingViewNativeSubIndicatorCountForSnapshot,
  useNativeIndicatorActiveValues,
  useNativeIndicatorControls,
} from './useNativeIndicatorActiveValues';

import type {
  ITradingViewIndicatorOption,
  ITradingViewNativeChartControlsConfigData,
} from '../../../types';

const indicators: ITradingViewIndicatorOption[] = [
  { label: 'VOL', value: 'VOL', active: true },
  { label: 'MACD', value: 'MACD', active: true },
  { label: 'RSI', value: 'RSI', active: true },
  { label: 'StochRSI', value: 'StochRSI', active: false },
  { label: 'OBV', value: 'OBV', active: false },
  { label: 'CCI', value: 'CCI', active: false },
];

const nativeChartControlsConfig: ITradingViewNativeChartControlsConfigData = {
  indicators,
  chartTypes: [],
  activeChartType: 0,
};

describe('native indicator controls', () => {
  it('projects controller options directly from canonical catalog order', () => {
    expect(
      getAppNativeIndicators(new Set()).map(({ label, value }) => ({
        label,
        value,
      })),
    ).toEqual(
      TRADING_VIEW_NATIVE_ALL_INDICATORS.map((indicator) => ({
        label: indicator,
        value: indicator,
      })),
    );
  });

  it('does not count or cap unknown values as sub-indicators', () => {
    const activeIndicatorValues = new Set(['VOL', 'UNKNOWN']);

    expect(getTradingViewNativeSubIndicatorCount(activeIndicatorValues)).toBe(
      1,
    );
    expect(
      canToggleTradingViewNativeIndicatorOn({
        activeIndicatorValues,
        indicatorValue: 'UNKNOWN',
        maxSubIndicatorCount: 1,
      }),
    ).toBe(true);
    expect(
      canToggleTradingViewNativeIndicatorOn({
        activeIndicatorValues,
        indicatorValue: 'MACD',
        maxSubIndicatorCount: 1,
      }),
    ).toBe(false);
  });

  it('uses the count from a new config until app state syncs to that snapshot', () => {
    const provisionalIndicators = indicators.map((indicator, index) => ({
      ...indicator,
      active: index === 0,
    }));
    const restoredIndicators = indicators.map((indicator, index) => ({
      ...indicator,
      active: index < 3,
    }));

    expect(
      getTradingViewNativeSubIndicatorCountForSnapshot({
        activeIndicatorValues: new Set(['VOL']),
        configIndicators: restoredIndicators,
        isInitialized: true,
        sourceIndicators: provisionalIndicators,
      }),
    ).toBe(3);

    expect(
      getTradingViewNativeSubIndicatorCountForSnapshot({
        activeIndicatorValues: new Set(['VOL', 'MACD', 'RSI', 'StochRSI']),
        configIndicators: restoredIndicators,
        isInitialized: true,
        sourceIndicators: restoredIndicators,
      }),
    ).toBe(4);
  });

  it('sends removals before additions when a dialog swaps indicators', () => {
    expect(
      getNativeIndicatorSelectionUpdates({
        indicators,
        originalActiveIndicatorValues: new Set(['VOL', 'MACD', 'RSI', 'CCI']),
        nextActiveIndicatorValues: new Set(['VOL', 'RSI', 'StochRSI', 'OBV']),
      }),
    ).toEqual([
      ['MACD', false],
      ['CCI', false],
      ['StochRSI', true],
      ['OBV', true],
    ]);
  });

  it('projects bridge values to canonical ids in selection updates', () => {
    expect(
      getNativeIndicatorSelectionUpdates({
        indicators: [{ label: 'RSI', value: 'bridge-rsi' }],
        nextActiveIndicatorValues: new Set(),
        originalActiveIndicatorValues: new Set(['bridge-rsi']),
      }),
    ).toEqual([['RSI', false]]);
  });

  it('rejects back-to-back QuickBar additions after reaching the sub-indicator cap', async () => {
    const onIndicatorSelect = jest.fn();
    const { result } = renderHook(() => {
      const nativeIndicatorState = useNativeIndicatorActiveValues(indicators);
      return useNativeIndicatorControls({
        nativeChartControlsConfig,
        nativeIndicatorState,
        maxSubIndicatorCount: 4,
        onIndicatorSelect,
      });
    });

    await waitFor(() => {
      expect(result.current.activeIndicatorValues.size).toBe(3);
    });

    act(() => {
      result.current.handleIndicatorPress(indicators[3]);
      result.current.handleIndicatorPress(indicators[4]);
    });

    expect(onIndicatorSelect).toHaveBeenCalledTimes(1);
    expect(onIndicatorSelect).toHaveBeenCalledWith('StochRSI', true);
    expect([...result.current.activeIndicatorValues]).toEqual([
      'VOL',
      'MACD',
      'RSI',
      'StochRSI',
    ]);
  });

  it('does not cap QuickBar additions when no sub-indicator cap is passed', async () => {
    const onIndicatorSelect = jest.fn();
    const indicatorsWithFourActive = indicators.map((indicator, index) => ({
      ...indicator,
      active: index < 4,
    }));
    const nativeChartControlsConfigWithFourActive = {
      ...nativeChartControlsConfig,
      indicators: indicatorsWithFourActive,
    };
    const { result } = renderHook(() => {
      const nativeIndicatorState = useNativeIndicatorActiveValues(
        indicatorsWithFourActive,
      );
      return useNativeIndicatorControls({
        nativeChartControlsConfig: nativeChartControlsConfigWithFourActive,
        nativeIndicatorState,
        onIndicatorSelect,
      });
    });

    await waitFor(() => {
      expect(result.current.activeIndicatorValues.size).toBe(4);
    });

    act(() => {
      result.current.handleIndicatorPress(indicatorsWithFourActive[4]);
    });

    expect(onIndicatorSelect).toHaveBeenCalledWith('OBV', true);
    expect([...result.current.activeIndicatorValues]).toEqual([
      'VOL',
      'MACD',
      'RSI',
      'StochRSI',
      'OBV',
    ]);
  });
});
