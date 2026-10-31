/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IFreeTrialTranslateStopPayload } from '@onekeyhq/kit/src/components/WebView/useWebViewTranslate';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import {
  PRIME_FREE_TRIAL_NOT_OPEN_CODE,
  PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import { usePageTranslation } from './usePageTranslation';

const mockTrialAttempt = jest.fn();
const mockTrialResult = jest.fn();
const mockStartTranslate = jest.fn();
const mockRestoreOriginal = jest.fn();
const mockTranslatingRef = { current: false };
let mockOnFreeTrialUnavailable:
  | ((payload: IFreeTrialTranslateStopPayload) => void)
  | undefined;
const mockShowFreeTrialNoticeToast = jest.fn();
const mockShowActiveRejectedFeedback = jest.fn();
const mockToastMessage = jest.fn();
const mockToastError = jest.fn();
const mockIsLoggedIn = jest.fn();
const mockEnsureFeatureAccess = jest.fn();
let mockUser = { onekeyUserId: 'user-a', isOneKeyIdBanned: false };
let mockPrimeActive = false;
let mockOnAccountBanned: (() => void) | undefined;
let mockCachedAccessStatus: 'available' | 'exhausted' = 'available';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'zh-CN',
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    message: (...args: unknown[]) => {
      mockToastMessage(...args);
    },
    error: (...args: unknown[]) => {
      mockToastError(...args);
    },
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: { isLoggedIn: () => mockIsLoggedIn() as unknown },
    servicePrimeFreeTrial: { refreshQuota: jest.fn() },
  },
}));

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    isPrimeSubscriptionActive: mockPrimeActive,
    user: mockUser,
  }),
}));

jest.mock('@onekeyhq/kit/src/components/WebView/useWebViewTranslate', () => ({
  useWebViewTranslate: ({
    onFreeTrialUnavailable,
    onAccountBanned,
  }: {
    onFreeTrialUnavailable: (payload: IFreeTrialTranslateStopPayload) => void;
    onAccountBanned?: () => void;
  }) => {
    mockOnFreeTrialUnavailable = onFreeTrialUnavailable;
    mockOnAccountBanned = onAccountBanned;
    return {
      startTranslate: (...args: unknown[]) => {
        mockTranslatingRef.current = true;
        mockStartTranslate(...args);
      },
      restoreOriginal: () => {
        mockTranslatingRef.current = false;
        mockRestoreOriginal();
      },
      translatingRef: mockTranslatingRef,
    };
  },
}));

jest.mock(
  '@onekeyhq/kit/src/views/Prime/components/PrimeFreeTrialRemainingHint',
  () => ({
    PrimeFreeTrialRemainingHint: () => null,
  }),
);

jest.mock('@onekeyhq/kit/src/views/Prime/hooks/usePrimeFeatureAccess', () => ({
  isPrimeFreeTrialTravelMode: () => false,
  usePrimeFeatureAccess: () => ({
    showFreeTrialNoticeToast: (...args: unknown[]) => {
      mockShowFreeTrialNoticeToast(...args);
    },
    showActiveRejectedFeedback: (...args: unknown[]) => {
      mockShowActiveRejectedFeedback(...args);
    },
    openPrimeDashboard: jest.fn(),
    ensureFeatureAccess: (...args: unknown[]) =>
      mockEnsureFeatureAccess(...args) as unknown,
    getCachedAccess: () => ({ status: mockCachedAccessStatus }),
  }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useTranslateSettingsPersistAtom: () => [
    { engine: 'ai', displayMode: 'replace', targetLanguage: 'auto' },
    jest.fn(),
  ],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    discovery: { translation: { dappTranslateToggle: jest.fn() } },
    prime: {
      subscription: {
        primeFreeTrialAttempt: (params: unknown) => {
          mockTrialAttempt(params);
        },
        primeFreeTrialResult: (params: unknown) => {
          mockTrialResult(params);
        },
        primeFreeTrialQuotaExhausted: jest.fn(),
        primeFreeTrialTrace: jest.fn(),
      },
    },
  },
}));

jest.mock('./useWebTabs', () => ({
  useActiveTabId: () => ({ activeTabId: 'tab-1' }),
  useWebTabDataById: () => ({ tab: { url: 'https://docs.example.com/a' } }),
}));

