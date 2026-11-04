/** @jest-environment jsdom */

import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IPrimeGiftEligibilityCache } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import {
  OneKeyLocalError,
  PinCancelled,
  UserCancel,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type {
  IPrimeGiftDevice,
  IPrimeGiftEligibility,
  IPrimeGiftPreparedRedemption,
} from '@onekeyhq/shared/types/prime/primeGiftTypes';

import { usePrimeGiftClaim } from './usePrimeGiftClaim';

let mockLocalUserId: string | undefined = 'user-a';
let mockEligibilityCache: IPrimeGiftEligibilityCache = {};
let mockLocalIsLoggedIn = true;
let mockIsFocused = true;
const mockLogin = jest.fn<Promise<void>, []>();
const mockMessage = (id: string) => id;
const mockPrimeGiftStage = jest.fn();

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimeGiftEligibilityPersistAtom: () => [mockEligibilityCache],
}));

jest.mock('@react-navigation/core', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      const focused = mockIsFocused;
      React.useEffect(
        () => (focused ? effect() : undefined),
        [effect, focused],
      );
    },
  };
});

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    user: { onekeyUserId: mockLocalUserId, isLoggedIn: mockLocalIsLoggedIn },
    isLoggedIn: mockLocalIsLoggedIn,
    loginOneKeyId: mockLogin,
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      apiGetPrimeGiftEligibility: jest.fn(),
      apiGetPrimeGiftUserId: jest.fn(),
      apiPreparePrimeGiftRedemption: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => {
  const actual = jest.requireActual(
    '@onekeyhq/shared/src/errors/utils/errorToastUtils',
  ) as {
    default: { isUserCancelStyleError: (error: unknown) => boolean };
  };
  return {
    __esModule: true,
    default: {
      isUserCancelStyleError: actual.default.isUserCancelStyleError,
    },
  };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeGiftStage: (...args: unknown[]) => {
          mockPrimeGiftStage(...args);
        },
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    id_login_expired_description: 'login_expired',
    prime_gift_error__msg: 'Gift request failed',
    prime_gift_already_claimed__msg: 'This device has already claimed Prime',
  },
}));

jest.mock('./usePrimeGiftMessages', () => ({
  usePrimeGiftMessages: () => mockMessage,
}));

const servicePrime = jest.mocked(backgroundApiProxy.servicePrime);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createDevice(serialNo = 'DEVICE-A'): IPrimeGiftDevice {
  return {
    connectId: `connect-${serialNo}`,
    serialNo,
    uuid: serialNo,
    deviceId: `device-${serialNo}`,
    deviceType: EDeviceType.Pro,
    name: 'OneKey hardware wallet',
  };
}

const initialProps = {
  device: createDevice(),
  serialNo: 'DEVICE-A',
  source: 'onboarding' as const,
};
const prepared: IPrimeGiftPreparedRedemption = {
  serialNo: 'DEVICE-A',
  onekeyUserId: 'user-a',
  code: 'SERVER_CODE',
  verification: { hasCode: true, status: 'available' },
};
function renderClaim() {
  return renderHook(
    (props: Parameters<typeof usePrimeGiftClaim>[0]) =>
      usePrimeGiftClaim(props),
    { initialProps },
  );
}

