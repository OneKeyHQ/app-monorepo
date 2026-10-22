/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import {
  PrimeLoginDialogCancelError,
  PrimeLoginHandedOffToExtExpandTabError,
} from '@onekeyhq/shared/src/errors';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type {
  IPrimeFreeTrialAtomData,
  IPrimeFreeTrialFeatureId,
  IPrimeFreeTrialQuota,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';
import { EPrimeFreeTrialPendingActionType } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import { usePrimeFeatureAccess } from './usePrimeFeatureAccess';

const mockTrialAttempt = jest.fn();
const mockTrialResult = jest.fn();
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

// Toasts read their copy from the zh-CN catalog.
jest.mock('react-intl', () => {
  const actual: typeof import('react-intl') = jest.requireActual('react-intl');
  const intl = actual.createIntl({
    locale: 'zh-CN',
    messages: jest.requireActual('@onekeyhq/shared/src/locale/json/zh_CN.json'),
  });
  return { ...actual, useIntl: () => intl };
});

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({ profile: { kind: 'standard' } }),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: (_target, key) => {
      if (key === 'primeFreeTrialAttempt') return mockTrialAttempt;
      if (key === 'primeFreeTrialResult') return mockTrialResult;
      return noopLogger;
    },
  });
  return { defaultLogger: noopLogger };
});

const RESET_AT = Date.now() + 10 * 24 * 60 * 60 * 1000;

