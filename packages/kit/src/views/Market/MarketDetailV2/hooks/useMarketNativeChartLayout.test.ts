/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { updateTradingViewNativeIndicatorActiveState } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/indicatorSettingsAdapter';
import type { IMarketTradingViewLayout } from '@onekeyhq/kit-bg/src/states/jotai/atoms/market';
import {
  createTradingViewNativeChartSettings,
  createTradingViewNativeIndicatorSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

import { useMarketNativeChartLayout } from './useMarketNativeChartLayout';

let mockLayout: IMarketTradingViewLayout;
let mockIndicators = createTradingViewNativeIndicatorSettings();

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketTradingViewLayoutPersistAtom: () => [mockLayout],
  useMarketTradingViewIndicatorSettingsPersistAtom: () => [mockIndicators],
}));

beforeEach(() => {
  mockLayout = {
    panelCount: 1,
    panelOrder: ['main', 'panel-2', 'panel-3', 'panel-4'],
    panelSettings: {},
  };
  mockIndicators = createTradingViewNativeIndicatorSettings();
});

it.each([1, 2, 4] as const)(
  'restores %s panels on the first render',
  (panelCount) => {
    mockLayout = { ...mockLayout, panelCount };
    const { result } = renderHook(() => useMarketNativeChartLayout());
    expect(result.current).toEqual({ panelCount, subIndicatorCount: 0 });
  },
);

it('updates the main panel height inputs in the same render as indicator settings', () => {
  const renderedCounts: number[] = [];
  const { rerender } = renderHook(() => {
    const layout = useMarketNativeChartLayout();
    renderedCounts.push(layout.subIndicatorCount);
    return layout;
  });
  expect(renderedCounts).toEqual([0]);
  renderedCounts.length = 0;
  mockIndicators = updateTradingViewNativeIndicatorActiveState({
    settings: mockIndicators,
    indicator: 'RSI',
    active: true,
  });
  rerender();
  expect(renderedCounts).toEqual([1]);
  renderedCounts.length = 0;
  mockIndicators = updateTradingViewNativeIndicatorActiveState({
    settings: mockIndicators,
    indicator: 'RSI',
    active: false,
  });
  rerender();
  expect(renderedCounts).toEqual([0]);
});

it('uses the remaining panel settings when the main panel is closed', () => {
  mockLayout = {
    ...mockLayout,
    panelOrder: ['panel-2', 'main', 'panel-3', 'panel-4'],
    panelSettings: {
      'panel-2': {
        chartSettings: createTradingViewNativeChartSettings(),
        indicatorSettings: updateTradingViewNativeIndicatorActiveState({
          settings: mockIndicators,
          indicator: 'RSI',
          active: true,
        }),
      },
    },
  };
  const { result, rerender } = renderHook(() => useMarketNativeChartLayout());
  expect(result.current).toEqual({ panelCount: 1, subIndicatorCount: 1 });
  mockIndicators = updateTradingViewNativeIndicatorActiveState({
    settings: mockIndicators,
    indicator: 'MACD',
    active: true,
  });
  mockIndicators = updateTradingViewNativeIndicatorActiveState({
    settings: mockIndicators,
    indicator: 'VOL',
    active: true,
  });
  rerender();
  expect(result.current.subIndicatorCount).toBe(1);
  mockLayout = {
    ...mockLayout,
    panelOrder: ['main', 'panel-2', 'panel-3', 'panel-4'],
  };
  rerender();
  expect(result.current.subIndicatorCount).toBe(2);
});

it('uses the same global fallback as a panel without saved settings', () => {
  mockLayout = {
    ...mockLayout,
    panelOrder: ['panel-2', 'main', 'panel-3', 'panel-4'],
  };
  mockIndicators = updateTradingViewNativeIndicatorActiveState({
    settings: mockIndicators,
    indicator: 'RSI',
    active: true,
  });
  const { result } = renderHook(() => useMarketNativeChartLayout());
  expect(result.current.subIndicatorCount).toBe(1);
});
