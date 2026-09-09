/** @jest-environment jsdom */

import { EDeviceType } from '@onekeyfe/hd-shared';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IPrimeGiftClaimProgress,
  IPrimeGiftClaimResult,
  IPrimeGiftDevice,
  IPrimeGiftEligibility,
} from '@onekeyhq/shared/types/prime/primeGiftTypes';

import { usePrimeGiftClaim } from './usePrimeGiftClaim';

let currentUserId: string | undefined = 'user-a';
const mockLogin = jest.fn<Promise<void>, []>();
const mockEmit = jest.fn<
  void,
  [event: string, payload: { serialNo: string }]
>();
const mockMessage = (id: string) => id;

jest.mock('@react-navigation/core', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(effect, [effect]);
    },
  };
});

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    user: currentUserId ? { onekeyUserId: currentUserId } : undefined,
    isLoggedIn: Boolean(currentUserId),
    loginOneKeyId: mockLogin,
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      apiGetPrimeGiftEligibility: jest.fn(),
      apiGetPrimeGiftClaimResult: jest.fn(),
      apiGetPrimeGiftClaimProgress: jest.fn(),
      apiCheckPrimeGiftAccountEligibility: jest.fn(),
      apiClaimPrimeGift: jest.fn(),
      apiFetchPrimeUserInfo: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: class OneKeyLocalError extends Error {},
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { isUserCancelStyleError: () => false },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { PrimeGiftRedeemed: 'PrimeGiftRedeemed' },
  appEventBus: {
    emit: (event: string, payload: { serialNo: string }) => {
      mockEmit(event, payload);
    },
  },
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: { id_login_expired_description: 'login_expired' },
  ETranslationsMock: {
    prime_gift_error: 'Gift request failed',
    prime_gift_session_changed: 'Receiving account changed',
  },
}));

jest.mock('./usePrimeGiftMessages', () => ({
  usePrimeGiftMessages: () => mockMessage,
}));

const servicePrime = jest.mocked(backgroundApiProxy.servicePrime);

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createDevice(serialNo = 'PRO2-A'): IPrimeGiftDevice {
  return {
    connectId: `connect-${serialNo}`,
    serialNo,
    uuid: serialNo,
    deviceId: `device-${serialNo}`,
    deviceType: EDeviceType.Pro2,
    name: 'OneKey Pro 2',
  };
}

const eligible: IPrimeGiftEligibility = {
  canClaim: true,
  status: 'eligible',
  giftMonths: 6,
};

function createClaimResult(
  serialNo = 'PRO2-A',
  onekeyUserId = 'user-a',
): IPrimeGiftClaimResult {
  return {
    serialNo,
    onekeyUserId,
    giftMonths: 6,
    addedDays: 180,
    finalExpiresAt: 1_900_000_000_000,
    email: `${onekeyUserId}@example.com`,
  };
}

const initialProps = { device: createDevice(), serialNo: 'PRO2-A' };

function renderClaim() {
  return renderHook(
    (props: Parameters<typeof usePrimeGiftClaim>[0]) =>
      usePrimeGiftClaim(props),
    { initialProps },
  );
}

