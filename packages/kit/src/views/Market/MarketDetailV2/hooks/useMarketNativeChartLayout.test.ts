/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { updateTradingViewNativeIndicatorActiveState } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/indicatorSettingsAdapter';
import { createTradingViewNativeIndicatorSettings } from '@onekeyhq/shared/types/tradingViewNative';

import { useMarketNativeChartLayout } from './useMarketNativeChartLayout';

let mockIndicators = createTradingViewNativeIndicatorSettings();

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketTradingViewIndicatorSettingsPersistAtom: () => [mockIndicators],
}));

beforeEach(() => {
  mockIndicators = createTradingViewNativeIndicatorSettings();
});

it('updates chart height inputs in the same render as indicator settings', () => {
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

it('restores saved indicators before the first chart render', () => {
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
  const { result } = renderHook(() => useMarketNativeChartLayout());
  expect(result.current.subIndicatorCount).toBe(2);
});
