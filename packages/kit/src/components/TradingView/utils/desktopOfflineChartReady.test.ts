/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useDesktopOfflineChartReady } from './desktopOfflineChartReady';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktop: true },
}));

describe('useDesktopOfflineChartReady', () => {
  let globals: { tradingViewOfflineReady?: boolean } | undefined;
  let notify: (() => void) | undefined;
  const unsubscribe = jest.fn();

  beforeEach(() => {
    globals = undefined;
    notify = undefined;
    unsubscribe.mockClear();
    Object.defineProperty(globalThis, 'ONEKEY_DESKTOP_GLOBALS_GETTER', {
      configurable: true,
      value: () => globals,
    });
    Object.defineProperty(globalThis, 'ONEKEY_DESKTOP_GLOBALS_SUBSCRIBE', {
      configurable: true,
      value: (listener: () => void) => {
        notify = listener;
        return unsubscribe;
      },
    });
  });

  it('updates when the desktop preload publishes offline readiness', () => {
    const { result, unmount } = renderHook(() => useDesktopOfflineChartReady());
    expect(result.current).toBe(false);

    act(() => {
      globals = { tradingViewOfflineReady: true };
      notify?.();
    });
    expect(result.current).toBe(true);

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
