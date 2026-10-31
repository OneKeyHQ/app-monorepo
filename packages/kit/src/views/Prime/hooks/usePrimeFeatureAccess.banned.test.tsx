/** @jest-environment jsdom */

import { act, render, renderHook } from '@testing-library/react';

import { ErrorToastContainer } from '@onekeyhq/kit/src/provider/Container/ErrorToastContainer/ErrorToastContainer';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { primeUserBannedMessage } from '@onekeyhq/shared/src/prime/primeUserBanned';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import { usePrimeFeatureAccess } from './usePrimeFeatureAccess';

const mockToastError = jest.fn<void, unknown[]>();
const mockToastMessage = jest.fn<void, unknown[]>();
const mockDashboard = jest.fn();
const mockLogin = jest.fn();
const mockTrialAttempt = jest.fn();
const mockTrialResult = jest.fn();
const mockServicePrime = {
  isLoggedIn: jest.fn(async () => true),
  isPrimeSubscriptionActive: jest.fn(async () => false),
};
const mockServiceFreeTrial = {
  getPublicConfig: jest.fn(),
  refreshQuota: jest.fn(),
  savePendingAction: jest.fn(),
};
let mockUser = { onekeyUserId: 'banned-user', isOneKeyIdBanned: true };
let mockPrime = false;
let mockNow = Date.now();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      isLoggedIn: () => mockServicePrime.isLoggedIn(),
      isPrimeSubscriptionActive: () =>
        mockServicePrime.isPrimeSubscriptionActive(),
    },
    servicePrimeFreeTrial: {
      getPublicConfig: (...args: unknown[]) =>
        mockServiceFreeTrial.getPublicConfig(...args) as unknown,
      refreshQuota: (...args: unknown[]) =>
        mockServiceFreeTrial.refreshQuota(...args) as unknown,
      savePendingAction: (...args: unknown[]) =>
        mockServiceFreeTrial.savePendingAction(...args) as unknown,
    },
  },
}));
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    user: mockUser,
    isLoggedIn: true,
    isPrimeSubscriptionActive: mockPrime,
    loginOneKeyId: mockLogin,
  }),
}));
jest.mock(
  '@onekeyhq/kit/src/components/OneKeyAuth/extOneKeyIdAuthExpandTab',
  () => ({
    shouldRunOneKeyIdAuthInExtExpandTab: () => true,
  }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimeFreeTrialAtom: () => [
    { config: { status: 'idle' }, quota: { status: 'idle' } },
  ],
}));
jest.mock('./usePrimeFreeTrialUpgrade', () => ({
  usePrimeFreeTrialUpgrade: () => ({
    openPrimeDashboard: mockDashboard,
    getPrime: jest.fn(),
  }),
}));
jest.mock('@onekeyhq/components', () => ({
  Button: () => null,
  Dialog: { loading: jest.fn() },
  Toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    message: (...args: unknown[]) => mockToastMessage(...args),
  },
  globalNetInfo: { currentState: () => ({ isInternetReachable: true }) },
}));
jest.mock(
  '@onekeyhq/kit/src/provider/Container/ErrorToastContainer/ErrorToasts',
  () => ({
    getErrorAction: () => undefined,
  }),
);
jest.mock(
  '@onekeyhq/shared/src/storage/nativeStorageContractViolationSubscription',
  () => ({
    subscribeNativeStorageContractViolations: () => () => undefined,
  }),
);
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({ profile: { kind: 'standard' } }),
  },
}));
jest.mock('react-intl', () => {
  const actual = jest.requireActual<typeof import('react-intl')>('react-intl');
  const intl = actual.createIntl({
    locale: 'en',
    messages: jest.requireActual('@onekeyhq/shared/src/locale/json/en_US.json'),
  });
  return { ...actual, useIntl: () => intl };
});
jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: (_target, key) => {
      if (key === 'primeFreeTrialAttempt') return mockTrialAttempt;
      if (key === 'primeFreeTrialResult') return mockTrialResult;
      return noopLogger;
    },
  });
  return { defaultLogger: noopLogger };
});

const FEATURES = [
  EPrimeFeatures.BulkSend,
  EPrimeFeatures.BulkCopyAddresses,
  EPrimeFeatures.BulkRevoke,
  EPrimeFeatures.AddressRiskCheck,
] as const;