describe('usePrimeGiftClaim', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    currentUserId = 'user-a';
    mockLogin.mockResolvedValue(undefined);
    servicePrime.apiGetPrimeGiftEligibility.mockResolvedValue(eligible);
    servicePrime.apiGetPrimeGiftClaimResult.mockResolvedValue(undefined);
    servicePrime.apiGetPrimeGiftClaimProgress.mockResolvedValue({
      deviceVerified: false,
    });
    servicePrime.apiCheckPrimeGiftAccountEligibility.mockResolvedValue({
      canClaim: true,
    });
    servicePrime.apiFetchPrimeUserInfo.mockRejectedValue(
      new Error('Profile refresh unavailable'),
    );
  });

  it('returns from login for account confirmation without automatically claiming', async () => {
    currentUserId = undefined;
    const pendingLogin = createDeferred<void>();
    mockLogin.mockReturnValue(pendingLogin.promise);
    const { result, rerender } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));

    let loginPromise: Promise<void> | undefined;
    act(() => {
      loginPromise = result.current.login();
    });
    currentUserId = 'user-a';
    rerender(initialProps);
    await act(async () => {
      pendingLogin.resolve(undefined);
      await loginPromise;
    });

    await waitFor(() => {
      expect(result.current.accountEligibility?.canClaim).toBe(true);
    });
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(servicePrime.apiClaimPrimeGift.mock.calls).toHaveLength(0);
  });

  it.each(['account', 'device'] as const)(
    'discards an in-flight claim result after the %s changes',
    async (changedContext) => {
      const pendingClaim = createDeferred<IPrimeGiftClaimResult>();
      servicePrime.apiClaimPrimeGift.mockReturnValue(pendingClaim.promise);
      const { result, rerender } = renderClaim();
      await waitFor(() => expect(result.current.isQuerying).toBe(false));

      let submitPromise: Promise<void> | undefined;
      act(() => {
        submitPromise = result.current.submit();
      });
      if (changedContext === 'account') {
        currentUserId = 'user-b';
        rerender(initialProps);
      } else {
        rerender({ device: createDevice('PRO2-B'), serialNo: 'PRO2-B' });
      }
      await act(async () => {
        pendingClaim.resolve(createClaimResult());
        await submitPromise;
      });

      await waitFor(() => expect(result.current.isQuerying).toBe(false));
      expect(result.current.result).toBeUndefined();
      expect(mockEmit).not.toHaveBeenCalled();
    },
  );

  it('coalesces rapid repeated submissions into one claim request', async () => {
    const pendingClaim = createDeferred<IPrimeGiftClaimResult>();
    servicePrime.apiClaimPrimeGift.mockReturnValue(pendingClaim.promise);
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));

    let submissions: Promise<void>[] = [];
    act(() => {
      submissions = [result.current.submit(), result.current.submit()];
    });
    expect(servicePrime.apiClaimPrimeGift.mock.calls).toHaveLength(1);
    await act(async () => {
      pendingClaim.resolve(createClaimResult());
      await Promise.all(submissions);
    });
    expect(servicePrime.apiClaimPrimeGift.mock.calls).toHaveLength(1);
  });

  it('restores completed verification for the confirmed receiving account', async () => {
    servicePrime.apiGetPrimeGiftClaimProgress.mockResolvedValue({
      deviceVerified: true,
    });
    const { result } = renderClaim();

    await waitFor(() => expect(result.current.isQuerying).toBe(false));

    expect(result.current.deviceVerified).toBe(true);
    expect(result.current.result).toBeUndefined();
    expect(result.current.accountEligibility?.canClaim).toBe(true);
    expect(servicePrime.apiGetPrimeGiftClaimProgress.mock.calls).toEqual([
      [{ serialNo: 'PRO2-A', expectedOneKeyUserId: 'user-a' }],
    ]);
    expect(servicePrime.apiClaimPrimeGift.mock.calls).toHaveLength(0);
  });

  it('clears completed verification immediately when the receiving account changes', async () => {
    const pendingProgress = createDeferred<IPrimeGiftClaimProgress>();
    servicePrime.apiGetPrimeGiftClaimProgress
      .mockResolvedValueOnce({ deviceVerified: true })
      .mockReturnValue(pendingProgress.promise);
    const { result, rerender } = renderClaim();
    await waitFor(() => expect(result.current.deviceVerified).toBe(true));

    currentUserId = 'user-b';
    rerender(initialProps);
    expect(result.current.deviceVerified).toBe(false);
    await act(async () => {
      pendingProgress.resolve({ deviceVerified: false });
      await pendingProgress.promise;
    });

    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    expect(result.current.deviceVerified).toBe(false);
    expect(servicePrime.apiGetPrimeGiftClaimProgress.mock.calls).toContainEqual(
      [{ serialNo: 'PRO2-A', expectedOneKeyUserId: 'user-b' }],
    );
    expect(servicePrime.apiClaimPrimeGift.mock.calls).toHaveLength(0);
  });

  it('recovers a failed request only from a matching confirmed claim record', async () => {
    const confirmed = createClaimResult();
    servicePrime.apiClaimPrimeGift.mockRejectedValue(
      new Error('Network timeout'),
    );
    servicePrime.apiGetPrimeGiftClaimResult
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue(confirmed);
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));

    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => expect(result.current.result).toEqual(confirmed));
    expect(result.current.error).toBeUndefined();
    expect(servicePrime.apiGetPrimeGiftClaimResult.mock.calls).toContainEqual([
      { serialNo: 'PRO2-A', expectedOneKeyUserId: 'user-a' },
    ]);
    expect(mockEmit).toHaveBeenCalledWith('PrimeGiftRedeemed', {
      serialNo: 'PRO2-A',
    });
  });

  it('keeps an unknown failed claim as retryable without fabricating success', async () => {
    const pendingClaim = createDeferred<IPrimeGiftClaimResult>();
    servicePrime.apiClaimPrimeGift.mockReturnValue(pendingClaim.promise);
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));

    let submitPromise: Promise<void> | undefined;
    act(() => {
      submitPromise = result.current.submit();
    });
    expect(result.current.isSubmitting).toBe(true);
    await act(async () => {
      pendingClaim.reject(new Error('Network timeout'));
      await submitPromise;
    });

    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    expect(result.current.result).toBeUndefined();
    expect(result.current.error).toBe('Network timeout');
    expect(mockEmit).not.toHaveBeenCalled();
    expect(servicePrime.apiClaimPrimeGift.mock.calls).toHaveLength(1);
  });

  it('rejects a recovery record for a different receiving account', async () => {
    servicePrime.apiClaimPrimeGift.mockRejectedValue(
      new Error('Network timeout'),
    );
    servicePrime.apiGetPrimeGiftClaimResult
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue(createClaimResult('PRO2-A', 'user-b'));
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));

    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    expect(result.current.result).toBeUndefined();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('rejects another account receipt returned by the initial refresh', async () => {
    servicePrime.apiGetPrimeGiftClaimResult.mockResolvedValue(
      createClaimResult('PRO2-A', 'user-b'),
    );
    const { result } = renderClaim();

    await waitFor(() => expect(result.current.isQuerying).toBe(false));

    expect(result.current.result).toBeUndefined();
    expect(result.current.error).toBe('Receiving account changed');
    expect(servicePrime.apiClaimPrimeGift.mock.calls).toHaveLength(0);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('preserves confirmed success if subsequent eligibility or profile refresh fails', async () => {
    const confirmed = createClaimResult();
    const pendingClaim = createDeferred<IPrimeGiftClaimResult>();
    servicePrime.apiClaimPrimeGift.mockReturnValue(pendingClaim.promise);
    servicePrime.apiGetPrimeGiftEligibility
      .mockResolvedValueOnce(eligible)
      .mockRejectedValue(new Error('Eligibility refresh unavailable'));
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));

    let submitPromise: Promise<void> | undefined;
    act(() => {
      submitPromise = result.current.submit();
    });
    expect(result.current.isSubmitting).toBe(true);
    await act(async () => {
      pendingClaim.resolve(confirmed);
      await submitPromise;
    });

    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    expect(result.current.result).toEqual(confirmed);
    expect(result.current.error).toBeUndefined();
    expect(mockEmit).toHaveBeenCalledTimes(1);
  });
});
