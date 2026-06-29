/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useInstallCancelVisibility } from './installCancelVisibility';

describe('useInstallCancelVisibility', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resets the stall timer whenever progress advances, then reveals after a full stall', () => {
    const { result, rerender } = renderHook(
      ({ progressKey }) =>
        useInstallCancelVisibility({
          installing: true,
          progressKey,
          delayMs: 30_000,
        }),
      { initialProps: { progressKey: 'ledger:Bitcoin:10' } },
    );

    act(() => {
      jest.advanceTimersByTime(29_000);
    });
    expect(result.current).toBe(false);

    rerender({ progressKey: 'ledger:Bitcoin:20' });

    act(() => {
      jest.advanceTimersByTime(29_000);
    });
    expect(result.current).toBe(false);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(true);
  });

  it('hides cancel when installing flips off', () => {
    const { result, rerender } = renderHook(
      ({ installing }) =>
        useInstallCancelVisibility({
          installing,
          progressKey: 'ledger:Bitcoin:50',
          delayMs: 30_000,
        }),
      { initialProps: { installing: true } },
    );

    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(result.current).toBe(true);

    rerender({ installing: false });
    expect(result.current).toBe(false);
  });

  it('clears the pending timer on unmount', () => {
    const { unmount } = renderHook(() =>
      useInstallCancelVisibility({
        installing: true,
        progressKey: 'ledger:Bitcoin:50',
        delayMs: 30_000,
      }),
    );

    expect(jest.getTimerCount()).toBe(1);

    unmount();

    expect(jest.getTimerCount()).toBe(0);
  });
});