function quotaWith(
  remaining: number,
  featureId: IPrimeFreeTrialFeatureId = EPrimeFeatures.BulkSend,
): IPrimeFreeTrialQuota {
  return {
    period: '2026-10',
    resetAt: RESET_AT,
    features: [
      {
        featureId,
        unit: 'count',
        monthlyQuota: 1,
        used: 1 - remaining,
        remaining,
        // The server reports nothing held.
        reserved: 0,
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

function toastAt(index: number) {
  return mockToastMessage.mock.calls[index]?.[0] as
    | { title?: string; message?: string; actions?: ReactElement }
    | undefined;
}

function pressGetPrimeOf(index: number) {
  const actions = toastAt(index)?.actions as
    | ReactElement<{ onPress: () => void }>
    | undefined;
  act(() => {
    actions?.props.onPress();
  });
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

  it('logs in when the config is unknown, then lets the user in while the quota is still unknown', async () => {
    mockIsLoggedIn.mockResolvedValueOnce(false).mockResolvedValue(true);
    mockLoginOneKeyId.mockResolvedValue(undefined);
    // The quota of the new login has not come back yet.
    mockRefreshQuota.mockReturnValue(new Promise(() => {}));
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
        }),
      ).resolves.toEqual({ granted: true, entitlementSource: 'freeTrial' });
    });
    // Retried once before falling back to "unknown".
    expect(mockGetPublicConfig).toHaveBeenCalledTimes(2);
    expect(mockLoginOneKeyId).toHaveBeenCalledTimes(1);
    // The page's remaining hint and start judge the quota.
    expect(mockPushFullModal).not.toHaveBeenCalled();
    expect(mockToastMessage).not.toHaveBeenCalled();
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
    let isValid = true;
    mockLoginOneKeyId.mockImplementationOnce(async () => {
      isValid = false;
    });
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
          isContextValid: () => isValid,
        }),
      ).resolves.toEqual({ granted: false });
    });
    expect(mockLoginOneKeyId).toHaveBeenCalledTimes(1);
  });

  describe('context gone before any feedback', () => {
    it('opens no dashboard when the trial is not open', async () => {
      mockIsLoggedIn.mockResolvedValue(false);
      mockGetPublicConfig.mockResolvedValue({ enabled: false, features: [] });
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
      expect(onDenied).toHaveBeenCalledTimes(1);
      expect(onDenied).toHaveBeenCalledWith('contextChanged');
      expect(mockPushFullModal).not.toHaveBeenCalled();
    });

    it('asks for no login', async () => {
      mockIsLoggedIn.mockResolvedValue(false);
      const result = renderAccessHook();

      await act(async () => {
        await expect(
          result.current.ensureFeatureAccess({
            featureId: EPrimeFeatures.BulkSend,
            isContextValid: () => false,
          }),
        ).resolves.toEqual({ granted: false });
      });
      expect(mockLoginOneKeyId).not.toHaveBeenCalled();
    });

    it('shows no exhausted feedback', async () => {
      setSnapshot(quotaWith(0));
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
      expect(onDenied).toHaveBeenCalledWith('contextChanged');
      expect(mockToastMessage).not.toHaveBeenCalled();
      expect(mockPushFullModal).not.toHaveBeenCalled();
    });

    it('still hands off to the dashboard after the gate left its page', async () => {
      mockIsLoggedIn.mockResolvedValue(false);
      mockGetPublicConfig.mockResolvedValue({ enabled: false, features: [] });
      let isPageOpen = true;
      const onDenied = jest.fn(async () => {
        isPageOpen = false;
      });
      // After a page exit the dashboard opens from the root ref.
      const rootNavigate = jest.fn();
      const { rootNavigationRef } = jest.requireMock<{
        rootNavigationRef: { current: unknown };
      }>('@onekeyhq/components');
      rootNavigationRef.current = { navigate: rootNavigate };
      const result = renderAccessHook();

      try {
        await act(async () => {
          await result.current.ensureFeatureAccess({
            featureId: EPrimeFeatures.BulkSend,
            isContextValid: () => isPageOpen,
            onDenied,
          });
        });
      } finally {
        rootNavigationRef.current = undefined;
      }
      expect(onDenied).toHaveBeenCalledWith('notOpen');
      expect(rootNavigate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            params: expect.objectContaining({ freeTrialReason: 'notOpen' }),
          }),
        }),
      );
    });
  });

  describe('context changed while a logged-in user waited', () => {
    it('drops the grant, with or without the quota check', async () => {
      setSnapshot(quotaWith(1));
      mockRefreshQuota.mockReturnValue(new Promise(() => {}));
      const result = renderAccessHook();

      for (const loginOnly of [false, true]) {
        await act(async () => {
          await expect(
            result.current.ensureFeatureAccess({
              featureId: EPrimeFeatures.BulkSend,
              loginOnly,
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
    // The page's remaining hint refreshes the snapshot, not the gate.
    expect(mockRefreshQuota).not.toHaveBeenCalled();
  });

  it('opens the dashboard with a toast for a used-up snapshot, without waiting', async () => {
    setSnapshot(quotaWith(0));
    mockRefreshQuota.mockReturnValue(new Promise(() => {}));
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
        }),
      ).resolves.toEqual({ granted: false });
    });
    expect(mockDialogLoading).not.toHaveBeenCalled();
    await waitFor(() => expect(dashboardReason()).toBe('exhausted'));
    expect(toastAt(0)).toMatchObject({
      title: '批量转账本月免费次数已用完',
      message: expect.stringMatching(/^.+ 重置$/),
      actions: undefined,
    });
  });

  it.each([
    ['live', 10 * 60 * 1000],
    ['expired', -60 * 1000],
  ])(
    'lets the user in while uses are held by an earlier one (%s): they may come back',
    async (_label, expiresIn) => {
      const quota = quotaWith(0);
      quota.features[0] = {
        ...quota.features[0],
        reserved: 1,
        reservationExpiresAt: Date.now() + expiresIn,
      };
      setSnapshot(quota);
      const result = renderAccessHook();

      await act(async () => {
        await expect(
          result.current.ensureFeatureAccess({
            featureId: EPrimeFeatures.BulkSend,
          }),
        ).resolves.toEqual({ granted: true, entitlementSource: 'freeTrial' });
      });
      expect(mockPushFullModal).not.toHaveBeenCalled();
      expect(mockToastMessage).not.toHaveBeenCalled();
    },
  );

  it('lets the user in when an older server sends no reservation fields', async () => {
    const quota = quotaWith(0);
    const { reserved: _reserved, ...withoutReservation } = quota.features[0];
    quota.features[0] = withoutReservation;
    setSnapshot(quota);
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

  it('lets a not-open user in with loginOnly to read the history', async () => {
    setSnapshot(null);
    mockAtom.config = {
      status: 'success',
      data: { enabled: false, features: [] },
    };
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.AddressRiskCheck,
          loginOnly: true,
        }),
      ).resolves.toEqual({ granted: true, entitlementSource: 'freeTrial' });
    });
    expect(mockPushFullModal).not.toHaveBeenCalled();
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
    setSnapshot(null);
    mockAtom.config = {
      status: 'success',
      data: { enabled: false, features: [] },
    };
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
        }),
      ).resolves.toEqual({ granted: false });
    });
    // Just the dashboard, no toast.
    expect(dashboardReason()).toBe('notOpen');
    expect(mockToastMessage).not.toHaveBeenCalled();
  });

  it('lets a used-up user in with loginOnly to read the history', async () => {
    setSnapshot(quotaWith(0));
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
          loginOnly: true,
        }),
      ).resolves.toEqual({ granted: true, entitlementSource: 'freeTrial' });
    });
    expect(mockToastMessage).not.toHaveBeenCalled();
    expect(mockPushFullModal).not.toHaveBeenCalled();
    expect(mockDialogLoading).not.toHaveBeenCalled();
  });

  it('still opens the dashboard on entry when the trial is not open', async () => {
    mockIsLoggedIn.mockResolvedValue(false);
    mockGetPublicConfig.mockResolvedValue({ enabled: false, features: [] });
    const result = renderAccessHook();

    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
          loginOnly: true,
        }),
      ).resolves.toEqual({ granted: false });
    });
    expect(mockLoginOneKeyId).not.toHaveBeenCalled();
    expect(dashboardReason()).toBe('notOpen');
  });
});

