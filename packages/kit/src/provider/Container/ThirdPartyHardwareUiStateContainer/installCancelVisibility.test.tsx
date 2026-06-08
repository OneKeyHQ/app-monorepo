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

  it('restarts the delayed cancel timer when the install task changes', () => {
    const { result, rerender } = renderHook(
      ({ taskKey }) =>
        useInstallCancelVisibility({
          installing: true,
          taskKey,
          delayMs: 60_000,
        }),
      {
        initialProps: {
          taskKey: 'ledger:Bitcoin',
        },
      },
    );

    act(() => {
      jest.advanceTimersByTime(59_000);
    });
    expect(result.current).toBe(false);

    rerender({ taskKey: 'ledger:Ethereum' });

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(false);

    act(() => {
      jest.advanceTimersByTime(59_000);
    });
    expect(result.current).toBe(true);
  });
});
