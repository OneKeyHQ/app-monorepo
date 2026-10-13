/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  PrimeLoginDialogCancelError,
  PrimeLoginHandedOffToExtExpandTabError,
} from '@onekeyhq/shared/src/errors';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type {
  IPrimeFreeTrialAtomData,
  IPrimeFreeTrialQuota,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';
import { EPrimeFreeTrialPendingActionType } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import { usePrimeFeatureAccess } from './usePrimeFeatureAccess';

const mockIsLoggedIn = jest.fn();
const mockIsPrimeSubscriptionActive = jest.fn();
const mockGetPublicConfig = jest.fn();
const mockRefreshQuota = jest.fn();
const mockSavePendingAction = jest.fn();
const mockGetHeldReservationEnd = jest.fn();
const mockLoginOneKeyId = jest.fn();
const mockPushFullModal = jest.fn();
const mockToastMessage = jest.fn();
const mockDialogClose = jest.fn(async () => undefined);
const mockDialogLoading = jest.fn((_params: unknown) => ({
  close: mockDialogClose,
}));
let mockShouldRunInExpandTab = false;
let mockHookPrime = false;
let mockAtom: IPrimeFreeTrialAtomData;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      isLoggedIn: () => mockIsLoggedIn() as unknown,
      isPrimeSubscriptionActive: () =>
        mockIsPrimeSubscriptionActive() as unknown,
      getLocalUserInfo: async () => ({ onekeyUserId: 'user-a' }),
    },
    servicePrimeFreeTrial: {
      getPublicConfig: (params: unknown) =>
        mockGetPublicConfig(params) as unknown,
      refreshQuota: (params: unknown) => mockRefreshQuota(params) as unknown,
      savePendingAction: (params: unknown) =>
        mockSavePendingAction(params) as unknown,
      getHeldReservationEnd: (params: unknown) =>
        mockGetHeldReservationEnd(params) as unknown,
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    isPrimeSubscriptionActive: mockHookPrime,
    isLoggedIn: true,
    user: { onekeyUserId: 'user-a' },
    loginOneKeyId: (params: unknown) => mockLoginOneKeyId(params) as unknown,
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/components/OneKeyAuth/extOneKeyIdAuthExpandTab',
  () => ({
    shouldRunOneKeyIdAuthInExtExpandTab: () => mockShouldRunInExpandTab,
  }),
);

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushFullModal: mockPushFullModal }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimeFreeTrialAtom: () => [mockAtom],
}));

jest.mock('@onekeyhq/components', () => ({
  Button: () => null,
  Dialog: {
    loading: (params: unknown) => mockDialogLoading(params) as unknown,
  },
  Toast: { message: (params: unknown) => mockToastMessage(params) as unknown },
  rootNavigationRef: { current: undefined },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({ profile: { kind: 'standard' } }),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => noopLogger,
  });
  return { defaultLogger: noopLogger };
});

const RESET_AT = Date.now() + 10 * 24 * 60 * 60 * 1000;

function quotaWith(remaining: number): IPrimeFreeTrialQuota {
  return {
    period: '2026-10',
    resetAt: RESET_AT,
    features: [
      {
        featureId: EPrimeFeatures.BulkSend,
        unit: 'count',
        monthlyQuota: 1,
        used: 1 - remaining,
        remaining,
      },
    ],
  };
}

function setSnapshot(data: IPrimeFreeTrialQuota | null | undefined) {
  mockAtom = {
    config: { status: 'idle' },
    quota:
      data === undefined
        ? { status: 'idle' }
        : { status: 'success', onekeyUserId: 'user-a', data },
  };
}

function dashboardReason() {
  return (
    mockPushFullModal.mock.calls[0]?.[1] as
      | { params: { freeTrialReason?: string } }
      | undefined
  )?.params.freeTrialReason;
}

function renderAccessHook() {
  return renderHook(() => usePrimeFeatureAccess()).result;
}