describe('Prime entry ban feedback through the real toast pipeline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Keep the real error-code deduplication clock monotonic across cases.
    mockNow += 60_000;
    jest.setSystemTime(mockNow);
    jest.clearAllMocks();
    mockUser = { onekeyUserId: 'banned-user', isOneKeyIdBanned: true };
    mockPrime = false;
    render(<ErrorToastContainer />);
  });
  afterEach(() => jest.useRealTimers());

  it.each(
    FEATURES.flatMap((featureId) =>
      [false, true].map((prime) => ({ featureId, prime })),
    ),
  )(
    'returns a visible denial before any feature side effect: %j',
    async ({ featureId, prime }) => {
      mockPrime = prime;
      const { result } = renderHook(() => usePrimeFeatureAccess());
      const onDenied = jest.fn();
      await act(async () => {
        await expect(
          result.current.ensureFeatureAccess({
            featureId,
            onDenied,
            loginOnly: featureId === EPrimeFeatures.AddressRiskCheck,
            extPopup: { mode: 'passThrough' },
          }),
        ).resolves.toEqual({ granted: false });
      });
      expect(onDenied).toHaveBeenCalledWith('banned');
      expect(mockToastError).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({
          title: primeUserBannedMessage.defaultMessage,
          toastId: '90012',
        }),
      );
      for (const fn of Object.values(mockServicePrime))
        expect(fn).not.toHaveBeenCalled();
      for (const fn of Object.values(mockServiceFreeTrial))
        expect(fn).not.toHaveBeenCalled();
      expect(mockLogin).not.toHaveBeenCalled();
      expect(mockDashboard).not.toHaveBeenCalled();
      expect(mockToastMessage).not.toHaveBeenCalled();
      if (prime) expect(mockTrialResult).not.toHaveBeenCalled();
      else
        expect(mockTrialResult.mock.calls).toEqual([
          [
            expect.objectContaining({
              stage: 'access',
              result: 'failed',
              source: 'client',
            }),
          ],
        ]);
    },
  );

  it('deduplicates concurrent and repeated presses across hook instances, then permits later feedback', async () => {
    const first = renderHook(() => usePrimeFeatureAccess()).result;
    const second = renderHook(() => usePrimeFeatureAccess()).result;
    await act(async () => {
      await expect(
        Promise.all([
          first.current.ensureFeatureAccess({ featureId: FEATURES[0] }),
          second.current.ensureFeatureAccess({ featureId: FEATURES[1] }),
          first.current.ensureFeatureAccess({ featureId: FEATURES[2] }),
        ]),
      ).resolves.toEqual([
        { granted: false },
        { granted: false },
        { granted: false },
      ]);
      await expect(
        second.current.ensureFeatureAccess({ featureId: FEATURES[3] }),
      ).resolves.toEqual({ granted: false });
    });
    expect(mockToastError).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(6000);
      await expect(
        first.current.ensureFeatureAccess({ featureId: FEATURES[0] }),
      ).resolves.toEqual({ granted: false });
    });
    expect(mockToastError).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])(
    'deduplicates a serialized API ban and the local denial (API first: %s)',
    async (apiFirst) => {
      const { result } = renderHook(() => usePrimeFeatureAccess());
      const apiError = {
        code: 90_012,
        autoToast: true,
        message: primeUserBannedMessage.defaultMessage,
      };
      await act(async () => {
        if (apiFirst) errorToastUtils.showToastOfError(apiError);
        await expect(
          result.current.ensureFeatureAccess({ featureId: FEATURES[0] }),
        ).resolves.toEqual({ granted: false });
        if (!apiFirst) errorToastUtils.showToastOfError(apiError);
      });
      expect(mockToastError).toHaveBeenCalledTimes(1);
    },
  );

  it('waits for the denial continuation before displaying feedback and settles externally tracked attempts', async () => {
    const { result } = renderHook(() => usePrimeFeatureAccess());
    let finishExit!: () => void;
    const exit = new Promise<void>((resolve) => {
      finishExit = resolve;
    });
    const onDenied = jest.fn(() => exit);
    const onAttemptDenied = jest.fn();
    let access:
      | ReturnType<typeof result.current.ensureFeatureAccess>
      | undefined;
    await act(async () => {
      access = result.current.ensureFeatureAccess({
        featureId: FEATURES[0],
        trackAttempt: false,
        onDenied,
        onAttemptDenied,
      });
      await Promise.resolve();
    });
    expect(onDenied).toHaveBeenCalledWith('banned');
    expect(onAttemptDenied).toHaveBeenCalledWith('banned');
    expect(mockToastError).not.toHaveBeenCalled();
    await act(async () => {
      finishExit();
      await expect(access).resolves.toEqual({ granted: false });
    });
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockTrialAttempt).not.toHaveBeenCalled();
  });

  it('drops feedback when the calling page or wallet context has gone', async () => {
    const { result } = renderHook(() => usePrimeFeatureAccess());
    const onDenied = jest.fn();
    await act(async () => {
      await expect(
        result.current.ensureFeatureAccess({
          featureId: FEATURES[0],
          isContextValid: () => false,
          onDenied,
        }),
      ).resolves.toEqual({ granted: false });
    });
    expect(onDenied).toHaveBeenCalledWith('contextChanged');
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockTrialResult).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'contextChanged' }),
    );
  });

  it.each([false, true])(
    'does not show the old account ban after a delayed page exit switches identity (next banned: %s)',
    async (nextBanned) => {
      const { result, rerender } = renderHook(() => usePrimeFeatureAccess());
      let finishExit!: () => void;
      const exit = new Promise<void>((resolve) => {
        finishExit = resolve;
      });
      let access:
        | ReturnType<typeof result.current.ensureFeatureAccess>
        | undefined;
      await act(async () => {
        access = result.current.ensureFeatureAccess({
          featureId: FEATURES[0],
          onDenied: () => exit,
        });
        await Promise.resolve();
      });
      mockUser = { onekeyUserId: 'another-user', isOneKeyIdBanned: nextBanned };
      rerender();
      await act(async () => {
        finishExit();
        await expect(access).resolves.toEqual({ granted: false });
      });
      expect(mockToastError).not.toHaveBeenCalled();
    },
  );

  it.each(
    FEATURES.flatMap((featureId) =>
      [false, true].map((prime) => ({ featureId, prime })),
    ),
  )(
    'preserves normal paid/free-trial grants after switching away from the banned account: %j',
    async ({ featureId, prime }) => {
      mockPrime = prime;
      const { result, rerender } = renderHook(() => usePrimeFeatureAccess());
      await act(async () => {
        await expect(
          result.current.ensureFeatureAccess({ featureId }),
        ).resolves.toEqual({ granted: false });
      });
      mockUser = { onekeyUserId: 'normal-user', isOneKeyIdBanned: false };
      rerender();
      mockToastError.mockClear();
      await act(async () => {
        await expect(
          result.current.ensureFeatureAccess({ featureId }),
        ).resolves.toEqual({
          granted: true,
          entitlementSource: prime ? 'prime' : 'freeTrial',
        });
      });
      expect(mockToastError).not.toHaveBeenCalled();
      expect(mockDashboard).not.toHaveBeenCalled();
    },
  );
});
