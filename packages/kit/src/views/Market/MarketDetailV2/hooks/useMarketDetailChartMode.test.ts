/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useMarketDetailChartMode } from './useMarketDetailChartMode';

type IChartModePreference = { chartMode: 'native' | 'tradingView' };

let mockPreference: IChartModePreference = { chartMode: 'native' };
const mockSetPreference = jest.fn(
  (
    update:
      | IChartModePreference
      | ((current: IChartModePreference) => IChartModePreference),
  ) => {
    mockPreference =
      typeof update === 'function' ? update(mockPreference) : update;
  },
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketDetailChartModePersistAtom: () => [
    mockPreference,
    mockSetPreference,
  ],
}));

describe('useMarketDetailChartMode', () => {
  beforeEach(() => {
    mockPreference = { chartMode: 'native' };
    mockSetPreference.mockClear();
  });

  it('opens on the native chart until TradingView is picked', () => {
    const { result } = renderHook(() => useMarketDetailChartMode());

    expect(result.current.isTradingViewNative).toBe(true);
  });

  it('opens on TradingView when it was picked before', () => {
    mockPreference = { chartMode: 'tradingView' };
    const { result } = renderHook(() => useMarketDetailChartMode());

    expect(result.current.isTradingViewNative).toBe(false);
  });

  it('saves TradingView when the user switches from the native chart', () => {
    const { result, rerender } = renderHook(() => useMarketDetailChartMode());

    act(() => result.current.toggleChartMode());
    rerender();

    expect(mockPreference).toEqual({ chartMode: 'tradingView' });
    expect(result.current.isTradingViewNative).toBe(false);
  });

  it('saves the native chart when the user switches back', () => {
    mockPreference = { chartMode: 'tradingView' };
    const { result, rerender } = renderHook(() => useMarketDetailChartMode());

    act(() => result.current.toggleChartMode());
    rerender();

    expect(mockPreference).toEqual({ chartMode: 'native' });
    expect(result.current.isTradingViewNative).toBe(true);
  });

  it('applies each switch to the latest saved choice', () => {
    const { result } = renderHook(() => useMarketDetailChartMode());

    act(() => {
      result.current.toggleChartMode();
      result.current.toggleChartMode();
    });

    expect(mockPreference).toEqual({ chartMode: 'native' });
  });
});