describe('usePrimeFeatureAccess.ensureFeatureAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShouldRunInExpandTab = false;
    mockHookPrime = false;
    mockIsLoggedIn.mockResolvedValue(true);
    mockIsPrimeSubscriptionActive.mockResolvedValue(false);
    mockGetPublicConfig.mockResolvedValue(undefined);
    mockRefreshQuota.mockResolvedValue(undefined);
    mockGetHeldReservationEnd.mockResolvedValue(undefined);
    setSnapshot(undefined);
  });

  it('lets Prime users in without any free-trial request', async () => {
    mockHookPrime = true;
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
        }),
      ).resolves.toEqual({ granted: true, entitlementSource: 'prime' });
    });
    expect(mockIsLoggedIn).not.toHaveBeenCalled();
    expect(mockRefreshQuota).not.toHaveBeenCalled();
    expect(mockGetPublicConfig).not.toHaveBeenCalled();
  });

  it('opens the dashboard without login when the trial is not open', async () => {
    mockIsLoggedIn.mockResolvedValue(false);
    mockGetPublicConfig.mockResolvedValue({ enabled: false, features: [] });
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
        }),
      ).resolves.toEqual({ granted: false });
    });
    expect(mockLoginOneKeyId).not.toHaveBeenCalled();
    expect(dashboardReason()).toBe('notOpen');
  });

  it('logs in when the config is unknown, then routes by the fresh quota', async () => {
    mockIsLoggedIn.mockResolvedValueOnce(false).mockResolvedValue(true);
    mockLoginOneKeyId.mockResolvedValue(undefined);
    mockRefreshQuota.mockResolvedValue(quotaWith(0));
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
        }),
      ).resolves.toEqual({ granted: false });
    });
    // Retried once before falling back to "unknown".
    expect(mockGetPublicConfig).toHaveBeenCalledTimes(2);
    expect(mockLoginOneKeyId).toHaveBeenCalledTimes(1);
    // Exhausted: a toast with a button, never an automatic dashboard.
    expect(mockPushFullModal).not.toHaveBeenCalled();
    expect(mockToastMessage).toHaveBeenCalledTimes(1);
    expect(mockToastMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '批量转账：本月免费次数已用完',
        actions: expect.anything(),
      }),
    );
  });

  describe('slow gate requests', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('offers the login when the public config does not answer within 5s', async () => {
      mockIsLoggedIn.mockResolvedValue(false);
      mockGetPublicConfig.mockReturnValue(new Promise(() => {}));
      mockLoginOneKeyId.mockRejectedValue(new PrimeLoginDialogCancelError());
      const result = renderAccessHook();

      let gate: Promise<unknown> | undefined;
      act(() => {
        gate = result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
        });
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(4999);
      });
      expect(mockLoginOneKeyId).not.toHaveBeenCalled();
      expect(mockDialogLoading).toHaveBeenCalledTimes(1);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(1);
        await expect(gate).resolves.toEqual({ granted: false });
      });
      // An unknown config is never "not open": the login is offered, after
      // the loading dialog was closed.
      expect(mockPushFullModal).not.toHaveBeenCalled();
      expect(mockLoginOneKeyId).toHaveBeenCalledTimes(1);
      expect(mockDialogClose).toHaveBeenCalledTimes(1);
      expect(mockDialogClose.mock.invocationCallOrder[0]).toBeLessThan(
        mockLoginOneKeyId.mock.invocationCallOrder[0],
      );
    });

    it('shows no loading when the gate answers quickly', async () => {
      setSnapshot(quotaWith(0));
      mockRefreshQuota.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(quotaWith(1)), 100);
          }),
      );
      const result = renderAccessHook();

      let gate: Promise<unknown> | undefined;
      act(() => {
        gate = result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
        });
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1000);
        await expect(gate).resolves.toMatchObject({ granted: true });
      });
      expect(mockDialogLoading).not.toHaveBeenCalled();
    });

    it('leaves the loading to a caller that shows its own', async () => {
      setSnapshot(quotaWith(0));
      mockRefreshQuota.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(quotaWith(1)), 2000);
          }),
      );
      const result = renderAccessHook();

      let gate: Promise<unknown> | undefined;
      act(() => {
        gate = result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
          showLoading: false,
        });
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
        await expect(gate).resolves.toMatchObject({ granted: true });
      });
      expect(mockDialogLoading).not.toHaveBeenCalled();
    });

    it('shows the loading for a slow quota refresh and closes it', async () => {
      setSnapshot(quotaWith(0));
      mockRefreshQuota.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(quotaWith(1)), 2000);
          }),
      );
      const result = renderAccessHook();

      let gate: Promise<unknown> | undefined;
      act(() => {
        gate = result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
        });
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
        await expect(gate).resolves.toMatchObject({ granted: true });
      });
      expect(mockDialogLoading).toHaveBeenCalledTimes(1);
      expect(mockDialogClose).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the popup action and stays silent when the login is handed off', async () => {
    mockShouldRunInExpandTab = true;
    mockIsLoggedIn.mockResolvedValue(false);
    mockLoginOneKeyId.mockRejectedValue(
      new PrimeLoginHandedOffToExtExpandTabError(),
    );
    const result = renderAccessHook();
    const action = {
      type: EPrimeFreeTrialPendingActionType.BulkCopyAddresses,
      walletId: 'hd-1',
      networkId: 'btc--0',
    };

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkCopyAddresses,
          extPopup: { mode: 'pendingAction', action },
        }),
      ).resolves.toEqual({ granted: false });
    });
    expect(mockSavePendingAction).toHaveBeenCalledWith(action);
    // The hand-off keeps the action it just saved.
    expect(mockLoginOneKeyId).toHaveBeenCalledWith({
      keepFreeTrialPendingAction: true,
    });
    expect(mockPushFullModal).not.toHaveBeenCalled();
  });

  it('lets a popup hand-off without an action drop an older one', async () => {
    mockShouldRunInExpandTab = true;
    mockIsLoggedIn.mockResolvedValue(false);
    mockLoginOneKeyId.mockRejectedValue(
      new PrimeLoginHandedOffToExtExpandTabError(),
    );
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.AddressRiskCheck,
        }),
      ).resolves.toEqual({ granted: false });
    });
    expect(mockSavePendingAction).not.toHaveBeenCalled();
    expect(mockLoginOneKeyId).toHaveBeenCalledWith({
      keepFreeTrialPendingAction: false,
    });
  });

  it('lets bulk send through in the popup so the expand tab gates it', async () => {
    mockShouldRunInExpandTab = true;
    mockIsLoggedIn.mockResolvedValue(false);
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
          extPopup: { mode: 'passThrough' },
        }),
      ).resolves.toMatchObject({ granted: true, deferredToExpandTab: true });
    });
    expect(mockLoginOneKeyId).not.toHaveBeenCalled();
  });

  it('reports a cancelled login to the caller before any feedback', async () => {
    mockIsLoggedIn.mockResolvedValue(false);
    mockLoginOneKeyId.mockRejectedValue(new PrimeLoginDialogCancelError());
    const onDenied = jest.fn();
    const result = renderAccessHook();

    await act(async () => {
      await result.current.ensureFeatureAccess({
        featureId: EPrimeFeatures.BulkSend,
        onDenied,
      });
    });
    expect(onDenied).toHaveBeenCalledWith('loginCancelled');
    expect(mockPushFullModal).not.toHaveBeenCalled();
  });

  it('drops the continuation when the context changed during login', async () => {
    mockIsLoggedIn.mockResolvedValueOnce(false).mockResolvedValue(true);
    mockLoginOneKeyId.mockResolvedValue(undefined);
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
          isContextValid: () => false,
        }),
      ).resolves.toEqual({ granted: false });
    });
  });

  describe('context changed while a logged-in user waited', () => {
    it('drops the grant after the quota refresh', async () => {
      setSnapshot(quotaWith(0));
      mockRefreshQuota.mockResolvedValue(quotaWith(1));
      const onDenied = jest.fn();
      const result = renderAccessHook();

      await act(async () => {
        await expect(
          result.current.ensureFeatureAccess({
            featureId: EPrimeFeatures.BulkSend,
            isContextValid: () => false,
            onDenied,
          }),
        ).resolves.toEqual({ granted: false });
      });
      expect(mockRefreshQuota).toHaveBeenCalled();
      expect(onDenied).toHaveBeenCalledWith('contextChanged');
    });

    it('drops the grant on the fast path and on entry', async () => {
      setSnapshot(quotaWith(1));
      mockRefreshQuota.mockReturnValue(new Promise(() => {}));
      const result = renderAccessHook();

      for (const deferQuotaCheck of [false, true]) {
        await act(async () => {
          await expect(
            result.current.ensureFeatureAccess({
              featureId: EPrimeFeatures.BulkSend,
              deferQuotaCheck,
              isContextValid: () => false,
            }),
          ).resolves.toEqual({ granted: false });
        });
      }
    });

    it('drops a Prime grant found by the background re-check', async () => {
      mockIsPrimeSubscriptionActive.mockResolvedValue(true);
      const result = renderAccessHook();

      await act(async () => {
        await expect(
          result.current.ensureFeatureAccess({
            featureId: EPrimeFeatures.BulkSend,
            isContextValid: async () => false,
          }),
        ).resolves.toEqual({ granted: false });
      });
    });
  });

  it('lets a logged-in user with uses left in without waiting', async () => {
    setSnapshot(quotaWith(1));
    mockRefreshQuota.mockReturnValue(new Promise(() => {}));
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
        }),
      ).resolves.toEqual({ granted: true, entitlementSource: 'freeTrial' });
    });
    expect(mockRefreshQuota).toHaveBeenCalledWith({ dedupe: true });
  });

  it('confirms a cached 0 with a refresh before blocking', async () => {
    setSnapshot(quotaWith(0));
    mockRefreshQuota.mockResolvedValue(quotaWith(1));
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
        }),
      ).resolves.toEqual({ granted: true, entitlementSource: 'freeTrial' });
    });
    expect(mockPushFullModal).not.toHaveBeenCalled();
  });

  it('explains a quota held by an earlier use instead of opening the dashboard', async () => {
    setSnapshot(quotaWith(0));
    mockRefreshQuota.mockResolvedValue(quotaWith(0));
    mockGetHeldReservationEnd.mockResolvedValue(Date.now() + 10 * 60 * 1000);
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
        }),
      ).resolves.toEqual({ granted: false });
    });
    expect(mockGetHeldReservationEnd).toHaveBeenCalledWith({
      featureId: EPrimeFeatures.BulkSend,
    });
    expect(mockPushFullModal).not.toHaveBeenCalled();
    expect(mockToastMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '批量转账：上次使用尚未结束',
      }),
    );
  });

  it('never reads a failed quota load as exhausted', async () => {
    mockRefreshQuota.mockResolvedValue(undefined);
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
        }),
      ).resolves.toEqual({ granted: true, entitlementSource: 'freeTrial' });
    });
  });

  it('treats a null quota with a closed feature as not open', async () => {
    mockRefreshQuota.mockResolvedValue(null);
    mockGetPublicConfig.mockResolvedValue({ enabled: false, features: [] });
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
        }),
      ).resolves.toEqual({ granted: false });
    });
    expect(dashboardReason()).toBe('notOpen');
  });

  it('lets a logged-in user with no uses left into the page on entry', async () => {
    setSnapshot(quotaWith(0));
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
          deferQuotaCheck: true,
        }),
      ).resolves.toEqual({ granted: true, entitlementSource: 'freeTrial' });
    });
    expect(mockRefreshQuota).not.toHaveBeenCalled();
    expect(mockToastMessage).not.toHaveBeenCalled();
    expect(mockPushFullModal).not.toHaveBeenCalled();
    expect(mockDialogLoading).not.toHaveBeenCalled();
  });

  it('still asks to log in on entry, then lets the user in without a quota check', async () => {
    mockIsLoggedIn.mockResolvedValueOnce(false).mockResolvedValue(true);
    mockLoginOneKeyId.mockResolvedValue(undefined);
    mockRefreshQuota.mockResolvedValue(quotaWith(0));
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
          deferQuotaCheck: true,
        }),
      ).resolves.toEqual({ granted: true, entitlementSource: 'freeTrial' });
    });
    expect(mockLoginOneKeyId).toHaveBeenCalledTimes(1);
    expect(mockRefreshQuota).not.toHaveBeenCalled();
    expect(mockToastMessage).not.toHaveBeenCalled();
  });

  it('still opens the dashboard on entry when the trial is not open', async () => {
    mockIsLoggedIn.mockResolvedValue(false);
    mockGetPublicConfig.mockResolvedValue({ enabled: false, features: [] });
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
          deferQuotaCheck: true,
        }),
      ).resolves.toEqual({ granted: false });
    });
    expect(mockLoginOneKeyId).not.toHaveBeenCalled();
    expect(dashboardReason()).toBe('notOpen');
  });
});
