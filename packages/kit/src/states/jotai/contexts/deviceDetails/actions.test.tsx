/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

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

const mockGetAllWallets = jest.fn<Promise<unknown>, unknown[]>();
const mockSetLanguage = jest.fn<Promise<void>, unknown[]>();
const mockGetSnapshot = jest.fn<Promise<undefined>, unknown[]>();

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
    jest.clearAllMocks();
    mockGetAllWallets.mockResolvedValue({
      [oldWallet.wallet.id]: oldWallet,
      [currentWallet.wallet.id]: currentWallet,
    });
    mockGetSnapshot.mockResolvedValue(undefined);
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