const EXHAUSTED_PAYLOAD: IFreeTrialTranslateStopPayload = {
  freeTrialError: {
    code: PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE,
    data: {
      featureId: EPrimeFeatures.DAppTranslate,
      remaining: 0,
      resetAt: 1_793_491_200_000,
    },
  },
  sessionId: 'session-1',
  targetLang: 'zh-CN',
};

async function flush() {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

// Starts a session, then the session hits the free-trial limit: the
// translate hook stops it (translatingRef false) and reports the error.
async function startThenRunOut(
  payload: IFreeTrialTranslateStopPayload = EXHAUSTED_PAYLOAD,
) {
  const hook = renderHook(() => usePageTranslation('tab-1'));
  await act(async () => {
    hook.result.current.handleTranslate();
    await flush();
  });
  expect(mockStartTranslate).toHaveBeenCalledTimes(1);
  expect(hook.result.current.isTranslated).toBe(true);

  act(() => {
    mockTranslatingRef.current = false;
    mockOnFreeTrialUnavailable?.(payload);
  });
  return hook;
}

describe('usePageTranslation free-trial pause', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTranslatingRef.current = false;
    mockCachedAccessStatus = 'available';
    mockIsLoggedIn.mockResolvedValue(true);
    mockUser = { onekeyUserId: 'user-a', isOneKeyIdBanned: false };
    mockPrimeActive = false;
    mockEnsureFeatureAccess.mockReset();
  });

  it.each([true, false])(
    'blocks a banned user before paid=%s or cached access',
    async (paid) => {
      mockPrimeActive = paid;
      mockUser.isOneKeyIdBanned = true;
      const { result } = renderHook(() => usePageTranslation('tab-1'));
      await act(async () => {
        result.current.handleTranslate();
        await flush();
      });
      expect(mockStartTranslate).not.toHaveBeenCalled();
      expect(mockIsLoggedIn).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({ toastId: 'discovery-account-banned' }),
      );
    },
  );

  it('clears translated UI and shows one account message when the running session stops', async () => {
    const { result } = renderHook(() => usePageTranslation('tab-1'));
    await act(async () => {
      result.current.handleTranslate();
      await flush();
    });
    expect(result.current.isTranslated).toBe(true);
    act(() => {
      mockTranslatingRef.current = false;
      mockOnAccountBanned?.();
    });
    expect(result.current.isTranslated).toBe(false);
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockShowFreeTrialNoticeToast).not.toHaveBeenCalled();
  });

  it('stops a running translation when the account changes', async () => {
    const { result, rerender } = renderHook(() => usePageTranslation('tab-1'));
    await act(async () => {
      result.current.handleTranslate();
      await flush();
    });
    mockUser = { onekeyUserId: 'user-b', isOneKeyIdBanned: false };
    rerender();
    expect(mockRestoreOriginal).toHaveBeenCalledTimes(1);
    expect(result.current.isTranslated).toBe(false);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('stops a running translation when another request discovers the ban', async () => {
    const { result, rerender } = renderHook(() => usePageTranslation('tab-1'));
    await act(async () => {
      result.current.handleTranslate();
      await flush();
    });
    mockUser = { ...mockUser, isOneKeyIdBanned: true };
    rerender();
    expect(mockRestoreOriginal).toHaveBeenCalledTimes(1);
    expect(result.current.isTranslated).toBe(false);
    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it('rechecks a ban discovered while the access check was pending', async () => {
    let resolve!: (loggedIn: boolean) => void;
    mockIsLoggedIn.mockReturnValueOnce(
      new Promise<boolean>((r) => {
        resolve = r;
      }),
    );
    const { result, rerender } = renderHook(() => usePageTranslation('tab-1'));
    act(() => result.current.handleTranslate());
    mockUser = { ...mockUser, isOneKeyIdBanned: true };
    rerender();
    await act(async () => {
      resolve(true);
      await flush();
    });
    expect(mockStartTranslate).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it('allows the initial login opened by the translate press to complete', async () => {
    mockUser = { onekeyUserId: '', isOneKeyIdBanned: false };
    mockIsLoggedIn.mockResolvedValue(false);
    let finishLogin!: (access: {
      granted: true;
      entitlementSource: 'freeTrial';
    }) => void;
    mockEnsureFeatureAccess.mockReturnValue(
      new Promise((resolve) => {
        finishLogin = resolve;
      }),
    );
    const { result, rerender } = renderHook(() => usePageTranslation('tab-1'));
    await act(async () => {
      result.current.handleTranslate();
      await flush();
    });
    mockUser = { onekeyUserId: 'user-a', isOneKeyIdBanned: false };
    rerender();
    const options = mockEnsureFeatureAccess.mock.calls[0][0] as {
      isContextValid: () => boolean;
    };
    expect(options.isContextValid()).toBe(true);
    await act(async () => {
      finishLogin({ granted: true, entitlementSource: 'freeTrial' });
      await flush();
    });
    expect(mockStartTranslate).toHaveBeenCalledTimes(1);
  });

  it('gives feedback instead of translating when the access check fails', async () => {
    mockIsLoggedIn.mockRejectedValueOnce(new Error('token read failed'));
    const { result } = renderHook(() => usePageTranslation('tab-1'));

    await act(async () => {
      result.current.handleTranslate();
      await flush();
    });

    expect(mockStartTranslate).not.toHaveBeenCalled();
    expect(result.current.isTranslated).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith({
      title: 'global.an_error_occurred',
    });
  });

  it('translates nothing for a tab closed during the login check', async () => {
    let resolveCheck: ((value: boolean) => void) | undefined;
    mockIsLoggedIn.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCheck = resolve;
      }),
    );
    const { result, unmount } = renderHook(() => usePageTranslation('tab-1'));

    act(() => {
      result.current.handleTranslate();
    });
    // Reopening the closed tab would give a new page the same tabId.
    unmount();
    await act(async () => {
      resolveCheck?.(true);
      await flush();
    });

    expect(mockStartTranslate).not.toHaveBeenCalled();
    expect(mockShowActiveRejectedFeedback).not.toHaveBeenCalled();
  });

  it('stays in translate mode when the quota runs out mid-session', async () => {
    const { result } = await startThenRunOut();

    expect(result.current.isTranslated).toBe(true);
    expect(mockRestoreOriginal).not.toHaveBeenCalled();
    expect(mockShowFreeTrialNoticeToast).toHaveBeenCalledWith({
      featureId: EPrimeFeatures.DAppTranslate,
      notice: { kind: 'exhausted', resetAt: 1_793_491_200_000 },
      // One id for every tab and session.
      toastId: 'discovery-free-trial-exhausted',
    });
  });

  it('restores the original from the paused page', async () => {
    const { result } = await startThenRunOut();
    mockCachedAccessStatus = 'exhausted';

    await act(async () => {
      result.current.handleTranslate();
      await flush();
    });

    expect(mockRestoreOriginal).toHaveBeenCalledTimes(1);
    expect(mockStartTranslate).toHaveBeenCalledTimes(1);
    expect(mockShowActiveRejectedFeedback).not.toHaveBeenCalled();
    expect(result.current.isTranslated).toBe(false);
  });

  it('keeps the paused page when retranslating with no quota left', async () => {
    const { result } = await startThenRunOut();
    mockCachedAccessStatus = 'exhausted';

    await act(async () => {
      result.current.handleRetranslate();
      await flush();
    });

    expect(mockShowActiveRejectedFeedback).toHaveBeenCalledTimes(1);
    expect(mockRestoreOriginal).not.toHaveBeenCalled();
    expect(mockStartTranslate).toHaveBeenCalledTimes(1);
    expect(result.current.isTranslated).toBe(true);
  });

  it('uses one toast id when the trial is closed mid-session', async () => {
    const { result } = await startThenRunOut({
      ...EXHAUSTED_PAYLOAD,
      freeTrialError: {
        code: PRIME_FREE_TRIAL_NOT_OPEN_CODE,
        data: { featureId: EPrimeFeatures.DAppTranslate },
      },
    });

    expect(result.current.isTranslated).toBe(true);
    expect(mockShowFreeTrialNoticeToast).toHaveBeenCalledWith({
      featureId: EPrimeFeatures.DAppTranslate,
      notice: { kind: 'noLongerAvailable' },
      toastId: 'discovery-free-trial-not-open',
    });
  });
});
