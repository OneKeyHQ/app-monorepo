/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import {
  getNativeIndicatorSelectionUpdates,
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
});
