/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IFreeTrialTranslateStopPayload } from '@onekeyhq/kit/src/components/WebView/useWebViewTranslate';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import {
  PRIME_FREE_TRIAL_NOT_OPEN_CODE,
  PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import { usePageTranslation } from './usePageTranslation';

const mockStartTranslate = jest.fn();
const mockRestoreOriginal = jest.fn();
const mockTranslatingRef = { current: false };
let mockOnFreeTrialUnavailable:
  | ((payload: IFreeTrialTranslateStopPayload) => void)
  | undefined;
const mockShowQuotaExhaustedToast = jest.fn();
const mockShowActiveRejectedFeedback = jest.fn();
const mockToastMessage = jest.fn();
const mockToastError = jest.fn();
const mockIsLoggedIn = jest.fn();
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
  useOneKeyAuth: () => ({ isPrimeSubscriptionActive: false }),
}));

jest.mock('@onekeyhq/kit/src/components/WebView/useWebViewTranslate', () => ({
  useWebViewTranslate: ({
    onFreeTrialUnavailable,
  }: {
    onFreeTrialUnavailable: (payload: IFreeTrialTranslateStopPayload) => void;
  }) => {
    mockOnFreeTrialUnavailable = onFreeTrialUnavailable;
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
    showQuotaExhaustedToast: (...args: unknown[]) => {
      mockShowQuotaExhaustedToast(...args);
    },
    showActiveRejectedFeedback: (...args: unknown[]) => {
      mockShowActiveRejectedFeedback(...args);
    },
    openPrimeDashboard: jest.fn(),
    ensureFeatureAccess: jest.fn(),
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

  it('stays in translate mode when the quota runs out mid-session', async () => {
    const { result } = await startThenRunOut();

    expect(result.current.isTranslated).toBe(true);
    expect(mockRestoreOriginal).not.toHaveBeenCalled();
    expect(mockShowQuotaExhaustedToast).toHaveBeenCalledWith({
      featureId: EPrimeFeatures.DAppTranslate,
      resetAt: 1_793_491_200_000,
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
    expect(mockToastMessage).toHaveBeenCalledWith(
      expect.objectContaining({ toastId: 'discovery-free-trial-not-open' }),
    );
  });
});
