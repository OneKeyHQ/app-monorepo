/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { useMarketDetailChartMode } from './useMarketDetailChartMode';

type IChartModePreference = { chartMode: 'native' | 'tradingView' };
type IChartModeUpdate =
  | IChartModePreference
  | ((current: IChartModePreference) => IChartModePreference);

let mockPreference: IChartModePreference = { chartMode: 'native' };
let mockSaveFails = false;
const mockSetPreference = jest.fn(async (update: IChartModeUpdate) => {
  if (mockSaveFails) {
    throw new OneKeyLocalError('Unknown error');
  }
  mockPreference =
    typeof update === 'function' ? update(mockPreference) : update;
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  marketDetailChartModePersistAtom: {
    set: (update: IChartModeUpdate) => mockSetPreference(update),
  },
  useMarketDetailChartModePersistAtom: () => [mockPreference],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { app: { error: { log: jest.fn() } } },
}));

describe('useMarketDetailChartMode', () => {
  beforeEach(() => {
    mockPreference = { chartMode: 'native' };
    mockSaveFails = false;
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

  it('applies each switch to the latest choice', () => {
    const { result } = renderHook(() => useMarketDetailChartMode());

    act(() => {
      result.current.toggleChartMode();
      result.current.toggleChartMode();
    });

    expect(mockPreference).toEqual({ chartMode: 'native' });
    expect(result.current.isTradingViewNative).toBe(true);
  });

  it('switches the chart before the choice is saved', () => {
    mockSetPreference.mockImplementationOnce(() => new Promise<void>(() => {}));
    const { result } = renderHook(() => useMarketDetailChartMode());

    act(() => result.current.toggleChartMode());

    expect(mockPreference).toEqual({ chartMode: 'native' });
    expect(result.current.isTradingViewNative).toBe(false);
  });

  it('keeps the switch on this page when saving it fails', async () => {
    mockSaveFails = true;
    const { result } = renderHook(() => useMarketDetailChartMode());

    await act(async () => result.current.toggleChartMode());

    expect(mockPreference).toEqual({ chartMode: 'native' });
    expect(result.current.isTradingViewNative).toBe(false);

    await act(async () => result.current.toggleChartMode());

    expect(result.current.isTradingViewNative).toBe(true);
  });

  it('follows choices saved later on other pages', async () => {
    mockSaveFails = true;
    const { result, rerender } = renderHook(() => useMarketDetailChartMode());

    await act(async () => result.current.toggleChartMode());
    mockPreference = { chartMode: 'tradingView' };
    rerender();
    mockPreference = { chartMode: 'native' };
    rerender();

    expect(result.current.isTradingViewNative).toBe(true);
  });
});