describe('usePrimeFeatureAccess rejection feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHookPrime = false;
    mockGetHeldReservationEnd.mockResolvedValue(undefined);
    setSnapshot(undefined);
  });

  it('opens just the dashboard for a feature not open', () => {
    const result = renderAccessHook();

    act(() => {
      result.current.handleFreeTrialError({
        error: {
          code: 90_601,
          data: {
            featureId: EPrimeFeatures.AddressRiskCheck,
            reason: 'trialNotOpen',
          },
        },
      });
    });

    expect(dashboardReason()).toBe('notOpen');
    expect(mockToastMessage).not.toHaveBeenCalled();
  });

  it('keeps translate on its page: a toast with "Get Prime"', async () => {
    const result = renderAccessHook();

    act(() => {
      result.current.showActiveRejectedFeedback({
        featureId: EPrimeFeatures.DAppTranslate,
        reason: 'exhausted',
        resetAt: RESET_AT,
      });
      result.current.showActiveRejectedFeedback({
        featureId: EPrimeFeatures.DAppTranslate,
        reason: 'notOpen',
      });
    });

    await waitFor(() => expect(mockToastMessage).toHaveBeenCalledTimes(2));
    expect(mockPushFullModal).not.toHaveBeenCalled();
    expect(toastAt(0)?.title).toBe('AI 翻译本月免费额度已用完');
    expect(toastAt(1)?.title).toBe('AI 翻译暂未开放免费体验');
    pressGetPrimeOf(0);
    expect(dashboardReason()).toBe('exhausted');
  });

  describe('details of an address not checked this month', () => {
    const detailsNotEligibleError = {
      code: 90_601,
      data: {
        featureId: EPrimeFeatures.AddressRiskCheck,
        reason: 'detailsNotEligible',
      },
    };

    it('gives the exhausted feedback when the snapshot has no use left', async () => {
      setSnapshot(quotaWith(0, EPrimeFeatures.AddressRiskCheck));
      const result = renderAccessHook();

      act(() => {
        result.current.handleFreeTrialError({
          error: detailsNotEligibleError,
        });
      });

      await waitFor(() => {
        expect(toastAt(0)).toMatchObject({
          title: '地址风险检查本月免费次数已用完',
          message: expect.stringMatching(/^.+ 重置$/),
        });
      });
      expect(dashboardReason()).toBe('exhausted');
      expect(toastAt(0)?.actions).toBeUndefined();
    });

    it('gives the exhausted feedback, without a date, when the quota is unknown', async () => {
      const result = renderAccessHook();

      act(() => {
        result.current.handleFreeTrialError({
          error: detailsNotEligibleError,
        });
      });

      await waitFor(() => {
        expect(toastAt(0)?.title).toBe('地址风险检查本月免费次数已用完');
      });
      expect(toastAt(0)?.message).toBeUndefined();
      expect(dashboardReason()).toBe('exhausted');
      expect(toastAt(0)?.actions).toBeUndefined();
    });

    it('keeps the details sentence while the snapshot has uses left', () => {
      setSnapshot(quotaWith(1, EPrimeFeatures.AddressRiskCheck));
      const result = renderAccessHook();

      act(() => {
        result.current.handleFreeTrialError({
          error: detailsNotEligibleError,
        });
      });

      expect(toastAt(0)?.title).toBe('仅可查看本月检查过的地址详情');
      expect(toastAt(0)?.message).toBeUndefined();
    });
  });

  it('titles an exhausted toast by feature with the local reset date', async () => {
    const result = renderAccessHook();

    act(() => {
      result.current.handleFreeTrialError({
        error: {
          code: 90_600,
          data: {
            featureId: EPrimeFeatures.AddressRiskCheck,
            remaining: 0,
            resetAt: RESET_AT,
          },
        },
      });
    });

    await waitFor(() => {
      expect(toastAt(0)).toMatchObject({
        title: '地址风险检查本月免费次数已用完',
        message: expect.stringMatching(/^.+ 重置$/),
      });
    });
    expect(dashboardReason()).toBe('exhausted');
    expect(toastAt(0)?.actions).toBeUndefined();
  });

  it('explains a reservation the server reports, from any device', async () => {
    const result = renderAccessHook();

    act(() => {
      result.current.handleStartRejected({
        result: {
          status: 'exhausted',
          featureId: EPrimeFeatures.BulkSend,
          data: {
            featureId: EPrimeFeatures.BulkSend,
            remaining: 0,
            reserved: 1,
            reservationExpiresAt: Date.now() + 10 * 60 * 1000,
          },
        },
      });
    });

    await waitFor(() => {
      expect(toastAt(0)).toMatchObject({
        title: '批量转账上次使用未结束',
        message: expect.stringMatching(/^若已中断，.+ 前退回次数$/),
      });
    });
    // The server knows every device's reservations: no local lookup. Nothing
    // was used up, so no dashboard.
    expect(mockGetHeldReservationEnd).not.toHaveBeenCalled();
    expect(mockPushFullModal).not.toHaveBeenCalled();
  });

  it('trusts the server when it reports nothing held', async () => {
    // A stale local record must not turn a real exhaustion into "held".
    mockGetHeldReservationEnd.mockResolvedValue(Date.now() + 10 * 60 * 1000);
    const result = renderAccessHook();

    act(() => {
      result.current.handleStartRejected({
        result: {
          status: 'exhausted',
          featureId: EPrimeFeatures.BulkSend,
          data: {
            featureId: EPrimeFeatures.BulkSend,
            remaining: 0,
            reserved: 0,
          },
        },
      });
    });

    await waitFor(() => {
      expect(toastAt(0)).toMatchObject({
        title: '批量转账本月免费次数已用完',
      });
    });
    expect(mockGetHeldReservationEnd).not.toHaveBeenCalled();
  });
});

