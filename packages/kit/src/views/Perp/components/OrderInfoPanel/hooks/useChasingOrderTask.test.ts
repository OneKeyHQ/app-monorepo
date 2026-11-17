/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useChasingOrderTask } from './useChasingOrderTask';

describe('useChasingOrderTask', () => {
  it('keeps the order visibly pending while the first chase task is in flight', async () => {
    let finishTask: (() => void) | undefined;
    const task = new Promise<void>((resolve) => {
      finishTask = resolve;
    });
    const { result } = renderHook(() => useChasingOrderTask());

    let firstRun: Promise<boolean> | undefined;
    await act(async () => {
      firstRun = result.current.runChasingOrderTask(7, async () => task);
      await Promise.resolve();
    });

    expect(result.current.chasingOrderIds).toEqual(new Set([7]));

    let duplicateRan = false;
    let duplicateStarted: boolean | undefined;
    await act(async () => {
      duplicateStarted = await result.current.runChasingOrderTask(
        7,
        async () => {
          duplicateRan = true;
        },
      );
    });

    expect(duplicateStarted).toBe(false);
    expect(duplicateRan).toBe(false);

    await act(async () => {
      finishTask?.();
      await firstRun;
    });

    expect(result.current.chasingOrderIds).toEqual(new Set());
  });
});
