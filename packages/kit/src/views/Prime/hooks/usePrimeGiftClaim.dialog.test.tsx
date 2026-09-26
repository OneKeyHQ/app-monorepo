/** @jest-environment jsdom */

import { EDeviceType } from '@onekeyfe/hd-shared';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPrimeGiftPreparedRedemption } from '@onekeyhq/shared/types/prime/primeGiftTypes';
import type {
  IPrimeRedemptionParams,
  IPrimeRedemptionResult,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { usePrimeGiftClaim } from './usePrimeGiftClaim';

import type { readPrimeInfiniPaymentEntryGuard } from './primeInfiniExternalCheckoutGuard';

let mockUserId = 'user-a';
const mockMessage = (id: string) => id;
const mockPrimeGiftStage = jest.fn();
const mockPrimeRedemptionResult = jest.fn();
const mockReadGuard = jest.fn<
  ReturnType<typeof readPrimeInfiniPaymentEntryGuard>,
  []
>();
const mockRedeem = jest.fn<
  Promise<IPrimeRedemptionResult>,
  [IPrimeRedemptionParams]
>();

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimeGiftEligibilityPersistAtom: () => [{}],
}));

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
    user: { onekeyUserId: mockUserId, isLoggedIn: true },
    isLoggedIn: true,
    loginOneKeyId: jest.fn(),
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      apiGetPrimeGiftEligibility: jest.fn(),
      apiGetPrimeGiftUserId: jest.fn(),
      apiPreparePrimeGiftRedemption: jest.fn(),
      apiRedeemPrimeCode: (params: IPrimeRedemptionParams) =>
        mockRedeem(params),
      apiFetchPrimeUserInfo: jest.fn(async () => undefined),
    },
  },
}));

jest.mock('./primeInfiniExternalCheckoutGuard', () => ({
  readPrimeInfiniPaymentEntryGuard: () => mockReadGuard(),
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { isUserCancelStyleError: () => false },
}));

jest.mock('./usePrimeGiftMessages', () => ({
  usePrimeGiftMessages: () => mockMessage,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeGiftStage: (...args: unknown[]) => {
          mockPrimeGiftStage(...args);
        },
        primeRedemptionResult: (...args: unknown[]) => {
          mockPrimeRedemptionResult(...args);
        },
      },
    },
  },
}));