describe('free-trial access analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHookPrime = false;
    mockIsLoggedIn.mockResolvedValue(true);
    mockIsPrimeSubscriptionActive.mockResolvedValue(false);
  });

  it.each([0, 1])(
    'records a history entry with %i uses as access, never completed usage',
    async (remaining) => {
      setSnapshot(quotaWith(remaining, EPrimeFeatures.AddressRiskCheck));
      const result = renderAccessHook();
      await act(async () => {
        await expect(
          result.current.ensureFeatureAccess({
            featureId: EPrimeFeatures.AddressRiskCheck,
            loginOnly: true,
          }),
        ).resolves.toEqual({ granted: true, entitlementSource: 'freeTrial' });
      });
      expect(mockTrialAttempt).toHaveBeenCalledTimes(1);
      expect(mockTrialResult).toHaveBeenCalledTimes(1);
      expect(mockTrialResult).toHaveBeenCalledWith(
        expect.objectContaining({
          featureId: EPrimeFeatures.AddressRiskCheck,
          stage: 'access',
          result: 'granted',
          source: 'client',
        }),
      );
      expect(mockRefreshQuota).not.toHaveBeenCalled();
    },
  );

  it.each(['cancelled', 'failed'] as const)(
    'records a %s login at a history entry',
    async (outcome) => {
      setSnapshot(undefined);
      mockIsLoggedIn.mockResolvedValue(false);
      mockGetPublicConfig.mockResolvedValue(undefined);
      mockLoginOneKeyId.mockRejectedValueOnce(
        outcome === 'cancelled'
          ? new PrimeLoginDialogCancelError()
          : new Error('login failed'),
      );
      const result = renderAccessHook();
      await act(async () => {
        await result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.AddressRiskCheck,
          loginOnly: true,
        });
      });
      expect(mockTrialAttempt).toHaveBeenCalledTimes(1);
      expect(mockTrialResult).toHaveBeenCalledTimes(1);
      expect(mockTrialResult).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'access', result: outcome }),
      );
    },
  );

  it('does not count an extension history continuation as another entry', async () => {
    setSnapshot(quotaWith(0, EPrimeFeatures.AddressRiskCheck));
    const result = renderAccessHook();
    await act(async () => {
      await result.current.ensureFeatureAccess({
        featureId: EPrimeFeatures.AddressRiskCheck,
        loginOnly: true,
        trackAttempt: false,
      });
    });
    expect(mockTrialAttempt).not.toHaveBeenCalled();
    expect(mockTrialResult).not.toHaveBeenCalled();
  });

  it.each([
    'BulkCopyAddresses',
    'BulkSend',
    'BulkRevoke',
    'AddressRiskCheck',
    'DAppTranslate',
  ] as const)(
    'records a local exhausted %s attempt without starting a reservation',
    async (featureId) => {
      setSnapshot(quotaWith(0, featureId as IPrimeFreeTrialFeatureId));
      const result = renderAccessHook();
      await act(async () => {
        await result.current.ensureFeatureAccess({
          featureId: featureId as IPrimeFreeTrialFeatureId,
        });
      });
      expect(mockTrialAttempt).toHaveBeenCalledTimes(1);
      expect(mockTrialResult).toHaveBeenCalledWith(
        expect.objectContaining({
          featureId,
          stage: 'access',
          result: 'exhausted',
          source: 'client',
          rejectionSource: 'client',
        }),
      );
    },
  );

  it.each([
    EPrimeFeatures.BulkCopyAddresses,
    EPrimeFeatures.BulkSend,
    EPrimeFeatures.BulkRevoke,
    EPrimeFeatures.AddressRiskCheck,
    EPrimeFeatures.DAppTranslate,
  ] as const)(
    'records an available %s grant without claiming completion',
    async (featureId) => {
      setSnapshot(quotaWith(1, featureId));
      const result = renderAccessHook();
      await act(async () => {
        await result.current.ensureFeatureAccess({ featureId });
      });
      expect(mockTrialAttempt).toHaveBeenCalledTimes(1);
      expect(mockTrialResult).toHaveBeenCalledWith(
        expect.objectContaining({
          featureId,
          stage: 'access',
          result: 'granted',
        }),
      );
    },
  );

  it.each(['cancelled', 'failed'] as const)(
    'distinguishes a %s login from usage completion',
    async (outcome) => {
      setSnapshot(undefined);
      mockIsLoggedIn.mockResolvedValue(false);
      mockGetPublicConfig.mockResolvedValue(undefined);
      mockLoginOneKeyId.mockRejectedValueOnce(
        outcome === 'cancelled'
          ? new PrimeLoginDialogCancelError()
          : new Error('login failed'),
      );
      const result = renderAccessHook();
      await act(async () => {
        await result.current.ensureFeatureAccess({
          featureId: EPrimeFeatures.BulkSend,
        });
      });
      expect(mockTrialResult).toHaveBeenCalledTimes(1);
      expect(mockTrialResult).toHaveBeenCalledWith(
        expect.objectContaining({ result: outcome }),
      );
    },
  );

  it('records a grant as access granted rather than completed usage', async () => {
    setSnapshot(quotaWith(1));
    const result = renderAccessHook();
    await act(async () => {
      await result.current.ensureFeatureAccess({
        featureId: EPrimeFeatures.BulkSend,
      });
    });
    expect(mockTrialAttempt).toHaveBeenCalledTimes(1);
    expect(mockTrialResult).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'granted', stage: 'access' }),
    );
    expect(mockTrialResult).not.toHaveBeenCalledWith(
      expect.objectContaining({ result: 'success' }),
    );
  });
});
