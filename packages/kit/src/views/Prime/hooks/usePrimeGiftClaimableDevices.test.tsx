/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';
import type { IPrimeGiftEligibility } from '@onekeyhq/shared/types/prime/primeGiftTypes';

import { usePrimeGiftClaimableDevices } from './usePrimeGiftClaimableDevices';

const mockWallets = jest.fn<
  Promise<Record<string, IHwQrWalletWithDevice>>,
  []
>();
const mockEligibility = jest.fn<
  Promise<IPrimeGiftEligibility>,
  [{ serialNo: string }]
>();

jest.mock('@react-navigation/core', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) =>
      React.useEffect(effect, [effect]),
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getAllHwQrWalletWithDevice: () => mockWallets() },
    servicePrime: {
      apiGetPrimeGiftEligibility: async (params: { serialNo: string }) => {
        const value = await mockEligibility(params);
        return value;
      },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: {
    getDeviceSerialNoFromDbDevice: (device: IDBDevice) => device.uuid,
    isSamePhysicalDevice: (left?: IDBDevice, right?: IDBDevice) =>
      Boolean(left && right && left.uuid === right.uuid),
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { PrimeGiftRedeemed: 'PrimeGiftRedeemed' },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));

function wallet(serial: string): IHwQrWalletWithDevice {
  return {
    wallet: { id: serial, name: serial } as IDBWallet,
    device: { uuid: serial, deviceType: 'pro2', createdAt: 1 } as IDBDevice,
  };
}
const eligible: IPrimeGiftEligibility = {
  sno: 'A',
  eligible: true,
  hasUnclaimedGift: true,
  giftDays: 180,
  giftMonths: 6,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWallets.mockResolvedValue({ A: wallet('A') });
  mockEligibility.mockResolvedValue(eligible);
});

it('waits for eligibility instead of reporting an empty result while the request is pending', async () => {
  let resolveEligibility: (value: IPrimeGiftEligibility) => void = () =>
    undefined;
  mockEligibility.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveEligibility = resolve;
      }),
  );
  const { result } = renderHook(() => usePrimeGiftClaimableDevices());
  await waitFor(() => expect(mockEligibility).toHaveBeenCalledTimes(1));
  expect(result.current.isLoading).toBe(true);
  expect(result.current.devices).toBeUndefined();
  await act(async () => {
    resolveEligibility(eligible);
  });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.hasError).toBe(false);
  expect(result.current.devices?.map((item) => item.serialNo)).toEqual(['A']);
});

it('reports a failed refresh and retries without retaining the previous positive result', async () => {
  const { result } = renderHook(() => usePrimeGiftClaimableDevices());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.devices).toHaveLength(1);
  mockEligibility.mockRejectedValueOnce(new OneKeyLocalError('offline'));
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.hasError).toBe(true);
  expect(result.current.devices).toEqual([]);
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.hasError).toBe(false);
  expect(result.current.devices).toHaveLength(1);
});

it('clears the previous devices while a refresh is pending', async () => {
  const { result } = renderHook(() => usePrimeGiftClaimableDevices());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.devices).toHaveLength(1);

  let completeRefresh: (value: IPrimeGiftEligibility) => void = () => undefined;
  mockEligibility.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        completeRefresh = resolve;
      }),
  );
  let refreshing: Promise<unknown> = Promise.resolve();
  act(() => {
    refreshing = result.current.refresh();
  });
  await waitFor(() => expect(mockEligibility).toHaveBeenCalledTimes(2));
  expect(result.current.isLoading).toBe(true);
  expect(result.current.devices).toBeUndefined();

  await act(async () => {
    completeRefresh({ ...eligible, hasUnclaimedGift: false });
    await refreshing;
  });
  expect(result.current.isLoading).toBe(false);
  expect(result.current.devices).toEqual([]);
});

it('publishes a claimable device while another eligibility request is pending', async () => {
  mockWallets.mockResolvedValue({ A: wallet('A'), B: wallet('B') });
  let completeSlow: (value: IPrimeGiftEligibility) => void = () => undefined;
  mockEligibility.mockImplementation(({ serialNo }) =>
    serialNo === 'B'
      ? new Promise((resolve) => {
          completeSlow = resolve;
        })
      : Promise.resolve(eligible),
  );
  const { result } = renderHook(() => usePrimeGiftClaimableDevices());
  await waitFor(() =>
    expect(result.current.devices?.map((item) => item.serialNo)).toEqual(['A']),
  );
  expect(result.current.isLoading).toBe(true);

  await act(async () => {
    completeSlow({ ...eligible, sno: 'B' });
  });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.devices?.map((item) => item.serialNo)).toEqual([
    'A',
    'B',
  ]);
  expect(result.current.hasError).toBe(false);
});

it('keeps successful devices when another check fails and reports the partial failure', async () => {
  mockWallets.mockResolvedValue({ A: wallet('A'), B: wallet('B') });
  mockEligibility.mockImplementation(async ({ serialNo }) => {
    if (serialNo === 'B') throw new OneKeyLocalError('offline');
    return eligible;
  });
  const { result } = renderHook(() => usePrimeGiftClaimableDevices());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.hasError).toBe(true);
  expect(result.current.devices?.map((item) => item.serialNo)).toEqual(['A']);
});

it('distinguishes no saved devices and a device-list read failure', async () => {
  mockWallets.mockResolvedValueOnce({});
  const { result } = renderHook(() => usePrimeGiftClaimableDevices());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.devices).toEqual([]);
  expect(result.current.hasError).toBe(false);
  mockWallets.mockRejectedValueOnce(new OneKeyLocalError('unavailable'));
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.hasError).toBe(true);
});

it('does not query automatically or manually when the feature is disabled', async () => {
  const { result } = renderHook(() =>
    usePrimeGiftClaimableDevices({ enabled: false }),
  );
  await act(async () => {
    expect(await result.current.refresh()).toBeUndefined();
  });
  expect(mockWallets).not.toHaveBeenCalled();
  expect(mockEligibility).not.toHaveBeenCalled();
});

it('ignores an older response after a newer check has completed', async () => {
  let completeOld: (value: IPrimeGiftEligibility) => void = () => undefined;
  mockEligibility.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        completeOld = resolve;
      }),
  );
  const { result } = renderHook(() => usePrimeGiftClaimableDevices());
  await waitFor(() => expect(mockEligibility).toHaveBeenCalledTimes(1));
  mockEligibility.mockResolvedValueOnce({
    ...eligible,
    hasUnclaimedGift: false,
  });
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.devices).toEqual([]);
  await act(async () => {
    completeOld(eligible);
  });
  expect(result.current.devices).toEqual([]);
  expect(result.current.hasError).toBe(false);
});
