/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { usePrimePurchaseMonitor } from './usePrimePurchaseMonitor';

let visibilityHandler: ((visible: boolean) => void) | undefined;
let routeFocused = true;

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => routeFocused,
}));

jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: (handler: (visible: boolean) => void) => {
    visibilityHandler = handler;
    return () => undefined;
  },
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMonitorMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advanceMonitorTimers(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
  await flushMonitorMicrotasks();
}

describe('usePrimePurchaseMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    visibilityHandler = undefined;
    routeFocused = true;
  });

  it('coalesces concurrent refresh signals into one follow-up poll', async () => {
    const firstPoll = createDeferred<{
      status: 'pending';
      data: { value: number };
    }>();
    const adapter = jest
      .fn()
      .mockReturnValueOnce(firstPoll.promise)
      .mockResolvedValue({
        status: 'pending',
        data: { value: 2 },
      });

    const { result, unmount } = renderHook(() =>
      usePrimePurchaseMonitor({
        sessionKey: 'session-a',
        initialData: { value: 0 },
        enabled: true,
        adapter,
        onSuccess: jest.fn(),
        onTerminal: jest.fn(),
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(adapter).toHaveBeenCalledTimes(1);
    });

    let firstRefresh!: ReturnType<typeof result.current.refresh>;
    let secondRefresh!: ReturnType<typeof result.current.refresh>;
    act(() => {
      firstRefresh = result.current.refresh();
      secondRefresh = result.current.refresh();
      visibilityHandler?.(true);
    });
    expect(adapter).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstPoll.resolve({
        status: 'pending',
        data: { value: 1 },
      });
      await firstPoll.promise;
    });

    await waitFor(() => {
      expect(adapter).toHaveBeenCalledTimes(2);
    });
    await expect(firstRefresh).resolves.toBe('pending');
    await expect(secondRefresh).resolves.toBe('pending');
    expect(result.current.data).toEqual({ value: 2 });
    unmount();
  });

  it('drops stale results after the session key changes', async () => {
    const firstPoll = createDeferred<{
      status: 'succeeded';
      data: { value: string };
    }>();
    const secondPoll = createDeferred<{
      status: 'pending';
      data: { value: string };
    }>();
    const onSuccess = jest.fn();

    const { result, rerender, unmount } = renderHook(
      ({ sessionKey }: { sessionKey: string }) =>
        usePrimePurchaseMonitor({
          sessionKey,
          initialData: { value: sessionKey },
          enabled: true,
          adapter: () =>
            sessionKey === 'session-a' ? firstPoll.promise : secondPoll.promise,
          onSuccess,
          onTerminal: jest.fn(),
          pollIntervalMs: 60_000,
        }),
      { initialProps: { sessionKey: 'session-a' } },
    );

    await waitFor(() => {
      expect(result.current.isPolling).toBe(true);
    });
    rerender({ sessionKey: 'session-b' });
    await act(async () => {
      firstPoll.resolve({
        status: 'succeeded',
        data: { value: 'stale-a' },
      });
      await firstPoll.promise;
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.data).toEqual({ value: 'session-b' });

    await act(async () => {
      secondPoll.resolve({
        status: 'pending',
        data: { value: 'fresh-b' },
      });
      await secondPoll.promise;
    });
    await waitFor(() => {
      expect(result.current.data).toEqual({ value: 'fresh-b' });
    });
    unmount();
  });

  it('backs off failures and resets the delay after recovery', async () => {
    jest.useFakeTimers();
    try {
      const adapter = jest
        .fn()
        .mockResolvedValueOnce({
          status: 'pending',
          issue: { reason: 'failure-1' },
        })
        .mockResolvedValueOnce({
          status: 'pending',
          issue: { reason: 'failure-2' },
        })
        .mockResolvedValueOnce({
          status: 'pending',
          issue: { reason: 'failure-3' },
        })
        .mockResolvedValueOnce({
          status: 'pending',
          issue: { reason: 'failure-4' },
        })
        .mockResolvedValueOnce({
          status: 'pending',
          issue: { reason: 'failure-5' },
        })
        .mockResolvedValue({ status: 'pending' });

      const { result, unmount } = renderHook(() =>
        usePrimePurchaseMonitor({
          sessionKey: 'session-a',
          enabled: true,
          adapter,
          onSuccess: jest.fn(),
          onTerminal: jest.fn(),
          pollIntervalMs: 100,
        }),
      );

      await flushMonitorMicrotasks();
      expect(adapter).toHaveBeenCalledTimes(1);
      expect(result.current.hasError).toBe(true);

      await advanceMonitorTimers(100);
      expect(adapter).toHaveBeenCalledTimes(2);
      await advanceMonitorTimers(200);
      expect(adapter).toHaveBeenCalledTimes(3);
      await advanceMonitorTimers(400);
      expect(adapter).toHaveBeenCalledTimes(4);
      await advanceMonitorTimers(600);
      expect(adapter).toHaveBeenCalledTimes(5);
      await advanceMonitorTimers(600);
      expect(adapter).toHaveBeenCalledTimes(6);
      expect(result.current.hasError).toBe(false);

      await advanceMonitorTimers(100);
      expect(adapter).toHaveBeenCalledTimes(7);
      unmount();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('stops automatic polling at timeout while preserving manual refresh', async () => {
    jest.useFakeTimers();
    try {
      const adapter = jest.fn().mockResolvedValue({ status: 'pending' });
      const onEvent = jest.fn();
      const { result, unmount } = renderHook(() =>
        usePrimePurchaseMonitor({
          sessionKey: 'session-a',
          enabled: true,
          adapter,
          onSuccess: jest.fn(),
          onTerminal: jest.fn(),
          onEvent,
          pollIntervalMs: 100,
          timeoutMs: 250,
        }),
      );

      await flushMonitorMicrotasks();
      await advanceMonitorTimers(250);
      expect(result.current.isTimedOut).toBe(true);
      const callsAtTimeout = adapter.mock.calls.length;

      act(() => {
        visibilityHandler?.(true);
      });
      await advanceMonitorTimers(1000);
      expect(adapter).toHaveBeenCalledTimes(callsAtTimeout);

      await act(async () => {
        await expect(result.current.refresh()).resolves.toBe('pending');
      });
      expect(adapter).toHaveBeenCalledTimes(callsAtTimeout + 1);
      await advanceMonitorTimers(1000);
      expect(adapter).toHaveBeenCalledTimes(callsAtTimeout + 1);
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'timedOut' }),
      );
      unmount();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('retries after a success handler failure and stops after recovery', async () => {
    const adapter = jest.fn().mockResolvedValue({
      status: 'succeeded',
      data: { value: 1 },
    });
    const onSuccess = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary completion failure'))
      .mockResolvedValue(undefined);

    const { result, unmount } = renderHook(() =>
      usePrimePurchaseMonitor({
        sessionKey: 'session-a',
        enabled: true,
        adapter,
        onSuccess,
        onTerminal: jest.fn(),
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(result.current.hasError).toBe(true);
      expect(result.current.isPolling).toBe(false);
    });
    await act(async () => {
      await expect(result.current.refresh()).resolves.toBe('succeeded');
    });
    expect(onSuccess).toHaveBeenCalledTimes(2);

    act(() => {
      visibilityHandler?.(true);
    });
    expect(adapter).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('keeps polling when an event observer throws', async () => {
    const adapter = jest.fn().mockResolvedValue({ status: 'pending' });
    const { unmount } = renderHook(() =>
      usePrimePurchaseMonitor({
        sessionKey: 'session-a',
        enabled: true,
        adapter,
        onSuccess: jest.fn(),
        onTerminal: jest.fn(),
        onEvent: () => {
          throw new OneKeyLocalError('observer failure');
        },
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(adapter).toHaveBeenCalledTimes(1);
    });
    unmount();
  });
});
