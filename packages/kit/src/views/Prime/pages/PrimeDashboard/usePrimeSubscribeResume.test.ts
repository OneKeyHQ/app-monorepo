/** @jest-environment jsdom */

import type { MutableRefObject } from 'react';

import { act, cleanup, renderHook } from '@testing-library/react';

import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import {
  PRIME_SUBSCRIBE_RESUME_DELAY_MS,
  usePrimeSubscribeResume,
} from './usePrimeSubscribeResume';

import type { IPrimePendingSubscribe } from './usePrimeSubscribeResume';

const freeTrial = {
  periodIso: 'P3D',
  periodNumber: 3,
  periodUnit: 'day' as const,
  source: 'web' as const,
};

function buildPendingSubscribeRef(): MutableRefObject<IPrimePendingSubscribe | null> {
  return {
    current: {
      subscriptionPeriod: 'P1Y',
      freeTrial,
    },
  };
}

function buildSubscribeInFlightRef(): MutableRefObject<boolean> {
  return {
    current: false,
  };
}

describe('usePrimeSubscribeResume', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('reschedules without losing the pending intent when dependencies change', async () => {
    const firstEnsure = jest.fn(async () => undefined);
    const latestEnsure = jest.fn(async () => undefined);
    const pendingSubscribeRef = buildPendingSubscribeRef();
    const subscribeInFlightRef = buildSubscribeInFlightRef();
    const onLoadingChange = jest.fn();
    const { rerender } = renderHook(
      ({
        ensurePrimeSubscriptionActive,
        featureName,
      }: {
        ensurePrimeSubscriptionActive: typeof firstEnsure;
        featureName: EPrimeFeatures;
      }) =>
        usePrimeSubscribeResume({
          ensurePrimeSubscriptionActive,
          featureName,
          isLoggedIn: true,
          onLoadingChange,
          pendingSubscribeRef,
          subscribeInFlightRef,
        }),
      {
        initialProps: {
          ensurePrimeSubscriptionActive: firstEnsure,
          featureName: EPrimeFeatures.BulkSend,
        },
      },
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(PRIME_SUBSCRIBE_RESUME_DELAY_MS / 2);
    });
    rerender({
      ensurePrimeSubscriptionActive: latestEnsure,
      featureName: EPrimeFeatures.ReceiveRiskMonitoring,
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(PRIME_SUBSCRIBE_RESUME_DELAY_MS - 1);
    });

    expect(firstEnsure).not.toHaveBeenCalled();
    expect(latestEnsure).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });

    expect(latestEnsure).toHaveBeenCalledWith({
      skipDialogConfirm: true,
      selectedSubscriptionPeriod: 'P1Y',
      featureName: EPrimeFeatures.ReceiveRiskMonitoring,
      freeTrial,
    });
    expect(pendingSubscribeRef.current).toBeNull();
  });

  it('does not resume after an explicit action consumes the pending intent', async () => {
    const ensurePrimeSubscriptionActive = jest.fn(async () => undefined);
    const pendingSubscribeRef = buildPendingSubscribeRef();
    const subscribeInFlightRef = buildSubscribeInFlightRef();
    renderHook(() =>
      usePrimeSubscribeResume({
        ensurePrimeSubscriptionActive,
        isLoggedIn: true,
        onLoadingChange: jest.fn(),
        pendingSubscribeRef,
        subscribeInFlightRef,
      }),
    );

    pendingSubscribeRef.current = null;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(PRIME_SUBSCRIBE_RESUME_DELAY_MS);
    });

    expect(ensurePrimeSubscriptionActive).not.toHaveBeenCalled();
  });

  it('holds the shared subscription lock while resuming after login', async () => {
    let finishSubscribe: (() => void) | undefined;
    const ensurePrimeSubscriptionActive = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSubscribe = resolve;
        }),
    );
    const pendingSubscribeRef = buildPendingSubscribeRef();
    const subscribeInFlightRef = buildSubscribeInFlightRef();
    const onLoadingChange = jest.fn();
    renderHook(() =>
      usePrimeSubscribeResume({
        ensurePrimeSubscriptionActive,
        isLoggedIn: true,
        onLoadingChange,
        pendingSubscribeRef,
        subscribeInFlightRef,
      }),
    );

    act(() => {
      jest.advanceTimersByTime(PRIME_SUBSCRIBE_RESUME_DELAY_MS);
    });

    expect(subscribeInFlightRef.current).toBe(true);
    expect(pendingSubscribeRef.current).toBeNull();
    expect(onLoadingChange).toHaveBeenCalledWith(true);

    await act(async () => {
      finishSubscribe?.();
      await Promise.resolve();
    });

    expect(subscribeInFlightRef.current).toBe(false);
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
  });
});