describe('usePrimeGiftClaim', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalUserId = 'user-a';
    mockEligibilityCache = {};
    mockLocalIsLoggedIn = true;
    mockIsFocused = true;
    mockLogin.mockResolvedValue(undefined);
    servicePrime.apiGetPrimeGiftUserId.mockReset().mockResolvedValue('user-a');
    servicePrime.apiGetPrimeGiftEligibility.mockReset().mockResolvedValue({
      sno: 'DEVICE-A',
      eligible: true,
      hasUnclaimedGift: true,
      giftDays: 180,
      giftMonths: 6,
    });
    servicePrime.apiPreparePrimeGiftRedemption
      .mockReset()
      .mockResolvedValue(prepared);
  });

  it('uses cached gift duration while refreshing without treating cached eligibility as verification', async () => {
    const cached: IPrimeGiftEligibility = {
      sno: 'DEVICE-A',
      eligible: true,
      hasUnclaimedGift: true,
      giftDays: 45,
      giftMonths: 0,
    };
    mockEligibilityCache = { 'DEVICE-A': cached };
    const pending = deferred<IPrimeGiftEligibility>();
    servicePrime.apiGetPrimeGiftEligibility.mockReturnValue(pending.promise);
    const { result } = renderClaim();
    expect(result.current.eligibility).toBe(cached);
    expect(result.current.deviceVerified).toBe(false);
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    expect(result.current.eligibility).toBe(cached);
  });

  it('checks login only after user info returns a userId, even if the local atom is logged in', async () => {
    const pending = deferred<string | undefined>();
    servicePrime.apiGetPrimeGiftUserId.mockReturnValue(pending.promise);
    const { result } = renderClaim();
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.isQuerying).toBe(true);
    await act(async () => {
      pending.resolve('user-a');
      await pending.promise;
    });
    expect(result.current.isLoggedIn).toBe(true);
  });

  it.each([undefined, ''])(
    'keeps login unchecked when user info has no userId: %j',
    async (id) => {
      servicePrime.apiGetPrimeGiftUserId.mockResolvedValue(id);
      const { result } = renderClaim();
      await waitFor(() => expect(result.current.isQuerying).toBe(false));
      expect(result.current.isLoggedIn).toBe(false);
      await act(async () => {
        await result.current.submit();
      });
      expect(
        servicePrime.apiPreparePrimeGiftRedemption.mock.calls,
      ).toHaveLength(0);
    },
  );

  it('uses the server userId when the local atom has no userId', async () => {
    mockLocalUserId = undefined;
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    await act(async () => {
      await result.current.submit();
    });
    expect(
      servicePrime.apiPreparePrimeGiftRedemption.mock.calls,
    ).toContainEqual([
      expect.objectContaining({ expectedOneKeyUserId: 'user-a' }),
    ]);
  });

  it.each([undefined, 'cached-user'])(
    'silences automatic user info errors when logged out with local userId %j',
    async (userId) => {
      mockLocalUserId = userId;
      mockLocalIsLoggedIn = false;
      servicePrime.apiGetPrimeGiftUserId.mockRejectedValue(
        new Error('User authentication failed. Please log in again.'),
      );
      const { result } = renderClaim();
      await waitFor(() => expect(result.current.isQuerying).toBe(false));
      expect(servicePrime.apiGetPrimeGiftUserId.mock.calls).toHaveLength(1);
      expect(result.current.isLoggedIn).toBe(false);
      expect(result.current.error).toBeUndefined();
      expect(mockLogin).not.toHaveBeenCalled();
    },
  );

  it('shows errors from an explicit login attempt while logged out', async () => {
    mockLocalUserId = undefined;
    mockLocalIsLoggedIn = false;
    servicePrime.apiGetPrimeGiftUserId.mockResolvedValue(undefined);
    mockLogin.mockRejectedValue(new Error('Login failed'));
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    await act(async () => {
      await result.current.login();
    });
    expect(result.current.error).toBe('Login failed');
  });

  it('keeps login unchecked on info errors and rechecks after login', async () => {
    servicePrime.apiGetPrimeGiftUserId.mockRejectedValueOnce(
      new Error('Info unavailable'),
    );
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.error).toBe('Info unavailable');
    await act(async () => {
      await result.current.login();
    });
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(servicePrime.apiGetPrimeGiftUserId.mock.calls).toHaveLength(2);
    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.code).toBeUndefined();
  });

  it('requests user info again on each page focus and clears the previous check while waiting', async () => {
    const { result, rerender } = renderClaim();
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    mockIsFocused = false;
    rerender(initialProps);
    const pending = deferred<string | undefined>();
    servicePrime.apiGetPrimeGiftUserId.mockReturnValueOnce(pending.promise);
    mockIsFocused = true;
    rerender(initialProps);
    expect(result.current.isLoggedIn).toBe(false);
    expect(servicePrime.apiGetPrimeGiftUserId.mock.calls).toHaveLength(2);
    await act(async () => {
      pending.resolve(undefined);
      await pending.promise;
    });
    expect(result.current.isLoggedIn).toBe(false);
  });

  it('does not let an unavailable offer preview delay login or verification', async () => {
    servicePrime.apiGetPrimeGiftEligibility.mockReturnValue(
      deferred<never>().promise,
    );
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.code).toBe('SERVER_CODE');
    expect(result.current.result).toBeUndefined();
    expect(mockPrimeGiftStage.mock.calls).toEqual([
      [{ source: 'onboarding', stage: 'verify', status: 'start' }],
      [{ source: 'onboarding', stage: 'verify', status: 'success' }],
    ]);
  });

  it.each(['available', 'processing', 'future-status'])(
    'keeps a nonempty server code that is not redeemed for status=%s',
    async (status) => {
      servicePrime.apiPreparePrimeGiftRedemption.mockResolvedValue({
        ...prepared,
        verification: { hasCode: true, status },
      });
      const { result } = renderClaim();
      await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
      await act(async () => {
        await result.current.submit();
      });
      expect(result.current.code).toBe('SERVER_CODE');
      expect(result.current.deviceVerified).toBe(true);
      expect(result.current.verification?.hasCode).toBe(true);
      expect(result.current.result).toBeUndefined();
    },
  );

  it.each([undefined, '', '   '])(
    'stops without an error or a redemption code for an empty code: %j',
    async (code) => {
      servicePrime.apiPreparePrimeGiftRedemption.mockResolvedValue({
        ...prepared,
        code,
        verification: { hasCode: false, status: 'available' },
      });
      const { result } = renderClaim();
      await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
      await act(async () => {
        await result.current.submit();
      });
      expect(result.current.deviceVerified).toBe(true);
      expect(result.current.code).toBeUndefined();
      expect(result.current.error).toBeUndefined();
      expect(result.current.isSubmitting).toBe(false);
    },
  );

  it.each(['SERVER_CODE', undefined, '', '   '])(
    'rejects an already redeemed device without keeping its code, with code=%j',
    async (code) => {
      servicePrime.apiPreparePrimeGiftRedemption.mockResolvedValue({
        ...prepared,
        code,
        verification: { hasCode: Boolean(code?.trim()), status: 'redeemed' },
      });
      const { result } = renderClaim();
      await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
      await act(async () => {
        await result.current.submit();
      });
      expect(result.current.error).toBe(
        'This device has already claimed Prime',
      );
      expect(result.current.deviceVerified).toBe(true);
      expect(result.current.verification?.status).toBe('redeemed');
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.code).toBeUndefined();
      expect(result.current.result).toBeUndefined();
    },
  );

  it('shows the returned verify-failed message instead of a raw SDK diagnostic', async () => {
    servicePrime.apiPreparePrimeGiftRedemption.mockRejectedValueOnce(
      new OneKeyLocalError({
        message: ETranslations.prime_gift_verify_failed__msg,
        key: ETranslations.prime_gift_verify_failed__msg,
        autoToast: false,
      }),
    );
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.error).toBe(
      ETranslations.prime_gift_verify_failed__msg,
    );
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.code).toBeUndefined();
    expect(mockPrimeGiftStage.mock.calls).toEqual([
      [{ source: 'onboarding', stage: 'verify', status: 'start' }],
      [{ source: 'onboarding', stage: 'verify', status: 'failed' }],
    ]);
  });

  it('does not treat a plain Device cancelled Error as user cancellation', async () => {
    servicePrime.apiPreparePrimeGiftRedemption.mockRejectedValueOnce(
      new Error('Device cancelled'),
    );
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.error).toBe('Device cancelled');
    expect(mockPrimeGiftStage.mock.calls.at(-1)).toEqual([
      { source: 'onboarding', stage: 'verify', status: 'failed' },
    ]);
  });

  it.each([
    {
      name: 'converted ActionCancelled',
      error: convertDeviceError({ code: HardwareErrorCode.ActionCancelled }),
    },
    {
      name: 'UserCancel instance',
      error: new UserCancel(),
    },
    {
      name: 'PinCancelled instance',
      error: new PinCancelled(),
    },
    {
      name: 'serialized CallQueueActionCancelled',
      error: {
        className: EOneKeyErrorClassNames.OneKeyHardwareError,
        payload: { code: HardwareErrorCode.CallQueueActionCancelled },
      },
    },
    {
      name: 'serialized PinCancelled',
      error: {
        $isHardwareError: true,
        payload: { code: HardwareErrorCode.PinCancelled },
      },
    },
    {
      name: 'HardwareUserCancelFromOutside',
      error: {
        className: EOneKeyErrorClassNames.HardwareUserCancelFromOutside,
        message: 'Protocol V2 USB read failed: transferIn',
      },
    },
  ])(
    'does not surface a verify error for $name and keeps verify/cancel analytics',
    async ({ error }) => {
      servicePrime.apiPreparePrimeGiftRedemption.mockRejectedValueOnce(error);
      const { result } = renderClaim();
      await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
      await act(async () => {
        await result.current.submit();
      });
      expect(result.current.error).toBeUndefined();
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.code).toBeUndefined();
      expect(mockPrimeGiftStage.mock.calls).toEqual([
        [{ source: 'onboarding', stage: 'verify', status: 'start' }],
        [{ source: 'onboarding', stage: 'verify', status: 'cancel' }],
      ]);
    },
  );

  it.each([
    {
      name: 'hardware busy',
      message: 'Hardware is busy',
      key: ETranslations.feedback_hardware_is_busy,
    },
    {
      name: 'connect device',
      message: 'Connect the device to continue',
      key: ETranslations.prime_gift_connect_device__msg,
    },
  ])(
    'shows original $name preflight guidance without wrapping it as reconnect',
    async ({ message, key }) => {
      servicePrime.apiPreparePrimeGiftRedemption.mockRejectedValueOnce(
        new OneKeyLocalError({
          message,
          key,
          autoToast: false,
        }),
      );
      const { result } = renderClaim();
      await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
      await act(async () => {
        await result.current.submit();
      });
      expect(result.current.error).toBe(message);
      expect(result.current.error).not.toMatch(/reconnect/i);
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.code).toBeUndefined();
      expect(mockPrimeGiftStage.mock.calls.at(-1)).toEqual([
        { source: 'onboarding', stage: 'verify', status: 'failed' },
      ]);
    },
  );

  it('retries after hardware-busy preflight and then stores the redemption code', async () => {
    servicePrime.apiPreparePrimeGiftRedemption.mockRejectedValueOnce(
      new OneKeyLocalError({
        message: 'Hardware is busy',
        key: ETranslations.feedback_hardware_is_busy,
        autoToast: false,
      }),
    );
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.error).toBe('Hardware is busy');
    expect(result.current.code).toBeUndefined();
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.code).toBe('SERVER_CODE');
    expect(result.current.error).toBeUndefined();
  });

  it('retries after a device cancellation without a failed verify state', async () => {
    servicePrime.apiPreparePrimeGiftRedemption.mockRejectedValueOnce(
      convertDeviceError({ code: HardwareErrorCode.ActionCancelled }),
    );
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.error).toBeUndefined();
    expect(result.current.code).toBeUndefined();
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.code).toBe('SERVER_CODE');
    expect(result.current.error).toBeUndefined();
    expect(mockPrimeGiftStage.mock.calls).toEqual([
      [{ source: 'onboarding', stage: 'verify', status: 'start' }],
      [{ source: 'onboarding', stage: 'verify', status: 'cancel' }],
      [{ source: 'onboarding', stage: 'verify', status: 'start' }],
      [{ source: 'onboarding', stage: 'verify', status: 'success' }],
    ]);
  });

  it('retries verification after a failure and does not verify again once a code is stored', async () => {
    servicePrime.apiPreparePrimeGiftRedemption.mockRejectedValueOnce(
      new Error('Device unavailable'),
    );
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.error).toBe('Device unavailable');
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.code).toBe('SERVER_CODE');
    await act(async () => {
      await result.current.submit();
    });
    expect(servicePrime.apiPreparePrimeGiftRedemption.mock.calls).toHaveLength(
      2,
    );
  });

  it('coalesces repeated clicks while verifying or after a code is stored', async () => {
    const pending = deferred<IPrimeGiftPreparedRedemption>();
    servicePrime.apiPreparePrimeGiftRedemption.mockReturnValueOnce(
      pending.promise,
    );
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    let submissions: Promise<void>[] = [];
    act(() => {
      submissions = [result.current.submit(), result.current.submit()];
    });
    await act(async () => {
      pending.resolve(prepared);
      await Promise.all(submissions);
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(servicePrime.apiPreparePrimeGiftRedemption.mock.calls).toHaveLength(
      1,
    );
  });

  it.each(['account', 'device'] as const)(
    'ignores a stale verification response after %s changes',
    async (changed) => {
      const pending = deferred<IPrimeGiftPreparedRedemption>();
      servicePrime.apiPreparePrimeGiftRedemption.mockReturnValueOnce(
        pending.promise,
      );
      const { result, rerender } = renderClaim();
      await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
      let submission: Promise<void> | undefined;
      act(() => {
        submission = result.current.submit();
      });
      if (changed === 'account') {
        mockLocalUserId = 'user-b';
        rerender(initialProps);
      } else
        rerender({
          device: createDevice('DEVICE-B'),
          serialNo: 'DEVICE-B',
          source: 'onboarding',
        });
      await act(async () => {
        pending.resolve(prepared);
        await submission;
      });
      expect(result.current.code).toBeUndefined();
      expect(result.current.deviceVerified).toBe(false);
    },
  );

  it('keeps the redemption code across refocus for the same account', async () => {
    const { result, rerender } = renderClaim();
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.code).toBe('SERVER_CODE');
    mockIsFocused = false;
    rerender(initialProps);
    mockIsFocused = true;
    rerender(initialProps);
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    expect(result.current.code).toBe('SERVER_CODE');
    expect(result.current.deviceVerified).toBe(true);
    expect(servicePrime.apiPreparePrimeGiftRedemption.mock.calls).toHaveLength(
      1,
    );
  });

  it('drops the redemption code when refresh resolves a different user', async () => {
    const { result, rerender } = renderClaim();
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    await act(async () => {
      await result.current.submit();
    });
    servicePrime.apiGetPrimeGiftUserId.mockResolvedValue('user-b');
    mockIsFocused = false;
    rerender(initialProps);
    mockIsFocused = true;
    rerender(initialProps);
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    expect(result.current.code).toBeUndefined();
    expect(result.current.deviceVerified).toBe(false);
  });

  it('logs login success once when identity rerenders while login is pending', async () => {
    mockLocalIsLoggedIn = false;
    mockLocalUserId = undefined;
    const pending = deferred<void>();
    mockLogin.mockReturnValue(pending.promise);
    servicePrime.apiGetPrimeGiftUserId.mockResolvedValue(undefined);
    const { result, rerender } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    let loginPromise: Promise<void> | undefined;
    act(() => {
      loginPromise = result.current.login();
    });
    mockLocalIsLoggedIn = true;
    mockLocalUserId = 'user-a';
    rerender(initialProps);
    await act(async () => {
      pending.resolve();
      await loginPromise;
    });
    expect(mockPrimeGiftStage.mock.calls).toEqual([
      [{ source: 'onboarding', stage: 'login', status: 'start' }],
      [{ source: 'onboarding', stage: 'login', status: 'success' }],
    ]);
  });
});
