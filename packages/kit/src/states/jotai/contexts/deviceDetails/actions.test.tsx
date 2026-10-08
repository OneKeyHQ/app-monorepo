/** @jest-environment jsdom */

import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';
import { act, renderHook } from '@testing-library/react';

import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

import { useDeviceDetailsActions } from './actions';
import {
  ProviderJotaiContextDeviceDetails,
  emptyMetaState,
  emptyMetaStatic,
  useDeviceMetaStateAtom,
  useDeviceMetaStaticAtom,
  useRefreshSettledAtom,
} from './atoms';

import type { IDeviceStateSnapshot } from './deviceStateManagement';

const mockGetAllWallets = jest.fn<Promise<unknown>, unknown[]>();
const mockSetLanguage = jest.fn<Promise<void>, unknown[]>();
const mockGetSnapshot = jest.fn<
  Promise<IDeviceStateSnapshot | undefined>,
  unknown[]
>();

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAllHwQrWalletWithDevice: (...args: unknown[]) =>
        mockGetAllWallets(...args),
    },
    serviceHardware: {
      setLanguage: (...args: unknown[]) => mockSetLanguage(...args),
      getDeviceManagementSnapshot: (...args: unknown[]) =>
        mockGetSnapshot(...args),
    },
  },
}));

describe('device details reached through a deprecated wallet', () => {
  const oldWallet = {
    wallet: { id: 'hw-old', deprecated: true },
    device: {
      id: 'db-old',
      uuid: 'SERIAL',
      deviceId: 'old-seed',
      connectId: '',
    },
  } as IHwQrWalletWithDevice;
  const currentWallet = {
    wallet: { id: 'hw-current', deprecated: false },
    device: {
      id: 'db-current',
      uuid: 'SERIAL',
      deviceId: 'new-seed',
      connectId: 'BLE-ID',
    },
  } as IHwQrWalletWithDevice;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    mockGetAllWallets.mockResolvedValue({
      [oldWallet.wallet.id]: oldWallet,
      [currentWallet.wallet.id]: currentWallet,
    });
    mockGetSnapshot.mockResolvedValue(undefined);
  });

  it.each(['older-first', 'newer-first'])(
    'only lets the latest refresh update the wallet and finish loading (%s)',
    async (completionOrder) => {
      const olderRead = createDeferred<unknown>();
      const newerRead = createDeferred<unknown>();
      mockGetAllWallets
        .mockReturnValueOnce(olderRead.promise)
        .mockReturnValueOnce(newerRead.promise);
      const { result } = renderHook(
        () => ({
          actions: useDeviceDetailsActions(),
          settled: useRefreshSettledAtom(),
        }),
        { wrapper: ProviderJotaiContextDeviceDetails },
      );
      let olderRefresh: Promise<unknown> | undefined;
      let newerRefresh: Promise<unknown> | undefined;
      await act(async () => {
        olderRefresh = result.current.actions.refresh(oldWallet.wallet.id);
        newerRefresh = result.current.actions.refresh(oldWallet.wallet.id);
      });
      const finishOlder = async () => {
        await act(async () => {
          olderRead.resolve({ [oldWallet.wallet.id]: oldWallet });
          await olderRefresh;
        });
      };
      if (completionOrder === 'older-first') {
        await finishOlder();
        expect(result.current.settled[0]).toBe(false);
      }
      await act(async () => {
        newerRead.resolve({
          [oldWallet.wallet.id]: oldWallet,
          [currentWallet.wallet.id]: currentWallet,
        });
        await newerRefresh;
      });
      if (completionOrder === 'newer-first') {
        await finishOlder();
      }
      await expect(result.current.actions.getWalletWithDevice()).resolves.toBe(
        currentWallet,
      );
      expect(result.current.settled[0]).toBe(true);
    },
  );

  it('ignores a late snapshot from the previous device on the same route', async () => {
    const olderSnapshot = createDeferred<IDeviceStateSnapshot | undefined>();
    mockGetSnapshot.mockReturnValueOnce(olderSnapshot.promise);
    const { result } = renderHook(useDeviceDetailsActions, {
      wrapper: ProviderJotaiContextDeviceDetails,
    });
    let olderRefresh: Promise<unknown> | undefined;
    await act(async () => {
      olderRefresh = result.current.refresh(oldWallet.wallet.id);
    });
    expect(mockGetSnapshot).toHaveBeenCalledTimes(1);
    mockGetAllWallets.mockResolvedValue({ [oldWallet.wallet.id]: oldWallet });
    await act(async () => {
      await result.current.refresh(oldWallet.wallet.id);
      olderSnapshot.resolve({
        state: {
          identity: { serialNo: 'SERIAL', label: 'Previous device' },
          status: {},
          settings: { language: 'zh-CN' },
          versions: {},
        },
      } as IDeviceStateSnapshot);
      await olderRefresh;
    });
    await expect(result.current.getWalletWithDevice()).resolves.toBe(oldWallet);
    await expect(result.current.getDeviceMetaStatic()).resolves.toEqual(
      emptyMetaStatic,
    );
    await expect(result.current.getDeviceMetaState()).resolves.toEqual(
      emptyMetaState,
    );
  });

  it('ignores metadata built before a newer refresh replaced the device', async () => {
    const olderVersion =
      createDeferred<
        Awaited<ReturnType<typeof deviceUtils.getDeviceVersion>>
      >();
    const getVersion = jest
      .spyOn(deviceUtils, 'getDeviceVersion')
      .mockReturnValueOnce(olderVersion.promise);
    jest
      .spyOn(deviceUtils, 'getDeviceTypeFromFeatures')
      .mockResolvedValue(EDeviceType.Pro);
    jest
      .spyOn(deviceUtils, 'getFirmwareType')
      .mockResolvedValue(EFirmwareType.Universal);
    jest.spyOn(deviceUtils, 'buildDeviceName').mockResolvedValue('Old device');
    mockGetAllWallets.mockResolvedValueOnce({
      [oldWallet.wallet.id]: {
        ...oldWallet,
        device: { ...oldWallet.device, featuresInfo: {} },
      },
    });
    const { result } = renderHook(useDeviceDetailsActions, {
      wrapper: ProviderJotaiContextDeviceDetails,
    });
    let olderRefresh: Promise<unknown> | undefined;
    await act(async () => {
      olderRefresh = result.current.refresh(oldWallet.wallet.id);
    });
    expect(getVersion).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.refresh(oldWallet.wallet.id);
      olderVersion.resolve({
        firmwareVersion: '1.0.0',
        bleVersion: '1.0.0',
        bootloaderVersion: '1.0.0',
      });
      await olderRefresh;
    });
    await expect(result.current.getWalletWithDevice()).resolves.toBe(
      currentWallet,
    );
    await expect(result.current.getDeviceMetaStatic()).resolves.toEqual(
      emptyMetaStatic,
    );
  });

  it('uses the current device for both live reads and setting mutations', async () => {
    const { result } = renderHook(useDeviceDetailsActions, {
      wrapper: ProviderJotaiContextDeviceDetails,
    });
    await act(async () => {
      await result.current.refresh(oldWallet.wallet.id);
      await result.current.updateLanguage('en');
    });
    expect(mockGetSnapshot).toHaveBeenCalledWith({
      connectId: 'BLE-ID',
      refreshInfo: undefined,
    });
    expect(mockSetLanguage).toHaveBeenCalledWith({
      walletId: 'hw-current',
      language: 'en',
    });
    await expect(result.current.getWalletWithDevice()).resolves.toBe(
      currentWallet,
    );
    expect(oldWallet.wallet.deprecated).toBe(true);
  });

  it('keeps the management entry after the current wallet is removed', async () => {
    const { result } = renderHook(useDeviceDetailsActions, {
      wrapper: ProviderJotaiContextDeviceDetails,
    });
    await act(async () => {
      await result.current.refresh(oldWallet.wallet.id);
    });
    mockGetAllWallets.mockResolvedValue({ [oldWallet.wallet.id]: oldWallet });
    await act(async () => {
      await result.current.refresh(oldWallet.wallet.id);
    });
    await expect(result.current.getWalletWithDevice()).resolves.toBe(oldWallet);
    await expect(result.current.getCurrentWalletId()).resolves.toBe(
      oldWallet.wallet.id,
    );
  });

  it('clears old metadata while a replacement device loads on the same route', async () => {
    mockGetAllWallets.mockResolvedValue({ [oldWallet.wallet.id]: oldWallet });
    const { result } = renderHook(
      () => ({
        actions: useDeviceDetailsActions(),
        staticMeta: useDeviceMetaStaticAtom(),
        stateMeta: useDeviceMetaStateAtom(),
        settled: useRefreshSettledAtom(),
      }),
      { wrapper: ProviderJotaiContextDeviceDetails },
    );
    await act(async () => {
      await result.current.actions.refresh(oldWallet.wallet.id);
      result.current.staticMeta[1]({
        ...emptyMetaStatic,
        deviceName: 'Old device',
      });
      result.current.stateMeta[1]({
        ...emptyMetaState,
        isReady: true,
        language: 'zh-CN',
      });
    });
    let finishSnapshot: (value: undefined) => void = () => {};
    mockGetSnapshot.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finishSnapshot = resolve;
        }),
    );
    mockGetAllWallets.mockResolvedValue({
      [oldWallet.wallet.id]: oldWallet,
      [currentWallet.wallet.id]: currentWallet,
    });
    let refresh: Promise<unknown> | undefined;
    await act(async () => {
      refresh = result.current.actions.refresh(oldWallet.wallet.id);
    });
    expect(result.current.staticMeta[0]).toEqual(emptyMetaStatic);
    expect(result.current.stateMeta[0]).toEqual(emptyMetaState);
    expect(result.current.settled[0]).toBe(false);
    await act(async () => {
      finishSnapshot(undefined);
      await refresh;
    });
    expect(result.current.staticMeta[0]).toEqual(emptyMetaStatic);
    expect(result.current.stateMeta[0].isReady).toBe(false);
    expect(result.current.settled[0]).toBe(true);
  });
});
