/** @jest-environment jsdom */

import { EDeviceType } from '@onekeyfe/hd-shared';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IPrimeGiftPreparedRedemption } from '@onekeyhq/shared/types/prime/primeGiftTypes';

import { showPrimeRedemptionDialog } from '../pages/PrimeDashboard/PrimeRedemptionDialog';

import { usePrimeGiftClaim } from './usePrimeGiftClaim';

let mockUserId = 'user-a';
let mockDialogOpen = false;
const mockClose = jest.fn(async () => {
  mockDialogOpen = false;
});
const mockMessage = (id: string) => id;

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
    },
  },
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { isUserCancelStyleError: () => false },
}));

jest.mock('./usePrimeGiftMessages', () => ({
  usePrimeGiftMessages: () => mockMessage,
}));

jest.mock('../pages/PrimeDashboard/PrimeRedemptionDialog', () => ({
  showPrimeRedemptionDialog: jest.fn(),
}));

const servicePrime = jest.mocked(backgroundApiProxy.servicePrime);
const showDialog = jest.mocked(showPrimeRedemptionDialog);
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
};
const prepared: IPrimeGiftPreparedRedemption = {
  serialNo: 'DEVICE-A',
  onekeyUserId: 'user-a',
  code: 'TEST_DEVICE_CODE',
  verification: { hasCode: true, status: 'available' },
};

function renderClaim() {
  return renderHook(
    (props: Parameters<typeof usePrimeGiftClaim>[0]) =>
      usePrimeGiftClaim(props),
    { initialProps },
  );
}

describe('Prime gift redemption dialog lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = 'user-a';
    mockDialogOpen = false;
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
    showDialog.mockImplementation(() => {
      mockDialogOpen = true;
      return {
        close: mockClose,
        getForm: () => undefined,
        isExist: () => mockDialogOpen,
      };
    });
  });

  it('passes a fresh code on reopening and prevents another verification while the dialog is open', async () => {
    const { result } = renderClaim();
    await waitFor(() => expect(result.current.isQuerying).toBe(false));
    await act(async () => {
      await result.current.submit();
    });
    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        initialCode: 'TEST_DEVICE_CODE',
        expectedOneKeyUserId: 'user-a',
        primeGiftSerialNo: 'DEVICE-A',
      }),
    );
    expect(result.current.result).toBeUndefined();

    await act(async () => {
      await result.current.submit();
    });
    expect(servicePrime.apiPreparePrimeGiftRedemption.mock.calls).toHaveLength(
      1,
    );

    await mockClose();
    servicePrime.apiPreparePrimeGiftRedemption.mockResolvedValue({
      ...prepared,
      code: 'TEST_NEW_CODE',
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(servicePrime.apiPreparePrimeGiftRedemption.mock.calls).toHaveLength(
      2,
    );
    expect(showDialog.mock.calls.at(-1)?.[0].initialCode).toBe('TEST_NEW_CODE');
  });

  it.each(['account', 'device', 'unmount'] as const)(
    'closes the dialog and ignores its late success after %s changes',
    async (change) => {
      const { result, rerender, unmount } = renderClaim();
      await waitFor(() => expect(result.current.isQuerying).toBe(false));
      await act(async () => {
        await result.current.submit();
      });
      const onRedeemed = showDialog.mock.calls.at(-1)?.[0].onRedeemed;
      if (change === 'account') {
        mockUserId = 'user-b';
        rerender(initialProps);
      } else if (change === 'device') {
        rerender({ ...initialProps, serialNo: 'DEVICE-B' });
      } else {
        unmount();
      }
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(mockDialogOpen).toBe(false);
      await act(async () => {
        onRedeemed?.({ addedDays: 180, finalExpiresAt: 1_900_000_000_000 });
      });
      expect(result.current.result).toBeUndefined();
    },
  );
});
