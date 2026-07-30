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
          pendingSubscribeRef,
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
    renderHook(() =>
      usePrimeSubscribeResume({
        ensurePrimeSubscriptionActive,
        isLoggedIn: true,
        pendingSubscribeRef,
      }),
    );

    pendingSubscribeRef.current = null;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(PRIME_SUBSCRIBE_RESUME_DELAY_MS);
    });

    expect(ensurePrimeSubscriptionActive).not.toHaveBeenCalled();
  });
});