const servicePrime = jest.mocked(backgroundApiProxy.servicePrime);
const initialProps: Parameters<typeof usePrimeGiftClaim>[0] = {
  device: {
    connectId: 'connect-a',
    uuid: 'DEVICE-A',
    deviceId: 'device-a',
    serialNo: 'DEVICE-A',
    deviceType: EDeviceType.Pro,
    name: 'OneKey hardware wallet',
  },
  serialNo: 'DEVICE-A',
  source: 'deviceDetails',
};
const prepared: IPrimeGiftPreparedRedemption = {
  serialNo: 'DEVICE-A',
  onekeyUserId: 'user-a',
  code: 'TEST_DEVICE_CODE',
  verification: { hasCode: true, status: 'available' },
};
const redemption: IPrimeRedemptionResult = {
  addedDays: 180,
  finalExpiresAt: 1_900_000_000_000,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderClaim() {
  return renderHook(
    (props: Parameters<typeof usePrimeGiftClaim>[0]) =>
      usePrimeGiftClaim(props),
    { initialProps },
  );
}

async function verify(result: { current: { submit: () => Promise<void> } }) {
  await act(async () => {
    await result.current.submit();
  });
}

describe('Prime gift inline redemption', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = 'user-a';
    servicePrime.apiGetPrimeGiftEligibility.mockResolvedValue({
      sno: 'DEVICE-A',
      eligible: true,
      hasUnclaimedGift: true,
      giftDays: 180,
      giftMonths: 6,
    });
    servicePrime.apiGetPrimeGiftUserId.mockImplementation(
      async () => mockUserId,
    );
    servicePrime.apiPreparePrimeGiftRedemption.mockResolvedValue(prepared);
    mockReadGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: false,
      onekeyUserId: 'user-a',
      pendingSubscriptionPeriod: undefined,
    });
    mockRedeem.mockResolvedValue(redemption);
  });

  it('redeems once and ignores another click while the request is in flight', async () => {
    const pending = deferred<IPrimeRedemptionResult>();
    mockRedeem.mockReturnValue(pending.promise);
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    await verify(result);
    expect(result.current.code).toBe('TEST_DEVICE_CODE');
    expect(result.current.result).toBeUndefined();
    expect(mockRedeem).not.toHaveBeenCalled();
    let claims: Promise<void>[] = [];
    act(() => {
      claims = [result.current.claim(), result.current.claim()];
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRedeem).toHaveBeenCalledTimes(1);
    expect(mockRedeem).toHaveBeenCalledWith({
      code: 'TEST_DEVICE_CODE',
      expectedOneKeyUserId: 'user-a',
      primeGiftSerialNo: 'DEVICE-A',
    });
    await act(async () => {
      pending.resolve(redemption);
      await Promise.all(claims);
    });
    expect(result.current.result?.addedDays).toBe(180);
    expect(mockRedeem).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: 'a network failure',
      error: new Error('Network unavailable'),
      message: 'Network unavailable',
      failureResult: 'unknown',
    },
    {
      name: 'a subscription restriction',
      error: { code: 90_506, message: 'Subscription restriction' },
      message: 'Subscription restriction',
      failureResult: 'failed',
    },
  ])(
    'retries $name without verifying the device again',
    async ({ error, message, failureResult }) => {
      mockRedeem.mockRejectedValueOnce(error).mockResolvedValueOnce(redemption);
      const { result } = renderClaim();
      await waitFor(() => expect(result.current.isQuerying).toBe(false));
      await verify(result);
      await act(async () => {
        await result.current.claim();
      });
      expect(result.current.error).toBe(message);
      expect(result.current.code).toBe('TEST_DEVICE_CODE');
      await act(async () => {
        await result.current.claim();
      });
      expect(
        servicePrime.apiPreparePrimeGiftRedemption.mock.calls,
      ).toHaveLength(1);
      expect(mockRedeem).toHaveBeenCalledTimes(2);
      expect(result.current.result?.addedDays).toBe(180);
      expect(mockPrimeGiftStage).toHaveBeenCalledWith({
        source: 'deviceDetails',
        stage: 'claim',
        status: 'submit',
      });
      expect(mockPrimeRedemptionResult.mock.calls).toEqual([
        [
          expect.objectContaining({
            result: failureResult,
            source: 'deviceDetails',
            entry: 'primeGift',
          }),
        ],
        [
          expect.objectContaining({
            result: 'success',
            source: 'deviceDetails',
            entry: 'primeGift',
            addedDays: 180,
          }),
        ],
      ]);
    },
  );

  it('stops offering an already-used code after a 90502 rejection', async () => {
    const rejection = {
      code: 90_502,
      message: 'This redemption code has already been used. Try another code.',
      messageId: 'error__prime_redemption_code_already_redeemed',
    };
    mockRedeem.mockRejectedValue(rejection);
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    await verify(result);
    await act(async () => {
      await result.current.claim();
    });
    expect(result.current.error).toBe(rejection.message);
    expect(result.current.code).toBeUndefined();
    expect(result.current.verification).toEqual({
      hasCode: false,
      status: 'redeemed',
    });
    expect(result.current.result).toBeUndefined();
    expect(mockPrimeRedemptionResult).toHaveBeenLastCalledWith(
      expect.objectContaining({ result: 'failed', errorCode: 90_502 }),
    );
    await act(async () => {
      await result.current.refresh();
      await result.current.claim();
    });
    expect(result.current.code).toBeUndefined();
    expect(result.current.verification?.status).toBe('redeemed');
    expect(result.current.result).toBeUndefined();
    expect(mockRedeem).toHaveBeenCalledTimes(1);
  });

  it('requires confirmation before redeeming over a pending crypto payment', async () => {
    mockReadGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-a',
      pendingSubscriptionPeriod: undefined,
    });
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    await verify(result);
    await act(async () => {
      await result.current.claim();
    });
    expect(result.current.isPendingPaymentConfirm).toBe(true);
    expect(mockRedeem).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.claim();
    });
    expect(mockReadGuard).toHaveBeenCalledTimes(1);
    expect(mockRedeem).toHaveBeenCalledTimes(1);
    expect(result.current.isPendingPaymentConfirm).toBe(false);
    expect(result.current.result?.addedDays).toBe(180);
  });

  it('keeps payment confirmation across a refresh for the same server user', async () => {
    mockReadGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-a',
      pendingSubscriptionPeriod: undefined,
    });
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    await verify(result);
    await act(async () => {
      await result.current.claim();
    });
    expect(result.current.isPendingPaymentConfirm).toBe(true);
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.isPendingPaymentConfirm).toBe(true);
    expect(result.current.code).toBe('TEST_DEVICE_CODE');
    await act(async () => {
      await result.current.claim();
    });
    expect(mockReadGuard).toHaveBeenCalledTimes(1);
    expect(mockRedeem).toHaveBeenCalledTimes(1);
  });

  it('requires payment confirmation again after only the server user id changes', async () => {
    mockReadGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-a',
      pendingSubscriptionPeriod: undefined,
    });
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    await verify(result);
    await act(async () => {
      await result.current.claim();
    });
    expect(result.current.isPendingPaymentConfirm).toBe(true);
    expect(mockReadGuard).toHaveBeenCalledTimes(1);
    expect(mockRedeem).not.toHaveBeenCalled();

    servicePrime.apiGetPrimeGiftUserId.mockResolvedValue('user-b');
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.user?.onekeyUserId).toBe('user-a');
    expect(result.current.onekeyUserId).toBe('user-b');
    expect(result.current.isPendingPaymentConfirm).toBe(false);
    expect(result.current.code).toBeUndefined();

    await verify(result);
    mockReadGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-b',
      pendingSubscriptionPeriod: undefined,
    });
    await act(async () => {
      await result.current.claim();
    });
    expect(mockReadGuard).toHaveBeenCalledTimes(2);
    expect(mockRedeem).not.toHaveBeenCalled();
    expect(result.current.isPendingPaymentConfirm).toBe(true);
  });

  it.each([
    { name: 'the guard request fails', guard: undefined },
    {
      name: 'the OneKey ID session changes',
      guard: {
        isLoggedIn: true,
        hasPendingPayment: false,
        onekeyUserId: 'user-b',
        pendingSubscriptionPeriod: undefined,
      },
    },
  ])('blocks redemption when $name', async ({ guard }) => {
    mockReadGuard.mockResolvedValue(guard);
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    await verify(result);
    await act(async () => {
      await result.current.claim();
    });
    expect(result.current.error).toBe(
      ETranslations.global_unknown_error_retry_message,
    );
    expect(result.current.code).toBe('TEST_DEVICE_CODE');
    expect(mockRedeem).not.toHaveBeenCalled();
  });

  it('does not repeat an expired-session error inline and keeps the code', async () => {
    mockRedeem.mockRejectedValue({
      key: ETranslations.id_login_expired_description,
      message: 'session expired',
    });
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    await verify(result);
    await act(async () => {
      await result.current.claim();
    });
    expect(result.current.error).toBeUndefined();
    expect(result.current.code).toBe('TEST_DEVICE_CODE');
    expect(result.current.result).toBeUndefined();
  });

  it.each(['account', 'device', 'unmount'] as const)(
    'ignores a late claim success after %s changes',
    async (change) => {
      const pending = deferred<IPrimeRedemptionResult>();
      mockRedeem.mockReturnValue(pending.promise);
      const { result, rerender, unmount } = renderClaim();
      await waitFor(() => expect(result.current.isQuerying).toBe(false));
      await verify(result);
      let claimPromise: Promise<void> | undefined;
      act(() => {
        claimPromise = result.current.claim();
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockRedeem).toHaveBeenCalledTimes(1);
      if (change === 'account') {
        mockUserId = 'user-b';
        rerender(initialProps);
      } else if (change === 'device') {
        rerender({ ...initialProps, serialNo: 'DEVICE-B' });
      } else {
        unmount();
      }
      await act(async () => {
        pending.resolve(redemption);
        await claimPromise;
      });
      expect(result.current.result).toBeUndefined();
      if (change !== 'unmount') {
        await waitFor(() => expect(result.current.isQuerying).toBe(false));
        expect(result.current.code).toBeUndefined();
      }
    },
  );

  it.each([
    {
      name: 'the same server user',
      userId: 'user-a',
      keepsCode: true,
    },
    {
      name: 'a different server user',
      userId: 'user-b',
      keepsCode: false,
    },
  ])(
    'handles verification that resolves before refresh returns $name',
    async ({ userId, keepsCode }) => {
      const pendingVerify = deferred<IPrimeGiftPreparedRedemption>();
      const pendingUserId = deferred<string>();
      servicePrime.apiPreparePrimeGiftRedemption.mockReturnValueOnce(
        pendingVerify.promise,
      );
      const { result } = renderClaim();
      await waitFor(() => expect(result.current.isQuerying).toBe(false));
      servicePrime.apiGetPrimeGiftUserId.mockReturnValueOnce(
        pendingUserId.promise,
      );
      let verifyPromise: Promise<void> | undefined;
      let refreshPromise: Promise<void> | undefined;
      act(() => {
        verifyPromise = result.current.submit();
        refreshPromise = result.current.refresh();
      });
      await act(async () => {
        pendingVerify.resolve(prepared);
        await verifyPromise;
      });
      await act(async () => {
        pendingUserId.resolve(userId);
        await refreshPromise;
      });
      expect(result.current.onekeyUserId).toBe(userId);
      expect(result.current.code).toBe(
        keepsCode ? 'TEST_DEVICE_CODE' : undefined,
      );
      if (!keepsCode) expect(result.current.verification).toBeUndefined();
    },
  );

  it('ignores verification from the old server identity', async () => {
    const pending = deferred<IPrimeGiftPreparedRedemption>();
    servicePrime.apiPreparePrimeGiftRedemption.mockReturnValueOnce(
      pending.promise,
    );
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    let verifyPromise: Promise<void> | undefined;
    act(() => {
      verifyPromise = result.current.submit();
    });
    servicePrime.apiGetPrimeGiftUserId.mockResolvedValue('user-b');
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.onekeyUserId).toBe('user-b');
    await act(async () => {
      pending.resolve(prepared);
      await verifyPromise;
    });
    expect(result.current.onekeyUserId).toBe('user-b');
    expect(result.current.code).toBeUndefined();
    expect(result.current.verification).toBeUndefined();
  });

  it('does not reuse a delayed pending guard for a new server identity', async () => {
    const pending =
      deferred<Awaited<ReturnType<typeof readPrimeInfiniPaymentEntryGuard>>>();
    mockReadGuard.mockReturnValueOnce(pending.promise);
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    await verify(result);
    let claimPromise: Promise<void> | undefined;
    act(() => {
      claimPromise = result.current.claim();
    });
    servicePrime.apiGetPrimeGiftUserId.mockResolvedValue('user-b');
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.onekeyUserId).toBe('user-b');
    expect(result.current.isPendingPaymentConfirm).toBe(false);
    await act(async () => {
      pending.resolve({
        isLoggedIn: true,
        hasPendingPayment: true,
        onekeyUserId: 'user-a',
        pendingSubscriptionPeriod: undefined,
      });
      await claimPromise;
    });
    expect(result.current.isPendingPaymentConfirm).toBe(false);
    expect(mockRedeem).not.toHaveBeenCalled();
    servicePrime.apiPreparePrimeGiftRedemption.mockResolvedValue({
      ...prepared,
      onekeyUserId: 'user-b',
    });
    await verify(result);
    mockReadGuard.mockResolvedValue({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-b',
      pendingSubscriptionPeriod: undefined,
    });
    await act(async () => {
      await result.current.claim();
    });
    expect(mockReadGuard).toHaveBeenCalledTimes(2);
    expect(mockRedeem).not.toHaveBeenCalled();
    expect(result.current.isPendingPaymentConfirm).toBe(true);
  });

  it.each(['success', 'error'] as const)(
    'ignores a late claim %s after only the server user id changes',
    async (outcome) => {
      const pending = deferred<IPrimeRedemptionResult>();
      mockRedeem.mockReturnValue(
        outcome === 'error'
          ? pending.promise.then(() =>
              Promise.reject(new Error('Network unavailable')),
            )
          : pending.promise,
      );
      const { result } = renderClaim();
      await waitFor(() => expect(result.current.isQuerying).toBe(false));
      await verify(result);
      let claimPromise: Promise<void> | undefined;
      act(() => {
        claimPromise = result.current.claim();
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockRedeem).toHaveBeenCalledTimes(1);
      servicePrime.apiGetPrimeGiftUserId.mockResolvedValue('user-b');
      await act(async () => {
        await result.current.refresh();
      });
      expect(result.current.onekeyUserId).toBe('user-b');
      await act(async () => {
        pending.resolve(redemption);
        await claimPromise;
      });
      expect(result.current.onekeyUserId).toBe('user-b');
      expect(result.current.result).toBeUndefined();
      expect(result.current.error).toBeUndefined();
      expect(result.current.code).toBeUndefined();
    },
  );
});
