/** @jest-environment jsdom */

import { EDeviceType } from '@onekeyfe/hd-shared';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IPrimeGiftEligibilityCache } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import type {
  IPrimeGiftDevice,
  IPrimeGiftEligibility,
  IPrimeGiftPreparedRedemption,
} from '@onekeyhq/shared/types/prime/primeGiftTypes';

import { showPrimeRedemptionDialog } from '../pages/PrimeDashboard/PrimeRedemptionDialog';

import { usePrimeGiftClaim } from './usePrimeGiftClaim';

let mockLocalUserId: string | undefined = 'user-a';
let mockEligibilityCache: IPrimeGiftEligibilityCache = {};
let mockLocalIsLoggedIn = true;
let mockIsFocused = true;
let mockDialogExists = false;
const mockLogin = jest.fn<Promise<void>, []>();
const mockClose = jest.fn(async () => {
  mockDialogExists = false;
});
const mockMessage = (id: string) => id;

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

jest.mock('../pages/PrimeDashboard/PrimeRedemptionDialog', () => ({
  showPrimeRedemptionDialog: jest.fn(() => {
    mockDialogExists = true;
    return { isExist: () => mockDialogExists, close: mockClose };
  }),
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { isUserCancelStyleError: () => false },
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
const showDialog = jest.mocked(showPrimeRedemptionDialog);

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

const initialProps = { device: createDevice(), serialNo: 'DEVICE-A' };
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
    mockDialogExists = false;
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
    expect(showDialog).not.toHaveBeenCalled();
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
    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({ initialCode: 'SERVER_CODE' }),
    );
  });

  it.each(['available', 'processing', 'future-status'])(
    'opens redemption with a nonempty server code that is not redeemed for status=%s',
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
      expect(showDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          initialCode: 'SERVER_CODE',
          primeGiftSerialNo: 'DEVICE-A',
        }),
      );
      expect(result.current.deviceVerified).toBe(true);
      expect(result.current.verification?.hasCode).toBe(true);
      expect(result.current.result).toBeUndefined();
    },
  );

  it.each([undefined, '', '   '])(
    'stops without an error or a redemption dialog for an empty code: %j',
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
      expect(result.current.error).toBeUndefined();
      expect(result.current.isSubmitting).toBe(false);
      expect(showDialog).not.toHaveBeenCalled();
    },
  );

  it.each(['SERVER_CODE', undefined, '', '   '])(
    'rejects an already redeemed device before opening the dialog, with code=%j',
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
      expect(result.current.result).toBeUndefined();
      expect(showDialog).not.toHaveBeenCalled();
    },
  );

  it('re-verifies after a failed attempt and after closing the redemption dialog', async () => {
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
    expect(showDialog).toHaveBeenCalledTimes(1);
    await mockClose();
    await act(async () => {
      await result.current.submit();
    });
    expect(servicePrime.apiPreparePrimeGiftRedemption.mock.calls).toHaveLength(
      3,
    );
    expect(showDialog).toHaveBeenCalledTimes(2);
  });

  it('coalesces repeated clicks while verifying or while the redemption dialog is open', async () => {
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
        rerender({ device: createDevice('DEVICE-B'), serialNo: 'DEVICE-B' });
      await act(async () => {
        pending.resolve(prepared);
        await submission;
      });
      expect(showDialog).not.toHaveBeenCalled();
      expect(result.current.deviceVerified).toBe(false);
    },
  );

  it('does not restore success or device verification on a later page entry', async () => {
    const { result, rerender } = renderClaim();
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    await act(async () => {
      await result.current.submit();
    });
    act(() => {
      showDialog.mock.calls[0][0].onRedeemed?.({
        addedDays: 180,
        finalExpiresAt: 1_900_000_000_000,
      });
    });
    expect(result.current.result?.addedDays).toBe(180);
    mockIsFocused = false;
    rerender(initialProps);
    mockIsFocused = true;
    rerender(initialProps);
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    expect(result.current.result).toBeUndefined();
    expect(result.current.deviceVerified).toBe(false);
  });
});
