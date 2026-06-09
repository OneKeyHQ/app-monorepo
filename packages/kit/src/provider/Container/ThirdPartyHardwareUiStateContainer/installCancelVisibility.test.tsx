/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useInstallCancelOnStall } from './installCancelVisibility';

describe('useInstallCancelOnStall', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resets the stall timer whenever progress advances', () => {
    const { result, rerender } = renderHook(
      ({ progressKey }) =>
        useInstallCancelOnStall({
          installing: true,
          progressKey,
          delayMs: 30_000,
        }),
      {
        initialProps: { progressKey: 'ledger:Bitcoin:10' },
      },
    );

    act(() => {
      jest.advanceTimersByTime(29_000);
    });
    expect(result.current).toBe(false);

    // Progress tick → timer resets.
    rerender({ progressKey: 'ledger:Bitcoin:20' });

    act(() => {
      jest.advanceTimersByTime(29_000);
    });
    expect(result.current).toBe(false);

    // No further progress for the full delay → cancel becomes visible.
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(true);
  });

  it('keeps cancel hidden while progress advances every interval', () => {
    const { result, rerender } = renderHook(
      ({ progressKey }) =>
        useInstallCancelOnStall({
          installing: true,
          progressKey,
          delayMs: 30_000,
        }),
      {
        initialProps: { progressKey: 'ledger:Bitcoin:10' },
      },
    );

    for (let pct = 20; pct <= 90; pct += 10) {
      act(() => {
        jest.advanceTimersByTime(20_000);
      });
      rerender({ progressKey: `ledger:Bitcoin:${pct}` });
      expect(result.current).toBe(false);
    }
  });

  it('treats the next batched app like a fresh start', () => {
    const { result, rerender } = renderHook(
      ({ progressKey }) =>
        useInstallCancelOnStall({
          installing: true,
          progressKey,
          delayMs: 30_000,
        }),
      {
        initialProps: { progressKey: 'ledger:Bitcoin:99' },
      },
    );

    // Bitcoin sits at 99% for 29s, no cancel yet.
    act(() => {
      jest.advanceTimersByTime(29_000);
    });
    expect(result.current).toBe(false);

    // Batch moves on to Ethereum; key changes → timer resets.
    rerender({ progressKey: 'ledger:Ethereum:0' });

    act(() => {
      jest.advanceTimersByTime(29_000);
    });
    expect(result.current).toBe(false);

    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(true);
  });

  it('hides cancel when installing flips off', () => {
    const { result, rerender } = renderHook(
      ({ installing }) =>
        useInstallCancelOnStall({
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

  it('clears the pending timer on unmount so it cannot fire after the dialog closes', () => {
    const { unmount } = renderHook(() =>
      useInstallCancelOnStall({
        installing: true,
        progressKey: 'ledger:Bitcoin:50',
        delayMs: 30_000,
      }),
    );

    expect(jest.getTimerCount()).toBe(1);

    unmount();

    expect(jest.getTimerCount()).toBe(0);

    // Advancing past the original delay must not crash or schedule new work.
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(jest.getTimerCount()).toBe(0);
  });
});
