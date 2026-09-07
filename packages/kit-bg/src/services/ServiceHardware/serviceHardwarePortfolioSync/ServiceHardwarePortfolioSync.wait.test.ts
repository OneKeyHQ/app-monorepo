/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';
import { DeviceSessionPinType } from '@onekeyfe/hd-transport';

import {
  BluetoothUnavailableWhileUsbConnectedError,
  DeviceNotSame,
} from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import {
  EHardwareCallContext,
  EHardwareVendor,
  EOneKeyDeviceMode,
} from '@onekeyhq/shared/types/device';

import localDb from '../../../dbs/local/localDb';

import ServiceHardwarePortfolioSync, {
  validatePortfolioPackageBase64,
} from './ServiceHardwarePortfolioSync';

import type { IPortfolioSyncSettledPayload } from './serviceHardwarePortfolioSyncUtils';
import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    AllNetworksTokenListSettled: 'AllNetworksTokenListSettled',
  },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDev: false,
    isDesktop: false,
    isJest: true,
    isNative: true,
    isSupportDesktopBle: false,
    isSupportWebUSB: false,
  },
}));

const mutablePlatformEnv = platformEnv as unknown as {
  isDesktop: boolean;
  isNative: boolean;
  isSupportDesktopBle: boolean;
  isSupportWebUSB: boolean;
};

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isHwWallet: jest.fn(),
    isQrWallet: jest.fn(),
    isWalletDeprecatedOrMocked: jest.fn(
      (
        wallet: { deprecated?: boolean; isMocked?: boolean } | null | undefined,
      ) => Boolean(wallet?.deprecated || wallet?.isMocked),
    ),
    shortenAddress: jest.fn(({ address }: { address: string }) => address),
  },
}));

jest.mock('../../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getAccountSafe: jest.fn(),
    getDeviceSafe: jest.fn(),
    getIndexedAccountSafe: jest.fn(),
    getWalletDeviceSafe: jest.fn(),
    getWalletSafe: jest.fn(),
  },
}));

jest.mock('../../../states/jotai/atoms', () => ({
  currencyPersistAtom: { get: jest.fn() },
  settingsPersistAtom: { get: jest.fn() },
}));

describe('validatePortfolioPackageBase64', () => {
  test('preserves valid Base64 and reports the decoded size', () => {
    expect(validatePortfolioPackageBase64('AQID')).toEqual({
      packageBase64: 'AQID',
      packageBytesLength: 3,
    });
  });

  test.each(['not-base64', 'AQI', 'AQID\n'])(
    'rejects an invalid package response: %s',
    (packageBase64) => {
      expect(() => validatePortfolioPackageBase64(packageBase64)).toThrow(
        'response is invalid',
      );
    },
  );

  test('rejects a package larger than the signed envelope limit', () => {
    const oversizedPackage = Buffer.alloc(128 * 1024 + 1).toString('base64');
    expect(() => validatePortfolioPackageBase64(oversizedPackage)).toThrow(
      'response is too large',
    );
  });
});

describe('ServiceHardwarePortfolioSync.waitForActivePortfolioSync', () => {
  test('waits for the active upload through a transport alias', async () => {
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });
    let resolveUpload:
      | ((value: { portfolioUpdated: boolean }) => void)
      | undefined;
    const uploadPromise = new Promise<{ portfolioUpdated: boolean }>(
      (resolve) => {
        resolveUpload = resolve;
      },
    );
    const activeUploads = new Map([['db-device-1', uploadPromise]]);
    (
      service as unknown as {
        activeUploadByTargetKey: Map<string, Promise<unknown>>;
        targetKeyByConnectId: Map<string, string>;
      }
    ).activeUploadByTargetKey = activeUploads;
    (
      service as unknown as {
        targetKeyByConnectId: Map<string, string>;
      }
    ).targetKeyByConnectId = new Map([
      ['PRO2_USB_ID', 'db-device-1'],
      ['PRO2_BLE_ID', 'db-device-1'],
    ]);

    let completed = false;
    const waiting = service
      .waitForActivePortfolioSync({ connectId: 'PRO2_BLE_ID' })
      .then((result) => {
        completed = true;
        return result;
      });

    await Promise.resolve();
    expect(completed).toBe(false);

    resolveUpload?.({ portfolioUpdated: true });
    await expect(waiting).resolves.toBe(true);
  });

  test('returns immediately when the device has no active upload', async () => {
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });

    await expect(
      service.waitForActivePortfolioSync({ connectId: 'PRO2_CONNECT_ID' }),
    ).resolves.toBe(false);
  });
});

describe('ServiceHardwarePortfolioSync settled event debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('debounces each sync target independently', () => {
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });
    const serviceInternals = service as unknown as {
      handleAllNetworksTokenListSettled: (
        eventPayload: IPortfolioSyncSettledPayload,
      ) => void;
      syncSettledPortfolio: jest.Mock<
        Promise<void>,
        [IPortfolioSyncSettledPayload, number?]
      >;
    };
    serviceInternals.syncSettledPortfolio = jest
      .fn<Promise<void>, [IPortfolioSyncSettledPayload]>()
      .mockResolvedValue(undefined);
    const buildPayload = ({
      connectId,
      totalFiat,
    }: {
      connectId: string;
      totalFiat: string;
    }) =>
      ({
        aggregateTokenMap: {},
        deviceConnectId: connectId,
        totalFiat,
        totalFiatCurrency: 'usd',
        totalTokenCount: 0,
        tokenMap: {},
        tokens: [],
        walletId: `hw-${connectId}`,
        walletType: 'hw',
      }) as IPortfolioSyncSettledPayload;

    serviceInternals.handleAllNetworksTokenListSettled(
      buildPayload({ connectId: 'PRO2_A', totalFiat: '1' }),
    );
    serviceInternals.handleAllNetworksTokenListSettled(
      buildPayload({ connectId: 'PRO2_B', totalFiat: '2' }),
    );
    serviceInternals.handleAllNetworksTokenListSettled(
      buildPayload({ connectId: 'PRO2_A', totalFiat: '3' }),
    );

    jest.advanceTimersByTime(1000);

    expect(serviceInternals.syncSettledPortfolio).toHaveBeenCalledTimes(2);
    expect(serviceInternals.syncSettledPortfolio).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceConnectId: 'PRO2_A',
        totalFiat: '3',
      }),
      expect.any(Number),
    );
    expect(serviceInternals.syncSettledPortfolio).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceConnectId: 'PRO2_B',
        totalFiat: '2',
      }),
      expect.any(Number),
    );
  });

  test('cancels an older hardware-busy retry as soon as a newer event arrives', async () => {
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });
    const retry = jest.fn().mockResolvedValue(undefined);
    const serviceInternals = service as unknown as {
      handleAllNetworksTokenListSettled: (
        eventPayload: IPortfolioSyncSettledPayload,
      ) => void;
      scheduleHardwareBusyRetry: (params: {
        deviceConnectId: string;
        retry: () => Promise<void>;
      }) => void;
      syncSettledPortfolio: jest.Mock;
    };
    serviceInternals.syncSettledPortfolio = jest
      .fn()
      .mockResolvedValue(undefined);
    serviceInternals.scheduleHardwareBusyRetry({
      deviceConnectId: 'PRO2_A',
      retry,
    });

    serviceInternals.handleAllNetworksTokenListSettled({
      aggregateTokenMap: {},
      deviceConnectId: 'PRO2_A',
      totalFiat: '2',
      totalFiatCurrency: 'usd',
      totalTokenCount: 0,
      tokenMap: {},
      tokens: [],
      walletId: 'hw-PRO2_A',
      walletType: 'hw',
    } as IPortfolioSyncSettledPayload);

    await jest.advanceTimersByTimeAsync(1000);

    expect(retry).not.toHaveBeenCalled();
    expect(serviceInternals.syncSettledPortfolio).toHaveBeenCalledTimes(1);
  });
});

describe('ServiceHardwarePortfolioSync.syncSettledPortfolio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(localDb.getWalletSafe).mockResolvedValue({
      id: 'hw-1',
      name: 'OneKey Wallet',
      type: 'hw',
    } as never);
    jest.mocked(localDb.getWalletDeviceSafe).mockResolvedValue({
      bleConnectId: 'PRO2_BLE_ID',
      id: 'db-device-1',
      connectId: 'PRO2_CONNECT_ID',
      connectProtocol: 'V2',
      deviceId: 'PRO2_DEVICE_ID',
      deviceType: EDeviceType.Pro2,
      vendor: EHardwareVendor.onekey,
    } as never);
    jest.mocked(localDb.getDeviceSafe).mockResolvedValue({
      bleConnectId: 'PRO2_BLE_ID',
      id: 'db-device-1',
      connectId: 'PRO2_CONNECT_ID',
      deviceId: 'PRO2_DEVICE_ID',
      deviceType: EDeviceType.Pro2,
    } as never);
    jest.mocked(localDb.getIndexedAccountSafe).mockResolvedValue({
      id: 'indexed-account-1',
      index: 0,
      name: 'Account #1',
      walletId: 'hw-1',
    } as never);
    jest.mocked(localDb.getAccountSafe).mockResolvedValue({
      id: 'account-1',
      address: '0x1234567890abcdef',
      indexedAccountId: 'indexed-account-1',
      name: 'Ethereum',
    } as never);
    (accountUtils.isHwWallet as jest.Mock).mockImplementation(
      ({ walletId }: { walletId?: string }) => walletId?.startsWith('hw-'),
    );
    (accountUtils.isQrWallet as jest.Mock).mockImplementation(
      ({ walletId }: { walletId?: string }) => walletId?.startsWith('qr-'),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('drops an older RPC snapshot when its authorization finishes last', async () => {
    let resolveOlderWallet:
      | ((wallet: { id: string; name: string; type: 'hw' }) => void)
      | undefined;
    const olderWallet = new Promise<{
      id: string;
      name: string;
      type: 'hw';
    }>((resolve) => {
      resolveOlderWallet = resolve;
    });
    jest
      .mocked(localDb.getWalletSafe)
      .mockImplementationOnce(() => olderWallet as never)
      .mockResolvedValueOnce({
        id: 'hw-1',
        name: 'OneKey Wallet',
        type: 'hw',
      } as never);
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });
    const handleSettled = jest.fn();
    (
      service as unknown as {
        handleAllNetworksTokenListSettled: typeof handleSettled;
      }
    ).handleAllNetworksTokenListSettled = handleSettled;

    const olderTask = service.notifyAllNetworksTokenListSettled({
      ...buildHardwarePayload(),
      totalFiat: '1',
    });
    await Promise.resolve();
    const newerTask = service.notifyAllNetworksTokenListSettled({
      ...buildHardwarePayload(),
      totalFiat: '2',
    });
    await newerTask;
    resolveOlderWallet?.({
      id: 'hw-1',
      name: 'OneKey Wallet',
      type: 'hw',
    });
    await olderTask;

    expect(handleSettled).toHaveBeenCalledTimes(1);
    expect(handleSettled).toHaveBeenCalledWith(
      expect.objectContaining({ totalFiat: '2' }),
    );
  });

  test('rejects a QR wallet even if it is also classified as hardware', async () => {
    jest.mocked(localDb.getWalletSafe).mockResolvedValue({
      id: 'qr-1',
      name: 'OneKey QR Wallet',
      type: 'qr',
    } as never);
    (accountUtils.isHwWallet as jest.Mock).mockReturnValue(true);
    (accountUtils.isQrWallet as jest.Mock).mockReturnValue(true);
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });
    const handleSettled = jest.fn();
    (
      service as unknown as {
        handleAllNetworksTokenListSettled: typeof handleSettled;
      }
    ).handleAllNetworksTokenListSettled = handleSettled;

    await service.notifyAllNetworksTokenListSettled({
      ...buildHardwarePayload(),
      walletId: 'qr-1',
      walletType: 'qr',
    });

    expect(handleSettled).not.toHaveBeenCalled();
    expect(localDb.getWalletDeviceSafe).not.toHaveBeenCalled();
  });

  function buildHardwarePayload() {
    return {
      accountAddress: '0x1234567890abcdef',
      accountId: 'account-1',
      aggregateTokenMap: {},
      deviceConnectId: 'PRO2_CONNECT_ID',
      deviceDbId: 'db-device-1',
      indexedAccountId: 'indexed-account-1',
      totalFiat: '0.00007276',
      totalFiatCurrency: 'usd',
      totalTokenCount: 1,
      tokenMap: {
        eth: {
          balance: '0.00007276',
          balanceParsed: '0.00007276',
          currency: 'usd',
          fiatValue: '0.1',
          price: 1374.38,
        },
      },
      tokens: [
        {
          $key: 'eth',
          address: '',
          decimals: 18,
          isNative: true,
          name: 'Ethereum',
          networkId: 'evm--1',
          symbol: 'ETH',
        },
      ],
      walletId: 'hw-1',
      walletType: 'hw',
    } as unknown as IPortfolioSyncSettledPayload;
  }

  function prepareHardwareSync({
    busyResults,
    cooldownRemainingMs = 0,
    hardwareTransportType = EHardwareTransportType.WEBUSB,
    isConnected = true,
    selectedIndexedAccountId = 'indexed-account-1',
    selectedWalletId = 'hw-1',
    targetState,
    tryAcquire = true,
  }: {
    busyResults: boolean[];
    cooldownRemainingMs?: number;
    hardwareTransportType?: EHardwareTransportType;
    isConnected?: boolean;
    selectedIndexedAccountId?: string;
    selectedWalletId?: string;
    targetState?: {
      bleSilentSyncDisabled?: boolean;
      lastAttemptAt?: number;
      lastContentHash?: string;
      lastTransferAt?: number;
      lastWalletId?: string;
    };
    tryAcquire?: boolean | boolean[];
  }) {
    let operationLeaseHeld = false;
    const getDeviceState = jest.fn().mockResolvedValue({
      identity: { deviceId: 'PRO2_DEVICE_ID' },
      protocol: 'V2',
      status: { unlocked: true },
    });
    const getDeviceStateWithUnlock = jest.fn().mockResolvedValue({
      identity: { deviceId: 'PRO2_DEVICE_ID' },
      protocol: 'V2',
      status: { unlocked: true },
    });
    const getCurrentTransportType = jest
      .fn()
      .mockResolvedValue(hardwareTransportType);
    const prepareHardwareTransport = jest
      .fn()
      .mockResolvedValue(hardwareTransportType);
    const isHardwareDeviceConnected = jest.fn().mockResolvedValue(isConnected);
    const uploadPortfolioPackage = jest.fn(
      async (_params: { connectId: string; packageBase64: string }) => {
        expect(operationLeaseHeld).toBe(true);
        return { portfolioUpdated: true };
      },
    );
    const updateTargetState = jest.fn().mockResolvedValue(undefined);
    const isHardwareChannelBusy = jest.fn();
    for (const busy of busyResults) {
      isHardwareChannelBusy.mockResolvedValueOnce(busy);
    }
    isHardwareChannelBusy.mockResolvedValue(false);
    const runExclusiveOneKeyOperation = jest.fn(
      async (operation: (lease: object) => Promise<unknown>) => {
        operationLeaseHeld = true;
        try {
          return await operation({
            deviceKey: 'db-device-1',
            owner: Symbol('test'),
          });
        } finally {
          operationLeaseHeld = false;
        }
      },
    );
    const tryRunExclusiveOneKeyOperation = jest.fn(
      async (operation: (lease: object) => Promise<unknown>) => {
        const acquired = Array.isArray(tryAcquire)
          ? (tryAcquire.shift() ?? true)
          : tryAcquire;
        if (!acquired) {
          return { acquired: false } as const;
        }
        operationLeaseHeld = true;
        try {
          return {
            acquired: true,
            result: await operation({
              deviceKey: 'db-device-1',
              owner: Symbol('test'),
            }),
          } as const;
        } finally {
          operationLeaseHeld = false;
        }
      },
    );
    const withHardwareProcessing = jest.fn(
      async (operation: (lease: object) => Promise<unknown>) =>
        operation({ deviceKey: 'db-device-1', owner: Symbol('interactive') }),
    );
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {
        serviceHardware: {
          getDeviceState,
          getDeviceStateWithUnlock,
          getCurrentTransportType,
          isHardwareDeviceConnected,
          prepareHardwareTransport,
          uploadPortfolioPackage,
        },
        serviceHardwareUI: {
          isHardwareChannelBusy,
          runExclusiveOneKeyOperation,
          tryRunExclusiveOneKeyOperation,
          withHardwareProcessing,
        },
        simpleDb: {
          accountSelector: {
            getSelectedAccount: jest.fn().mockResolvedValue({
              indexedAccountId: selectedIndexedAccountId,
              walletId: selectedWalletId,
            }),
          },
          hardwarePortfolioSync: {
            getTargetState: jest.fn().mockResolvedValue(targetState),
            updateTargetState,
          },
        },
      } as unknown as IBackgroundApi,
    });
    const serviceInternals = service as unknown as {
      getCurrencyMapForBuild: () => Promise<{
        currencyMap: Record<string, never>;
        displayCurrency: { id: string; symbol: string };
      }>;
      getHardwareCooldownRemainingMs: () => Promise<number>;
      submitPortfolioJsonToServer: jest.Mock;
      syncSettledPortfolio: (
        eventPayload: IPortfolioSyncSettledPayload,
      ) => Promise<boolean | undefined>;
    };
    serviceInternals.getHardwareCooldownRemainingMs = jest
      .fn()
      .mockResolvedValue(cooldownRemainingMs);
    serviceInternals.getCurrencyMapForBuild = jest.fn().mockResolvedValue({
      currencyMap: {},
      displayCurrency: { id: 'usd', symbol: '$' },
    });
    serviceInternals.submitPortfolioJsonToServer = jest.fn().mockResolvedValue({
      serverPackageBase64: 'AQID',
      serverSubmit: {
        bytesLength: 3,
        contentHash: 'server-content-hash',
        serverPackageBase64Length: 4,
        serverPackageBytesLength: 3,
      },
    });
    (accountUtils.isHwWallet as jest.Mock).mockReturnValue(true);
    return {
      getDeviceState,
      getDeviceStateWithUnlock,
      getCurrentTransportType,
      isHardwareDeviceConnected,
      isHardwareChannelBusy,
      prepareHardwareTransport,
      runExclusiveOneKeyOperation,
      service,
      serviceInternals,
      tryRunExclusiveOneKeyOperation,
      updateTargetState,
      uploadPortfolioPackage,
      withHardwareProcessing,
    };
  }

  async function armDesktopBleIdleLease(service: ServiceHardwarePortfolioSync) {
    const interactionGeneration =
      await service.notifyInteractiveHardwareOperationStarted({
        connectId: 'PRO2_CONNECT_ID',
        deviceDbId: 'db-device-1',
      });
    expect(typeof interactionGeneration).toBe('number');
    await service.notifyInteractiveHardwareOperationSucceeded({
      connectId: 'PRO2_CONNECT_ID',
      deviceDbId: 'db-device-1',
      interactionGeneration: interactionGeneration as number,
      transportType: EHardwareTransportType.DesktopWebBle,
    });
  }

  test('uploads a signed empty standard-wallet snapshot to overwrite stale device data', async () => {
    const { serviceInternals, updateTargetState, uploadPortfolioPackage } =
      prepareHardwareSync({ busyResults: [false, false] });

    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      totalFiat: '0',
      totalTokenCount: 0,
      tokenMap: {},
      tokens: [],
    });

    expect(serviceInternals.submitPortfolioJsonToServer).toHaveBeenCalledTimes(
      1,
    );
    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    expect(updateTargetState).toHaveBeenCalledWith(
      'db-device-1',
      expect.objectContaining({ lastWalletId: 'hw-1' }),
    );
  });

  test('skips silent USB upload when the device is locked and does not retry', async () => {
    jest.useFakeTimers();
    const {
      getDeviceState,
      service,
      serviceInternals,
      uploadPortfolioPackage,
    } = prepareHardwareSync({ busyResults: [false, false] });
    getDeviceState.mockResolvedValue({
      identity: { deviceId: 'PRO2_DEVICE_ID' },
      protocol: 'V2',
      status: { unlocked: false },
    });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
    await jest.advanceTimersByTimeAsync(1000);

    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect(serviceInternals.submitPortfolioJsonToServer).toHaveBeenCalledTimes(
      1,
    );
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({
        status: 'device-locked',
        walletId: 'hw-1',
      }),
    );

    getDeviceState.mockResolvedValue({
      identity: { deviceId: 'PRO2_DEVICE_ID' },
      protocol: 'V2',
      status: { unlocked: true },
    });
    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      totalFiat: '2',
    });
    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('replays the locked snapshot after the device reconnects unlocked', async () => {
    jest.useFakeTimers();
    const {
      getDeviceState,
      service,
      serviceInternals,
      uploadPortfolioPackage,
    } = prepareHardwareSync({ busyResults: [false, false] });
    getDeviceState.mockResolvedValue({
      identity: { deviceId: 'PRO2_DEVICE_ID' },
      protocol: 'V2',
      status: { unlocked: false },
    });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
    await jest.advanceTimersByTimeAsync(1000);
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();

    getDeviceState.mockResolvedValue({
      identity: { deviceId: 'PRO2_DEVICE_ID' },
      protocol: 'V2',
      status: { unlocked: true },
    });
    await service.notifyHardwareDeviceConnected({
      identityKeys: ['PRO2_CONNECT_ID'],
    });
    await jest.advanceTimersByTimeAsync(1000);

    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('keeps desktop BLE pending without probing the locked device', async () => {
    jest.useFakeTimers();
    Object.assign(mutablePlatformEnv, {
      isDesktop: true,
      isNative: false,
      isSupportDesktopBle: true,
    });
    try {
      const {
        getDeviceState,
        service,
        serviceInternals,
        uploadPortfolioPackage,
      } = prepareHardwareSync({
        busyResults: [false, false],
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
      });
      getDeviceState.mockResolvedValue({
        identity: { deviceId: 'PRO2_DEVICE_ID' },
        protocol: 'V2',
        status: { unlocked: false },
      });

      await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
      await armDesktopBleIdleLease(service);
      await jest.advanceTimersByTimeAsync(30_000);

      expect(uploadPortfolioPackage).not.toHaveBeenCalled();
      expect(getDeviceState).not.toHaveBeenCalled();
      expect(
        (service as unknown as { lastResult: unknown }).lastResult,
      ).toEqual(expect.objectContaining({ status: 'desktop-suspended' }));
    } finally {
      Object.assign(mutablePlatformEnv, {
        isDesktop: false,
        isNative: true,
        isSupportDesktopBle: false,
      });
      jest.useRealTimers();
    }
  });

  test('does not retry a firmware DeviceLocked refusal', async () => {
    jest.useFakeTimers();
    const { service, serviceInternals, uploadPortfolioPackage } =
      prepareHardwareSync({ busyResults: [false, false] });
    const lockedError = Object.assign(new Error('Device locked'), {
      code: HardwareErrorCode.DeviceLocked,
      payload: { firmwareMessage: 'Device locked' },
    });
    uploadPortfolioPackage.mockRejectedValueOnce(lockedError);

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
    await jest.advanceTimersByTimeAsync(1000);

    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({
        status: 'device-locked',
        walletId: 'hw-1',
      }),
    );
    jest.useRealTimers();
  });

  test('does not pack or upload when the target device is disconnected', async () => {
    const {
      getDeviceState,
      service,
      serviceInternals,
      uploadPortfolioPackage,
    } = prepareHardwareSync({ busyResults: [false], isConnected: false });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

    expect(serviceInternals.submitPortfolioJsonToServer).not.toHaveBeenCalled();
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect(getDeviceState).not.toHaveBeenCalled();
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({
        status: 'disconnected',
        walletId: 'hw-1',
      }),
    );
  });

  test('does not pack or upload for a wallet that is not selected on Home', async () => {
    const { service, serviceInternals, uploadPortfolioPackage } =
      prepareHardwareSync({
        busyResults: [false],
        selectedWalletId: 'hw-2',
      });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

    expect(serviceInternals.submitPortfolioJsonToServer).not.toHaveBeenCalled();
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({
        status: 'inactive',
        walletId: 'hw-1',
      }),
    );
  });

  test('uploads the latest pending snapshot after the target device reconnects', async () => {
    jest.useFakeTimers();
    const {
      isHardwareDeviceConnected,
      service,
      serviceInternals,
      uploadPortfolioPackage,
    } = prepareHardwareSync({
      busyResults: [false, false],
      isConnected: false,
    });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();

    isHardwareDeviceConnected.mockResolvedValue(true);
    await service.notifyHardwareDeviceConnected({
      identityKeys: ['PRO2_CONNECT_ID'],
    });
    await jest.advanceTimersByTimeAsync(1000);

    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('prefers a newer disconnected snapshot over pending BLE data', async () => {
    const { service } = prepareHardwareSync({ busyResults: [false] });
    const olderBlePayload = buildHardwarePayload();
    const latestDisconnectedPayload = {
      ...buildHardwarePayload(),
      totalFiat: '2',
    };
    const resumedPayloadHandler = jest.fn();
    const serviceInternals = service as unknown as {
      handleAllNetworksTokenListSettled: typeof resumedPayloadHandler;
      pendingDisconnectedPayloadByTargetKey: Map<
        string,
        IPortfolioSyncSettledPayload
      >;
      pendingMobileBlePayloadByTargetKey: Map<
        string,
        IPortfolioSyncSettledPayload
      >;
      targetKeyByConnectId: Map<string, string>;
    };
    serviceInternals.targetKeyByConnectId.set('PRO2_CONNECT_ID', 'db-device-1');
    serviceInternals.pendingMobileBlePayloadByTargetKey.set(
      'db-device-1',
      olderBlePayload,
    );
    serviceInternals.pendingDisconnectedPayloadByTargetKey.set(
      'db-device-1',
      latestDisconnectedPayload,
    );
    serviceInternals.handleAllNetworksTokenListSettled = resumedPayloadHandler;

    await service.notifyHardwareDeviceConnected({
      identityKeys: ['PRO2_CONNECT_ID'],
    });

    expect(resumedPayloadHandler).toHaveBeenCalledTimes(1);
    expect(resumedPayloadHandler).toHaveBeenCalledWith(
      latestDisconnectedPayload,
    );
    expect(
      serviceInternals.pendingMobileBlePayloadByTargetKey.has('db-device-1'),
    ).toBe(false);
  });

  test('does not upload when the connected device identity differs from the wallet device', async () => {
    const {
      getDeviceState,
      service,
      serviceInternals,
      updateTargetState,
      uploadPortfolioPackage,
    } = prepareHardwareSync({ busyResults: [false, false] });
    getDeviceState.mockResolvedValue({
      identity: { deviceId: 'OTHER_DEVICE_ID' },
      protocol: 'V2',
      status: { unlocked: true },
    });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

    expect(getDeviceState).toHaveBeenCalledWith({
      connectId: 'PRO2_CONNECT_ID',
      hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
      hardwareTransportType: EHardwareTransportType.WEBUSB,
      persistTransportType: false,
      params: { scope: 'firmware' },
      silentMode: true,
    });
    expect(updateTargetState).not.toHaveBeenCalled();
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({
        status: 'identity-mismatch',
        walletId: 'hw-1',
      }),
    );

    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      totalFiat: '2',
    });

    expect(getDeviceState).toHaveBeenCalledTimes(1);
    expect(serviceInternals.submitPortfolioJsonToServer).toHaveBeenCalledTimes(
      1,
    );
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
  });

  test('defers Pro2 identity verification when Bootloader omits deviceId', async () => {
    jest.useFakeTimers();
    const {
      getDeviceState,
      service,
      serviceInternals,
      updateTargetState,
      uploadPortfolioPackage,
    } = prepareHardwareSync({ busyResults: [false, false] });
    getDeviceState.mockResolvedValueOnce({
      identity: { deviceId: null },
      protocol: 'V2',
      status: { mode: EOneKeyDeviceMode.bootloader },
    });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

    expect(updateTargetState).not.toHaveBeenCalled();
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({
        status: 'identity-unavailable',
        walletId: 'hw-1',
      }),
    );

    getDeviceState.mockResolvedValueOnce({
      identity: { deviceId: 'PRO2_DEVICE_ID' },
      protocol: 'V2',
      status: { mode: EOneKeyDeviceMode.normal, unlocked: true },
    });
    await service.notifyHardwareDeviceConnected({
      identityKeys: ['PRO2_CONNECT_ID'],
    });
    await jest.advanceTimersByTimeAsync(1000);

    expect(getDeviceState).toHaveBeenCalledTimes(2);
    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('keeps treating a missing Pro2 deviceId in normal mode as a mismatch', async () => {
    const {
      getDeviceState,
      service,
      serviceInternals,
      uploadPortfolioPackage,
    } = prepareHardwareSync({ busyResults: [false, false] });
    getDeviceState.mockResolvedValue({
      identity: { deviceId: null },
      protocol: 'V2',
      status: { mode: EOneKeyDeviceMode.normal },
    });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({
        status: 'identity-mismatch',
        walletId: 'hw-1',
      }),
    );
  });

  test('does not apply the Pro2 Bootloader exception to Neo', async () => {
    jest.mocked(localDb.getDeviceSafe).mockResolvedValue({
      id: 'db-device-1',
      connectId: 'PRO2_CONNECT_ID',
      deviceId: 'PRO2_DEVICE_ID',
      deviceType: EDeviceType.Neo,
    } as never);
    const {
      getDeviceState,
      service,
      serviceInternals,
      uploadPortfolioPackage,
    } = prepareHardwareSync({ busyResults: [false, false] });
    getDeviceState.mockResolvedValue({
      identity: { deviceId: null },
      protocol: 'V2',
      status: { mode: EOneKeyDeviceMode.bootloader },
    });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({ status: 'identity-mismatch' }),
    );
  });

  test('verifies device identity once per connection session', async () => {
    const {
      getDeviceState,
      service,
      serviceInternals,
      uploadPortfolioPackage,
    } = prepareHardwareSync({
      busyResults: [false, false],
      hardwareTransportType: EHardwareTransportType.Bridge,
    });

    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      totalFiat: '1',
    });
    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      totalFiat: '2',
    });

    expect(getDeviceState).toHaveBeenCalledTimes(2);
    expect(getDeviceState).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ params: { scope: 'firmware' } }),
    );
    expect(getDeviceState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ params: { scope: 'runtime' } }),
    );
    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(2);

    await service.notifyHardwareDeviceConnected({
      identityKeys: ['PRO2_CONNECT_ID'],
    });
    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      totalFiat: '3',
    });

    expect(getDeviceState).toHaveBeenCalledTimes(3);
    expect(getDeviceState).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ params: { scope: 'firmware' } }),
    );
    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(3);
  });

  test('rechecks WebUSB identity and blocks a changed device without caching it', async () => {
    const {
      getDeviceState,
      service,
      serviceInternals,
      uploadPortfolioPackage,
    } = prepareHardwareSync({
      busyResults: [false, false],
      hardwareTransportType: EHardwareTransportType.WEBUSB,
    });

    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      totalFiat: '1',
    });
    expect(
      (
        service as unknown as {
          verifiedDeviceIdByTargetKey: Map<string, string>;
        }
      ).verifiedDeviceIdByTargetKey.size,
    ).toBe(0);

    getDeviceState.mockResolvedValueOnce({
      identity: { deviceId: 'CHANGED_DEVICE_ID' },
      protocol: 'V2',
    });
    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      totalFiat: '2',
    });

    expect(getDeviceState).toHaveBeenCalledTimes(2);
    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({ status: 'identity-mismatch' }),
    );
  });

  test('clears the verified identity cache when the device disconnects', async () => {
    const {
      getDeviceState,
      service,
      serviceInternals,
      uploadPortfolioPackage,
    } = prepareHardwareSync({ busyResults: [false, false, false] });

    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      totalFiat: '1',
    });
    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      totalFiat: '2',
    });
    expect(getDeviceState).toHaveBeenCalledTimes(2);

    await service.notifyHardwareDeviceDisconnected({
      identityKeys: ['PRO2_CONNECT_ID'],
    });
    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      totalFiat: '3',
    });

    expect(getDeviceState).toHaveBeenCalledTimes(3);
    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(3);
  });

  test('prefers an exact connected WebUSB device over the persisted BLE transport', async () => {
    const navigatorDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator',
    );
    const previousPlatformEnv = {
      isDesktop: mutablePlatformEnv.isDesktop,
      isNative: mutablePlatformEnv.isNative,
      isSupportDesktopBle: mutablePlatformEnv.isSupportDesktopBle,
      isSupportWebUSB: mutablePlatformEnv.isSupportWebUSB,
    };
    Object.assign(mutablePlatformEnv, {
      isDesktop: true,
      isNative: false,
      isSupportDesktopBle: true,
      isSupportWebUSB: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        usb: {
          getDevices: jest
            .fn()
            .mockResolvedValue([
              { serialNumber: 'PRO2_CONNECT_ID' } as USBDevice,
            ]),
        },
      },
    });

    try {
      const {
        getDeviceState,
        getCurrentTransportType,
        prepareHardwareTransport,
        serviceInternals,
        uploadPortfolioPackage,
      } = prepareHardwareSync({
        busyResults: [false],
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
      });
      prepareHardwareTransport.mockResolvedValue(EHardwareTransportType.WEBUSB);
      getCurrentTransportType.mockResolvedValue(EHardwareTransportType.WEBUSB);

      await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

      expect(prepareHardwareTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          connectId: 'PRO2_CONNECT_ID',
          hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
          persistTransportType: false,
          requestedTransportType: 'usb',
        }),
      );
      expect(getDeviceState).toHaveBeenCalledWith(
        expect.objectContaining({
          hardwareTransportType: EHardwareTransportType.WEBUSB,
          persistTransportType: false,
        }),
      );
      expect(uploadPortfolioPackage).toHaveBeenCalledWith(
        expect.objectContaining({
          hardwareTransportType: EHardwareTransportType.WEBUSB,
        }),
      );
    } finally {
      Object.assign(mutablePlatformEnv, previousPlatformEnv);
      Object.defineProperty(
        globalThis,
        'navigator',
        navigatorDescriptor ?? { configurable: true, value: undefined },
      );
    }
  });

  test('keeps only the latest mobile BLE snapshot pending without communication', async () => {
    const { service, serviceInternals, uploadPortfolioPackage } =
      prepareHardwareSync({
        busyResults: [false],
        hardwareTransportType: EHardwareTransportType.BLE,
      });
    const latestPayload = {
      ...buildHardwarePayload(),
      totalFiat: '2',
    };
    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
    await serviceInternals.syncSettledPortfolio(latestPayload);

    expect(serviceInternals.submitPortfolioJsonToServer).not.toHaveBeenCalled();
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect(
      (
        service as unknown as {
          pendingMobileBlePayloadByTargetKey: Map<
            string,
            IPortfolioSyncSettledPayload
          >;
        }
      ).pendingMobileBlePayloadByTargetKey.get('db-device-1')?.totalFiat,
    ).toBe('2');
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({ status: 'ble-suspended' }),
    );
  });

  test('uses the standard interactive hardware flow for an explicit BLE sync', async () => {
    const {
      getDeviceStateWithUnlock,
      isHardwareChannelBusy,
      service,
      serviceInternals,
      uploadPortfolioPackage,
      withHardwareProcessing,
    } = prepareHardwareSync({
      busyResults: [false],
      hardwareTransportType: EHardwareTransportType.BLE,
    });

    await expect(
      service.syncPortfolio({
        eventPayload: buildHardwarePayload(),
        syncMode: 'interactive',
      }),
    ).resolves.toBe(true);

    expect(withHardwareProcessing).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        debugMethodName: 'portfolio.syncPortfolio',
        deviceParams: {
          dbDevice: expect.objectContaining({ id: 'db-device-1' }),
        },
      }),
    );
    expect(isHardwareChannelBusy).not.toHaveBeenCalled();
    expect(getDeviceStateWithUnlock).toHaveBeenCalledWith({
      connectId: 'PRO2_CONNECT_ID',
      oneKeyOperationLease: expect.objectContaining({
        deviceKey: 'db-device-1',
      }),
      params: { scope: 'runtime' },
      pinType: DeviceSessionPinType.Any,
    });
    expect(serviceInternals.submitPortfolioJsonToServer).toHaveBeenCalledTimes(
      1,
    );
    expect(uploadPortfolioPackage).toHaveBeenCalledWith({
      connectId: 'PRO2_CONNECT_ID',
      hardwareTransportType: EHardwareTransportType.BLE,
      packageBase64: 'AQID',
      uiMode: 'progress',
    });
    expect(getDeviceStateWithUnlock.mock.invocationCallOrder[0]).toBeLessThan(
      uploadPortfolioPackage.mock.invocationCallOrder[0],
    );
  });

  test('cancels pending silent debounce before explicit unlock', async () => {
    jest.useFakeTimers();
    try {
      const { getDeviceStateWithUnlock, service, uploadPortfolioPackage } =
        prepareHardwareSync({
          busyResults: [false],
          hardwareTransportType: EHardwareTransportType.BLE,
        });
      const serviceInternals = service as unknown as {
        advanceSyncGeneration: (targetKey: string) => number;
        handleAllNetworksTokenListSettled: (
          eventPayload: IPortfolioSyncSettledPayload,
        ) => void;
      };
      const advanceSyncGeneration = jest.spyOn(
        serviceInternals,
        'advanceSyncGeneration',
      );

      serviceInternals.handleAllNetworksTokenListSettled(
        buildHardwarePayload(),
      );
      await expect(
        service.syncPortfolio({
          eventPayload: buildHardwarePayload(),
          syncMode: 'interactive',
        }),
      ).resolves.toBe(true);
      await jest.advanceTimersByTimeAsync(1000);

      expect(advanceSyncGeneration).toHaveBeenCalledTimes(2);
      expect(advanceSyncGeneration.mock.invocationCallOrder[1]).toBeLessThan(
        getDeviceStateWithUnlock.mock.invocationCallOrder[0],
      );
      expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('keeps explicit sync current while a silent snapshot arrives during unlock', async () => {
    jest.useFakeTimers();
    try {
      let resolveUnlock: (() => void) | undefined;
      let notifyUnlockStarted: (() => void) | undefined;
      const unlockStarted = new Promise<void>((resolve) => {
        notifyUnlockStarted = resolve;
      });
      const { getDeviceStateWithUnlock, service, uploadPortfolioPackage } =
        prepareHardwareSync({
          busyResults: [false],
          hardwareTransportType: EHardwareTransportType.BLE,
        });
      getDeviceStateWithUnlock.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveUnlock = () => resolve(undefined);
            notifyUnlockStarted?.();
          }),
      );
      const serviceInternals = service as unknown as {
        advanceSyncGeneration: (targetKey: string) => number;
        handleAllNetworksTokenListSettled: (
          eventPayload: IPortfolioSyncSettledPayload,
        ) => void;
      };
      const advanceSyncGeneration = jest.spyOn(
        serviceInternals,
        'advanceSyncGeneration',
      );

      const interactiveSync = service.syncPortfolio({
        eventPayload: buildHardwarePayload(),
        syncMode: 'interactive',
      });
      await unlockStarted;
      serviceInternals.handleAllNetworksTokenListSettled(
        buildHardwarePayload(),
      );

      expect(advanceSyncGeneration).toHaveBeenCalledTimes(1);
      resolveUnlock?.();
      await expect(interactiveSync).resolves.toBe(true);
      expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1000);
      expect(advanceSyncGeneration).toHaveBeenCalledTimes(2);
      expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('settles an explicit sync when device unlock is cancelled', async () => {
    const portfolioSyncResultSpy = jest
      .spyOn(defaultLogger.hardware.connection, 'portfolioSyncResult')
      .mockImplementation((params) => params);
    const {
      getDeviceStateWithUnlock,
      service,
      serviceInternals,
      uploadPortfolioPackage,
    } = prepareHardwareSync({
      busyResults: [false],
      hardwareTransportType: EHardwareTransportType.BLE,
    });
    getDeviceStateWithUnlock.mockRejectedValueOnce(
      new Error('Device unlock cancelled'),
    );

    await expect(
      service.syncPortfolio({
        eventPayload: buildHardwarePayload(),
        syncMode: 'interactive',
      }),
    ).rejects.toThrow('Device unlock cancelled');

    expect(serviceInternals.submitPortfolioJsonToServer).not.toHaveBeenCalled();
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect(portfolioSyncResultSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'PRO2_DEVICE_ID',
        deviceType: EDeviceType.Pro2,
        failureStage: 'unlock',
        status: 'failed',
        syncDurationMs: expect.any(Number),
        syncMode: 'interactive',
        totalTokenCount: 1,
      }),
    );
  });

  test('does not mark an unapplied explicit upload as transferred', async () => {
    const { service, updateTargetState, uploadPortfolioPackage } =
      prepareHardwareSync({
        busyResults: [false],
        hardwareTransportType: EHardwareTransportType.BLE,
      });
    uploadPortfolioPackage.mockResolvedValueOnce({ portfolioUpdated: false });

    await expect(
      service.syncPortfolio({
        eventPayload: buildHardwarePayload(),
        syncMode: 'interactive',
      }),
    ).rejects.toThrow('Portfolio sync did not complete');

    expect(
      updateTargetState.mock.calls.some(
        ([, state]) =>
          (state as { lastContentHash?: string }).lastContentHash !== undefined,
      ),
    ).toBe(false);
    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
  });

  test('keeps the explicit result scoped when another sync updates lastResult', async () => {
    const { runExclusiveOneKeyOperation, service, uploadPortfolioPackage } =
      prepareHardwareSync({
        busyResults: [false],
        hardwareTransportType: EHardwareTransportType.BLE,
      });
    uploadPortfolioPackage.mockResolvedValueOnce({ portfolioUpdated: false });
    const originalRunExclusive =
      runExclusiveOneKeyOperation.getMockImplementation();
    expect(originalRunExclusive).toBeDefined();
    const originalRunExclusiveImpl = originalRunExclusive as NonNullable<
      typeof originalRunExclusive
    >;
    runExclusiveOneKeyOperation.mockImplementationOnce(async (operation) => {
      const result = await originalRunExclusiveImpl(operation);
      (
        service as unknown as {
          setLastResult: (result: {
            status: 'duplicate';
            updatedAt: number;
          }) => void;
        }
      ).setLastResult({ status: 'duplicate', updatedAt: Date.now() });
      return result;
    });

    await expect(
      service.syncPortfolio({
        eventPayload: buildHardwarePayload(),
        syncMode: 'interactive',
      }),
    ).rejects.toThrow('Portfolio sync did not complete');

    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({ status: 'duplicate' }),
    );
  });

  test('keeps explicit sync successful when upload metadata persistence fails', async () => {
    const { service, updateTargetState, uploadPortfolioPackage } =
      prepareHardwareSync({
        busyResults: [false],
        hardwareTransportType: EHardwareTransportType.BLE,
      });
    updateTargetState
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('storage failed'));

    await expect(
      service.syncPortfolio({
        eventPayload: buildHardwarePayload(),
        syncMode: 'interactive',
      }),
    ).resolves.toBe(true);

    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({
        status: 'uploaded',
        upload: { portfolioUpdated: true },
      }),
    );
    expect(
      (
        service as unknown as {
          inFlightReservationByTargetKey: Map<string, unknown>;
        }
      ).inFlightReservationByTargetKey.size,
    ).toBe(0);
  });

  test('uploads an unchanged snapshot again for an explicit sync', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_785_723_200_000);
    const payload = buildHardwarePayload();
    const first = prepareHardwareSync({ busyResults: [false, false] });
    await first.serviceInternals.syncSettledPortfolio(payload);
    const firstState = first.updateTargetState.mock.calls.find((call) =>
      Boolean((call[1] as { lastContentHash?: string }).lastContentHash),
    )?.[1] as { lastContentHash: string; lastWalletId: string };
    const explicit = prepareHardwareSync({
      busyResults: [false, false],
      targetState: {
        lastContentHash: firstState.lastContentHash,
        lastWalletId: firstState.lastWalletId,
      },
    });

    await expect(
      explicit.service.syncPortfolio({
        eventPayload: payload,
        syncMode: 'interactive',
      }),
    ).resolves.toBe(true);

    expect(explicit.uploadPortfolioPackage).toHaveBeenCalledTimes(1);
  });

  test('returns false when an explicit sync target is no longer active', async () => {
    const { service, uploadPortfolioPackage, withHardwareProcessing } =
      prepareHardwareSync({
        busyResults: [false],
        selectedWalletId: 'hw-2',
      });

    await expect(
      service.syncPortfolio({
        eventPayload: buildHardwarePayload(),
        syncMode: 'interactive',
      }),
    ).resolves.toBe(false);

    expect(withHardwareProcessing).not.toHaveBeenCalled();
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
  });

  test('throws when explicit sync verifies a different device', async () => {
    const {
      getDeviceState,
      service,
      serviceInternals,
      uploadPortfolioPackage,
    } = prepareHardwareSync({ busyResults: [false] });
    getDeviceState.mockResolvedValue({
      identity: { deviceId: 'OTHER_DEVICE_ID' },
      protocol: 'V2',
      status: { unlocked: true },
    });

    await expect(
      service.syncPortfolio({
        eventPayload: buildHardwarePayload(),
        syncMode: 'interactive',
      }),
    ).rejects.toBeInstanceOf(DeviceNotSame);

    expect(serviceInternals.submitPortfolioJsonToServer).toHaveBeenCalledTimes(
      1,
    );
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
  });

  test('replays a desktop BLE snapshot after a later USB connection', async () => {
    jest.useFakeTimers();
    Object.assign(mutablePlatformEnv, {
      isDesktop: true,
      isNative: false,
      isSupportDesktopBle: true,
    });
    try {
      const {
        getDeviceState,
        prepareHardwareTransport,
        service,
        serviceInternals,
        uploadPortfolioPackage,
      } = prepareHardwareSync({
        busyResults: [false],
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
      });

      await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

      expect(getDeviceState).not.toHaveBeenCalled();
      expect(
        serviceInternals.submitPortfolioJsonToServer,
      ).not.toHaveBeenCalled();
      expect(uploadPortfolioPackage).not.toHaveBeenCalled();
      expect(
        (
          service as unknown as {
            pendingDisconnectedPayloadByTargetKey: Map<string, unknown>;
          }
        ).pendingDisconnectedPayloadByTargetKey.has('db-device-1'),
      ).toBe(false);
      expect(
        (service as unknown as { lastResult: unknown }).lastResult,
      ).toEqual(expect.objectContaining({ status: 'desktop-suspended' }));

      prepareHardwareTransport.mockResolvedValue(EHardwareTransportType.WEBUSB);
      await service.notifyHardwareDeviceConnected({
        identityKeys: ['PRO2_CONNECT_ID'],
      });
      await jest.advanceTimersByTimeAsync(1000);

      expect(getDeviceState).toHaveBeenCalledTimes(1);
      expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
      Object.assign(mutablePlatformEnv, {
        isDesktop: false,
        isNative: true,
        isSupportDesktopBle: false,
      });
    }
  });

  test('uploads the desktop Portfolio snapshot through the active USB transport', async () => {
    Object.assign(mutablePlatformEnv, {
      isDesktop: true,
      isNative: false,
      isSupportDesktopBle: true,
    });
    try {
      const {
        getDeviceState,
        runExclusiveOneKeyOperation,
        serviceInternals,
        uploadPortfolioPackage,
      } = prepareHardwareSync({
        busyResults: [false],
        hardwareTransportType: EHardwareTransportType.WEBUSB,
      });
      await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

      expect(runExclusiveOneKeyOperation).toHaveBeenCalledTimes(1);
      expect(getDeviceState).toHaveBeenCalledWith(
        expect.objectContaining({
          connectId: 'PRO2_CONNECT_ID',
          hardwareTransportType: EHardwareTransportType.WEBUSB,
          persistTransportType: false,
        }),
      );
      expect(
        serviceInternals.submitPortfolioJsonToServer,
      ).toHaveBeenCalledTimes(1);
      expect(uploadPortfolioPackage).toHaveBeenCalledWith({
        connectId: 'PRO2_CONNECT_ID',
        hardwareTransportType: EHardwareTransportType.WEBUSB,
        packageBase64: 'AQID',
      });
    } finally {
      Object.assign(mutablePlatformEnv, {
        isDesktop: false,
        isNative: true,
        isSupportDesktopBle: false,
      });
    }
  });

  test('keeps the prepared USB transport if the stored preference changes to BLE', async () => {
    Object.assign(mutablePlatformEnv, {
      isDesktop: true,
      isNative: false,
      isSupportDesktopBle: true,
    });
    try {
      const {
        getCurrentTransportType,
        getDeviceState,
        prepareHardwareTransport,
        service,
        serviceInternals,
        uploadPortfolioPackage,
      } = prepareHardwareSync({
        busyResults: [false],
        hardwareTransportType: EHardwareTransportType.WEBUSB,
      });
      getCurrentTransportType.mockResolvedValue(
        EHardwareTransportType.DesktopWebBle,
      );

      await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

      expect(prepareHardwareTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          connectId: 'PRO2_CONNECT_ID',
          hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
          persistTransportType: false,
        }),
      );
      expect(prepareHardwareTransport).not.toHaveBeenCalledWith(
        expect.objectContaining({ requestedTransportType: 'usb' }),
      );
      expect(
        serviceInternals.submitPortfolioJsonToServer,
      ).toHaveBeenCalledTimes(1);
      expect(getCurrentTransportType).not.toHaveBeenCalled();
      expect(getDeviceState).toHaveBeenCalledWith(
        expect.objectContaining({
          hardwareTransportType: EHardwareTransportType.WEBUSB,
          persistTransportType: false,
        }),
      );
      expect(uploadPortfolioPackage).toHaveBeenCalledWith({
        connectId: 'PRO2_CONNECT_ID',
        hardwareTransportType: EHardwareTransportType.WEBUSB,
        packageBase64: 'AQID',
      });
      expect(
        (service as unknown as { lastResult: unknown }).lastResult,
      ).toEqual(expect.objectContaining({ status: 'uploaded' }));
    } finally {
      Object.assign(mutablePlatformEnv, {
        isDesktop: false,
        isNative: true,
        isSupportDesktopBle: false,
      });
    }
  });

  test('does not silently upload desktop BLE after an interactive operation', async () => {
    jest.useFakeTimers();
    Object.assign(mutablePlatformEnv, {
      isDesktop: true,
      isNative: false,
      isSupportDesktopBle: true,
    });
    try {
      const {
        getDeviceState,
        runExclusiveOneKeyOperation,
        service,
        serviceInternals,
        tryRunExclusiveOneKeyOperation,
        uploadPortfolioPackage,
      } = prepareHardwareSync({
        busyResults: [false, false],
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
      });

      await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
      await armDesktopBleIdleLease(service);

      await jest.advanceTimersByTimeAsync(29_999);
      expect(uploadPortfolioPackage).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);

      expect(runExclusiveOneKeyOperation).not.toHaveBeenCalled();
      expect(tryRunExclusiveOneKeyOperation).not.toHaveBeenCalled();
      expect(getDeviceState).not.toHaveBeenCalled();
      expect(uploadPortfolioPackage).not.toHaveBeenCalled();
      expect(
        (
          service as unknown as {
            pendingDesktopBlePayloadByTargetKey: Map<string, unknown>;
          }
        ).pendingDesktopBlePayloadByTargetKey.has('db-device-1'),
      ).toBe(true);
    } finally {
      jest.useRealTimers();
      Object.assign(mutablePlatformEnv, {
        isDesktop: false,
        isNative: true,
        isSupportDesktopBle: false,
      });
    }
  });

  test('does not schedule desktop BLE retries for a pending snapshot', async () => {
    jest.useFakeTimers();
    Object.assign(mutablePlatformEnv, {
      isDesktop: true,
      isNative: false,
      isSupportDesktopBle: true,
    });
    try {
      const {
        service,
        serviceInternals,
        tryRunExclusiveOneKeyOperation,
        uploadPortfolioPackage,
      } = prepareHardwareSync({
        busyResults: [false],
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
        tryAcquire: [false, true],
      });

      await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
      await armDesktopBleIdleLease(service);
      await jest.advanceTimersByTimeAsync(30_000);

      expect(tryRunExclusiveOneKeyOperation).not.toHaveBeenCalled();
      expect(uploadPortfolioPackage).not.toHaveBeenCalled();
      expect(
        (
          service as unknown as {
            pendingDesktopBlePayloadByTargetKey: Map<string, unknown>;
          }
        ).pendingDesktopBlePayloadByTargetKey.has('db-device-1'),
      ).toBe(true);

      await jest.advanceTimersByTimeAsync(1000);
      expect(tryRunExclusiveOneKeyOperation).not.toHaveBeenCalled();
      expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      Object.assign(mutablePlatformEnv, {
        isDesktop: false,
        isNative: true,
        isSupportDesktopBle: false,
      });
    }
  });

  test('replaces the pending desktop BLE snapshot before debounce completes', async () => {
    jest.useFakeTimers();
    Object.assign(mutablePlatformEnv, {
      isDesktop: true,
      isNative: false,
      isSupportDesktopBle: true,
    });
    try {
      const { service, serviceInternals } = prepareHardwareSync({
        busyResults: [false],
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
      });
      await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

      (
        service as unknown as {
          handleAllNetworksTokenListSettled: (
            payload: IPortfolioSyncSettledPayload,
          ) => void;
        }
      ).handleAllNetworksTokenListSettled({
        ...buildHardwarePayload(),
        totalFiat: '2',
      });

      expect(
        (
          service as unknown as {
            pendingDesktopBlePayloadByTargetKey: Map<
              string,
              IPortfolioSyncSettledPayload
            >;
          }
        ).pendingDesktopBlePayloadByTargetKey.get('db-device-1')?.totalFiat,
      ).toBe('2');
    } finally {
      jest.useRealTimers();
      Object.assign(mutablePlatformEnv, {
        isDesktop: false,
        isNative: true,
        isSupportDesktopBle: false,
      });
    }
  });

  test('does not arm desktop BLE reuse without a persisted BLE connectId', async () => {
    Object.assign(mutablePlatformEnv, {
      isDesktop: true,
      isNative: false,
      isSupportDesktopBle: true,
    });
    try {
      const { service } = prepareHardwareSync({
        busyResults: [false],
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
      });
      jest.mocked(localDb.getDeviceSafe).mockResolvedValueOnce({
        id: 'db-device-1',
        uuid: 'PRO2_SERIAL_NUMBER',
      } as never);
      const interactionGeneration =
        await service.notifyInteractiveHardwareOperationStarted({
          deviceDbId: 'db-device-1',
        });

      await expect(
        service.notifyInteractiveHardwareOperationSucceeded({
          deviceDbId: 'db-device-1',
          interactionGeneration: interactionGeneration as number,
          transportType: EHardwareTransportType.DesktopWebBle,
        }),
      ).resolves.toBe(false);
    } finally {
      Object.assign(mutablePlatformEnv, {
        isDesktop: false,
        isNative: true,
        isSupportDesktopBle: false,
      });
    }
  });

  test('does not rearm an idle lease from an older BLE operation completion', async () => {
    jest.useFakeTimers();
    Object.assign(mutablePlatformEnv, {
      isDesktop: true,
      isNative: false,
      isSupportDesktopBle: true,
    });
    try {
      const { service, serviceInternals, uploadPortfolioPackage } =
        prepareHardwareSync({
          busyResults: [false],
          hardwareTransportType: EHardwareTransportType.DesktopWebBle,
        });
      await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
      const olderGeneration =
        await service.notifyInteractiveHardwareOperationStarted({
          deviceDbId: 'db-device-1',
        });
      await service.notifyInteractiveHardwareOperationStarted({
        deviceDbId: 'db-device-1',
      });

      await expect(
        service.notifyInteractiveHardwareOperationSucceeded({
          deviceDbId: 'db-device-1',
          interactionGeneration: olderGeneration as number,
          transportType: EHardwareTransportType.DesktopWebBle,
        }),
      ).resolves.toBe(false);
      await jest.advanceTimersByTimeAsync(30_000);

      expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      Object.assign(mutablePlatformEnv, {
        isDesktop: false,
        isNative: true,
        isSupportDesktopBle: false,
      });
    }
  });

  test('cancels the desktop BLE idle attempt when the physical link disconnects', async () => {
    jest.useFakeTimers();
    Object.assign(mutablePlatformEnv, {
      isDesktop: true,
      isNative: false,
      isSupportDesktopBle: true,
    });
    try {
      const { service, serviceInternals, uploadPortfolioPackage } =
        prepareHardwareSync({
          busyResults: [false],
          hardwareTransportType: EHardwareTransportType.DesktopWebBle,
        });

      await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
      await armDesktopBleIdleLease(service);
      await service.notifyHardwareDeviceDisconnected({
        identityKeys: ['PRO2_BLE_ID'],
      });
      await jest.advanceTimersByTimeAsync(30_000);

      expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      Object.assign(mutablePlatformEnv, {
        isDesktop: false,
        isNative: true,
        isSupportDesktopBle: false,
      });
    }
  });

  test('abandons desktop BLE reuse if the active transport changes to USB', async () => {
    jest.useFakeTimers();
    Object.assign(mutablePlatformEnv, {
      isDesktop: true,
      isNative: false,
      isSupportDesktopBle: true,
    });
    try {
      const {
        getCurrentTransportType,
        service,
        serviceInternals,
        uploadPortfolioPackage,
      } = prepareHardwareSync({
        busyResults: [false],
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
      });

      await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
      await armDesktopBleIdleLease(service);
      getCurrentTransportType.mockResolvedValue(EHardwareTransportType.WEBUSB);
      await jest.advanceTimersByTimeAsync(30_000);

      expect(uploadPortfolioPackage).not.toHaveBeenCalled();
      expect(
        serviceInternals.submitPortfolioJsonToServer,
      ).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      Object.assign(mutablePlatformEnv, {
        isDesktop: false,
        isNative: true,
        isSupportDesktopBle: false,
      });
    }
  });

  test('does not extend a desktop BLE lease beyond the low-frequency cooldown', async () => {
    jest.useFakeTimers();
    Object.assign(mutablePlatformEnv, {
      isDesktop: true,
      isNative: false,
      isSupportDesktopBle: true,
    });
    try {
      const {
        service,
        serviceInternals,
        tryRunExclusiveOneKeyOperation,
        uploadPortfolioPackage,
      } = prepareHardwareSync({
        busyResults: [false],
        cooldownRemainingMs: 5 * 60_000,
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
      });

      await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
      await armDesktopBleIdleLease(service);
      await jest.advanceTimersByTimeAsync(30_000);
      await jest.advanceTimersByTimeAsync(5 * 60_000);

      expect(tryRunExclusiveOneKeyOperation).not.toHaveBeenCalled();
      expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      Object.assign(mutablePlatformEnv, {
        isDesktop: false,
        isNative: true,
        isSupportDesktopBle: false,
      });
    }
  });

  test('keeps a fresh snapshot that arrives during the BLE resume delay', async () => {
    jest.useFakeTimers();
    const { service, serviceInternals, uploadPortfolioPackage } =
      prepareHardwareSync({ busyResults: [false] });
    uploadPortfolioPackage.mockRejectedValueOnce(
      new BluetoothUnavailableWhileUsbConnectedError(),
    );

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      totalFiat: '2',
    });
    await service.notifyInteractiveHardwareOperationSucceeded({
      connectId: 'PRO2_CONNECT_ID',
      deviceDbId: 'db-device-1',
    });

    const resumedSync = jest.fn().mockResolvedValue(undefined);
    const resumeInternals = service as unknown as {
      handleAllNetworksTokenListSettled: (
        payload: IPortfolioSyncSettledPayload,
      ) => void;
      syncSettledPortfolio: typeof resumedSync;
    };
    resumeInternals.syncSettledPortfolio = resumedSync;
    const freshPayload = {
      ...buildHardwarePayload(),
      totalFiat: '3',
    };
    resumeInternals.handleAllNetworksTokenListSettled(freshPayload);

    await jest.advanceTimersByTimeAsync(1000);
    expect(resumedSync).toHaveBeenCalledTimes(1);
    expect(resumedSync).toHaveBeenCalledWith(freshPayload, expect.any(Number));

    await jest.advanceTimersByTimeAsync(5000);
    expect(resumedSync).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('keeps a fresh snapshot that arrives while BLE resume state is saving', async () => {
    jest.useFakeTimers();
    const {
      service,
      serviceInternals,
      updateTargetState,
      uploadPortfolioPackage,
    } = prepareHardwareSync({ busyResults: [false] });
    uploadPortfolioPackage.mockRejectedValueOnce(
      new BluetoothUnavailableWhileUsbConnectedError(),
    );
    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

    let resolveResumeState: (() => void) | undefined;
    const resumeStateSaved = new Promise<void>((resolve) => {
      resolveResumeState = resolve;
    });
    updateTargetState.mockImplementation(
      async (_targetKey, state: { bleSilentSyncDisabled?: boolean }) => {
        if (state.bleSilentSyncDisabled === false) {
          await resumeStateSaved;
        }
      },
    );

    const resumedSync = jest.fn().mockResolvedValue(undefined);
    const resumeInternals = service as unknown as {
      handleAllNetworksTokenListSettled: (
        payload: IPortfolioSyncSettledPayload,
      ) => void;
      syncSettledPortfolio: typeof resumedSync;
    };
    resumeInternals.syncSettledPortfolio = resumedSync;
    const resumePromise = service.notifyInteractiveHardwareOperationSucceeded({
      connectId: 'PRO2_CONNECT_ID',
      deviceDbId: 'db-device-1',
    });
    await Promise.resolve();

    const freshPayload = {
      ...buildHardwarePayload(),
      totalFiat: '3',
    };
    resumeInternals.handleAllNetworksTokenListSettled(freshPayload);
    resolveResumeState?.();
    await expect(resumePromise).resolves.toBe(true);

    await jest.advanceTimersByTimeAsync(6000);
    expect(resumedSync).toHaveBeenCalledTimes(1);
    expect(resumedSync).toHaveBeenCalledWith(freshPayload, expect.any(Number));
    jest.useRealTimers();
  });

  test('restores the mobile BLE suspension after a bg runtime restart', async () => {
    const { service, serviceInternals, uploadPortfolioPackage } =
      prepareHardwareSync({
        busyResults: [false],
        hardwareTransportType: EHardwareTransportType.BLE,
        targetState: { bleSilentSyncDisabled: true },
      });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

    expect(serviceInternals.submitPortfolioJsonToServer).not.toHaveBeenCalled();
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({ status: 'ble-suspended' }),
    );
  });

  test('overwrites a legacy target whose matching hash has no wallet binding', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_785_723_200_000);
    const first = prepareHardwareSync({ busyResults: [false, false] });
    const emptyPayload = {
      ...buildHardwarePayload(),
      totalFiat: '0',
      totalTokenCount: 0,
      tokenMap: {},
      tokens: [],
    };
    await first.serviceInternals.syncSettledPortfolio(emptyPayload);
    const firstState = first.updateTargetState.mock.calls.find((call) =>
      Boolean((call[1] as { lastContentHash?: string }).lastContentHash),
    )?.[1] as { lastContentHash: string };

    const migrated = prepareHardwareSync({
      busyResults: [false, false],
      targetState: { lastContentHash: firstState.lastContentHash },
    });
    await migrated.serviceInternals.syncSettledPortfolio(emptyPayload);

    expect(migrated.uploadPortfolioPackage).toHaveBeenCalledTimes(1);
  });

  test('syncs the active hidden wallet to the device-level portfolio target', async () => {
    jest.mocked(localDb.getWalletSafe).mockResolvedValue({
      id: 'hw-1',
      name: 'Hidden Wallet',
      passphraseState: 'hidden-state',
      type: 'hw',
    } as never);
    const { serviceInternals, updateTargetState, uploadPortfolioPackage } =
      prepareHardwareSync({ busyResults: [false] });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

    expect(serviceInternals.submitPortfolioJsonToServer).toHaveBeenCalledTimes(
      1,
    );
    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    expect(updateTargetState).toHaveBeenCalledWith(
      'db-device-1',
      expect.objectContaining({ lastWalletId: 'hw-1' }),
    );
  });

  test('authorizes an All Networks snapshot by indexed account when the virtual account is not persisted', async () => {
    jest
      .mocked(localDb.getAccountSafe)
      .mockClear()
      .mockResolvedValue(undefined);
    const { serviceInternals, uploadPortfolioPackage } = prepareHardwareSync({
      busyResults: [false],
    });

    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      accountAddress: 'AllNetworkMockAddress',
      accountId: 'hw-1--onekeyall--0000/0',
      ownerAccountId: 'hw-1--onekeyall--0000/0',
    });

    expect(serviceInternals.submitPortfolioJsonToServer).toHaveBeenCalledTimes(
      1,
    );
    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
  });

  test('rejects frontend device identifiers that do not match the wallet device', async () => {
    const { serviceInternals, uploadPortfolioPackage } = prepareHardwareSync({
      busyResults: [false],
    });

    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      deviceDbId: 'forged-device',
    });

    expect(serviceInternals.submitPortfolioJsonToServer).not.toHaveBeenCalled();
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
  });

  test('rejects an indexed account that is not owned by the wallet', async () => {
    jest.mocked(localDb.getIndexedAccountSafe).mockResolvedValue({
      id: 'indexed-account-1',
      index: 0,
      name: 'Account #1',
      walletId: 'hw-other',
    } as never);
    const { serviceInternals, uploadPortfolioPackage } = prepareHardwareSync({
      busyResults: [false],
    });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

    expect(serviceInternals.submitPortfolioJsonToServer).not.toHaveBeenCalled();
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
  });

  test.each([
    ['deprecated', { deprecated: true }],
    ['mocked', { isMocked: true }],
  ])('does not sync a %s hardware wallet', async (_label, walletState) => {
    jest.mocked(localDb.getWalletSafe).mockResolvedValue({
      id: 'hw-1',
      name: 'OneKey Wallet',
      type: 'hw',
      ...walletState,
    } as never);
    jest.mocked(localDb.getWalletDeviceSafe).mockClear();
    const {
      getDeviceState,
      service,
      serviceInternals,
      uploadPortfolioPackage,
    } = prepareHardwareSync({ busyResults: [false] });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

    expect(localDb.getWalletDeviceSafe).not.toHaveBeenCalled();
    expect(getDeviceState).not.toHaveBeenCalled();
    expect(serviceInternals.submitPortfolioJsonToServer).not.toHaveBeenCalled();
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({
        status: 'disabled',
        walletId: 'hw-1',
      }),
    );
  });

  test.each([
    ['Classic', { deviceType: EDeviceType.Classic }],
    ['Classic 1S', { deviceType: EDeviceType.Classic1s }],
    ['Classic Pure', { deviceType: EDeviceType.ClassicPure }],
    ['Mini', { deviceType: EDeviceType.Mini }],
    ['Touch', { deviceType: EDeviceType.Touch }],
    ['Pro', { deviceType: EDeviceType.Pro }],
    ['unknown product', { deviceType: EDeviceType.Unknown }],
    ['Protocol V1', { connectProtocol: 'V1' }],
    ['third-party', { vendor: EHardwareVendor.ledger }],
    ['unknown-vendor', { vendor: undefined }],
  ])('rejects a %s wallet device', async (_label, deviceOverride) => {
    jest.mocked(localDb.getWalletDeviceSafe).mockResolvedValue({
      id: 'db-device-1',
      connectId: 'PRO2_CONNECT_ID',
      connectProtocol: 'V2',
      deviceType: EDeviceType.Pro2,
      vendor: EHardwareVendor.onekey,
      ...deviceOverride,
    } as never);
    const { serviceInternals, uploadPortfolioPackage } = prepareHardwareSync({
      busyResults: [false],
    });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

    expect(serviceInternals.submitPortfolioJsonToServer).not.toHaveBeenCalled();
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
  });

  test('does not build or submit portfolio data for a software wallet', async () => {
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });
    const serviceInternals = service as unknown as {
      getCurrencyMapForBuild: jest.Mock;
      submitPortfolioJsonToServer: jest.Mock;
      syncSettledPortfolio: (
        eventPayload: IPortfolioSyncSettledPayload,
      ) => Promise<void>;
    };
    serviceInternals.getCurrencyMapForBuild = jest.fn();
    serviceInternals.submitPortfolioJsonToServer = jest.fn();
    (accountUtils.isHwWallet as jest.Mock).mockReturnValue(false);

    await serviceInternals.syncSettledPortfolio({
      ...buildHardwarePayload(),
      walletId: 'hd-1',
      walletType: 'hd',
    });

    expect(serviceInternals.getCurrencyMapForBuild).not.toHaveBeenCalled();
    expect(serviceInternals.submitPortfolioJsonToServer).not.toHaveBeenCalled();
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({
        status: 'disabled',
        walletId: 'hd-1',
      }),
    );
  });

  test('uploads when the current Home target is connected', async () => {
    const uploadPortfolioPackage = jest
      .fn()
      .mockResolvedValue({ portfolioUpdated: true });
    const updateTargetState = jest.fn().mockResolvedValue(undefined);
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {
        serviceHardware: {
          getDeviceState: jest.fn().mockResolvedValue({
            identity: { deviceId: 'PRO2_DEVICE_ID' },
            protocol: 'V2',
            status: { unlocked: true },
          }),
          getCurrentTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.WEBUSB),
          isHardwareDeviceConnected: jest.fn().mockResolvedValue(true),
          prepareHardwareTransport: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.WEBUSB),
          uploadPortfolioPackage,
        },
        serviceHardwareUI: {
          isHardwareChannelBusy: jest.fn().mockResolvedValue(false),
          runExclusiveOneKeyOperation: jest.fn(
            async (operation: (lease: object) => Promise<unknown>) =>
              operation({ deviceKey: 'db-device-1', owner: Symbol('test') }),
          ),
        },
        simpleDb: {
          accountSelector: {
            getSelectedAccount: jest.fn().mockResolvedValue({
              indexedAccountId: 'indexed-account-1',
              walletId: 'hw-1',
            }),
          },
          hardwarePortfolioSync: {
            getTargetState: jest.fn().mockResolvedValue(undefined),
            updateTargetState,
          },
        },
      } as unknown as IBackgroundApi,
    });
    const serviceInternals = service as unknown as {
      getCurrencyMapForBuild: () => Promise<{
        currencyMap: Record<string, never>;
        displayCurrency: { id: string; symbol: string };
      }>;
      getHardwareCooldownRemainingMs: () => Promise<number>;
      submitPortfolioJsonToServer: () => Promise<{
        serverPackageBase64: string;
        serverSubmit: {
          bytesLength: number;
          contentHash: string;
          serverPackageBase64Length: number;
          serverPackageBytesLength: number;
        };
      }>;
      syncSettledPortfolio: (
        eventPayload: IPortfolioSyncSettledPayload,
      ) => Promise<void>;
    };
    serviceInternals.getHardwareCooldownRemainingMs = jest
      .fn()
      .mockResolvedValue(0);
    serviceInternals.getCurrencyMapForBuild = jest.fn().mockResolvedValue({
      currencyMap: {},
      displayCurrency: { id: 'usd', symbol: '$' },
    });
    serviceInternals.submitPortfolioJsonToServer = jest.fn().mockResolvedValue({
      serverPackageBase64: 'AQID',
      serverSubmit: {
        bytesLength: 3,
        contentHash: 'server-content-hash',
        serverPackageBase64Length: 4,
        serverPackageBytesLength: 3,
      },
    });
    (accountUtils.isHwWallet as jest.Mock).mockReturnValue(true);

    const payload = buildHardwarePayload();

    await serviceInternals.syncSettledPortfolio(payload);

    expect(uploadPortfolioPackage).toHaveBeenCalledWith({
      connectId: 'PRO2_CONNECT_ID',
      hardwareTransportType: EHardwareTransportType.WEBUSB,
      packageBase64: 'AQID',
    });
    expect(updateTargetState).toHaveBeenCalled();
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({
        status: 'uploaded',
        upload: { portfolioUpdated: true },
      }),
    );
  });

  test('reports a successful Portfolio sync with transfer metrics', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-03T00:00:00.000Z'));
    const portfolioSyncedSpy = jest
      .spyOn(defaultLogger.hardware.connection, 'portfolioSynced')
      .mockImplementation((params) => params);
    const portfolioSyncResultSpy = jest
      .spyOn(defaultLogger.hardware.connection, 'portfolioSyncResult')
      .mockImplementation((params) => params);
    try {
      const { serviceInternals, uploadPortfolioPackage } = prepareHardwareSync({
        busyResults: [false, false],
      });
      uploadPortfolioPackage.mockImplementationOnce(async () => {
        jest.setSystemTime(Date.now() + 1000);
        return { portfolioUpdated: true };
      });

      await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

      expect(portfolioSyncedSpy).toHaveBeenCalledTimes(1);
      expect(portfolioSyncedSpy).toHaveBeenCalledWith({
        deviceId: 'PRO2_DEVICE_ID',
        deviceType: EDeviceType.Pro2,
      });
      expect(portfolioSyncResultSpy).toHaveBeenCalledTimes(1);
      expect(portfolioSyncResultSpy).toHaveBeenCalledWith({
        deviceId: 'PRO2_DEVICE_ID',
        deviceType: EDeviceType.Pro2,
        effectiveTransferRateBytesPerSecond: 3,
        hardwareDurationMs: 1000,
        packageBytes: 3,
        packDurationMs: 0,
        portfolioJsonBytes: expect.any(Number),
        status: 'success',
        syncDurationMs: 1000,
        syncMode: 'silent',
        tokenCount: 1,
        totalTokenCount: 1,
        transportType: EHardwareTransportType.WEBUSB,
      });
    } finally {
      portfolioSyncedSpy.mockRestore();
      portfolioSyncResultSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  test('reports a server packing failure without raw Portfolio data', async () => {
    const portfolioSyncResultSpy = jest
      .spyOn(defaultLogger.hardware.connection, 'portfolioSyncResult')
      .mockImplementation((params) => params);
    const { serviceInternals, uploadPortfolioPackage } = prepareHardwareSync({
      busyResults: [false, false],
    });
    serviceInternals.submitPortfolioJsonToServer.mockRejectedValueOnce(
      Object.assign(new Error('Server packing failed'), {
        code: 'PACK_FAILED',
      }),
    );

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect(portfolioSyncResultSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'PRO2_DEVICE_ID',
        deviceType: EDeviceType.Pro2,
        errorCode: 'PACK_FAILED',
        failureStage: 'pack',
        packDurationMs: expect.any(Number),
        portfolioJsonBytes: expect.any(Number),
        status: 'failed',
        syncDurationMs: expect.any(Number),
        syncMode: 'silent',
        tokenCount: 1,
        totalTokenCount: 1,
        transportType: EHardwareTransportType.WEBUSB,
      }),
    );
    expect(portfolioSyncResultSpy).toHaveBeenCalledTimes(1);
  });

  test('retries the latest snapshot when hardware is busy before server packing', async () => {
    jest.useFakeTimers();
    const { serviceInternals, uploadPortfolioPackage } = prepareHardwareSync({
      busyResults: [true, false, false],
    });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1000);
    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('retries an already-packed snapshot without another server request', async () => {
    jest.useFakeTimers();
    const { serviceInternals, updateTargetState, uploadPortfolioPackage } =
      prepareHardwareSync({
        busyResults: [false, true, false],
      });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect(serviceInternals.submitPortfolioJsonToServer).toHaveBeenCalledTimes(
      1,
    );

    await jest.advanceTimersByTimeAsync(1000);
    expect(serviceInternals.submitPortfolioJsonToServer).toHaveBeenCalledTimes(
      1,
    );
    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    expect(updateTargetState).toHaveBeenCalledTimes(2);
    expect(updateTargetState).toHaveBeenCalledWith(
      'db-device-1',
      expect.objectContaining({ lastAttemptAt: expect.any(Number) }),
    );
    jest.useRealTimers();
  });

  test('drops an already-packed retry when its wallet is no longer authorized', async () => {
    jest.useFakeTimers();
    const {
      service,
      serviceInternals,
      updateTargetState,
      uploadPortfolioPackage,
    } = prepareHardwareSync({
      busyResults: [false, true, false],
    });

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
    expect(serviceInternals.submitPortfolioJsonToServer).toHaveBeenCalledTimes(
      1,
    );
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();

    jest.mocked(localDb.getWalletSafe).mockResolvedValue({
      deprecated: true,
      id: 'hw-1',
      name: 'OneKey Wallet',
      type: 'hw',
    } as never);

    await jest.advanceTimersByTimeAsync(1000);

    expect(serviceInternals.submitPortfolioJsonToServer).toHaveBeenCalledTimes(
      1,
    );
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect(updateTargetState).not.toHaveBeenCalled();
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({ status: 'disabled', walletId: 'hw-1' }),
    );
    jest.useRealTimers();
  });

  test('uploads only the latest snapshot for the same physical device', async () => {
    const { serviceInternals, updateTargetState, uploadPortfolioPackage } =
      prepareHardwareSync({ busyResults: [false, false, false] });
    let resolveOlderSubmit:
      | ((value: {
          serverPackageBase64: string;
          serverSubmit: {
            bytesLength: number;
            contentHash: string;
            serverPackageBase64Length: number;
            serverPackageBytesLength: number;
          };
        }) => void)
      | undefined;
    let notifyOlderSubmitStarted: (() => void) | undefined;
    const olderSubmitStarted = new Promise<void>((resolve) => {
      notifyOlderSubmitStarted = resolve;
    });
    const olderSubmit = new Promise<{
      serverPackageBase64: string;
      serverSubmit: {
        bytesLength: number;
        contentHash: string;
        serverPackageBase64Length: number;
        serverPackageBytesLength: number;
      };
    }>((resolve) => {
      resolveOlderSubmit = resolve;
    });
    serviceInternals.submitPortfolioJsonToServer
      .mockImplementationOnce(() => {
        notifyOlderSubmitStarted?.();
        return olderSubmit;
      })
      .mockResolvedValueOnce({
        serverPackageBase64: 'Ag==',
        serverSubmit: {
          bytesLength: 1,
          contentHash: 'newer-hash',
          serverPackageBase64Length: 4,
          serverPackageBytesLength: 1,
        },
      });
    const olderPayload = {
      ...buildHardwarePayload(),
      deviceDbId: 'db-device-1',
      totalFiat: '1',
    };
    const newerPayload = {
      ...buildHardwarePayload(),
      deviceDbId: 'db-device-1',
      totalFiat: '2',
    };

    const olderTask = serviceInternals.syncSettledPortfolio(olderPayload);
    await olderSubmitStarted;
    await serviceInternals.syncSettledPortfolio(newerPayload);
    resolveOlderSubmit?.({
      serverPackageBase64: 'AQ==',
      serverSubmit: {
        bytesLength: 1,
        contentHash: 'older-hash',
        serverPackageBase64Length: 4,
        serverPackageBytesLength: 1,
      },
    });
    await olderTask;

    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    expect(uploadPortfolioPackage.mock.calls[0][0].packageBase64).toBe('Ag==');
    expect(updateTargetState).toHaveBeenCalledTimes(2);
    expect(updateTargetState).toHaveBeenCalledWith(
      'db-device-1',
      expect.objectContaining({ lastContentHash: expect.any(String) }),
    );
  });

  test('does not record a phantom attempt when a newer generation arrives during persistence', async () => {
    const { serviceInternals, updateTargetState, uploadPortfolioPackage } =
      prepareHardwareSync({ busyResults: [false, false] });
    let notifyAttemptWriteStarted!: () => void;
    const attemptWriteStarted = new Promise<void>((resolve) => {
      notifyAttemptWriteStarted = resolve;
    });
    let releaseAttemptWrite!: () => void;
    const attemptWriteGate = new Promise<void>((resolve) => {
      releaseAttemptWrite = resolve;
    });
    updateTargetState.mockImplementationOnce(async () => {
      notifyAttemptWriteStarted();
      await attemptWriteGate;
    });

    const syncTask = serviceInternals.syncSettledPortfolio(
      buildHardwarePayload(),
    );
    await attemptWriteStarted;

    // The hardware call and lastAttemptAt persistence start together. Evicting
    // the generation while storage is pending must not leave a phantom cooldown.
    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    (
      serviceInternals as typeof serviceInternals & {
        advanceSyncGeneration: (targetKey: string) => number;
      }
    ).advanceSyncGeneration('db-device-1');
    releaseAttemptWrite();
    await syncTask;

    expect(updateTargetState).toHaveBeenCalledTimes(1);
    expect(updateTargetState).toHaveBeenCalledWith('db-device-1', {
      lastAttemptAt: expect.any(Number),
    });
  });

  test('keeps the operation lock until upload settles when attempt persistence fails', async () => {
    const {
      service,
      serviceInternals,
      updateTargetState,
      uploadPortfolioPackage,
    } = prepareHardwareSync({ busyResults: [false, false] });
    let notifyUploadStarted!: () => void;
    const uploadStarted = new Promise<void>((resolve) => {
      notifyUploadStarted = resolve;
    });
    let resolveUpload!: (value: { portfolioUpdated: boolean }) => void;
    uploadPortfolioPackage.mockImplementationOnce(
      () =>
        new Promise<{ portfolioUpdated: boolean }>((resolve) => {
          resolveUpload = resolve;
          notifyUploadStarted();
        }),
    );
    updateTargetState.mockRejectedValueOnce(new Error('storage failed'));
    let syncSettled = false;

    const syncTask = serviceInternals
      .syncSettledPortfolio(buildHardwarePayload())
      .finally(() => {
        syncSettled = true;
      });
    await uploadStarted;
    await Promise.resolve();
    await Promise.resolve();

    expect(syncSettled).toBe(false);
    resolveUpload({ portfolioUpdated: true });
    await syncTask;
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({
        status: 'uploaded',
      }),
    );
    expect(updateTargetState).toHaveBeenLastCalledWith(
      'db-device-1',
      expect.objectContaining({
        lastAttemptAt: expect.any(Number),
        lastContentHash: expect.any(String),
        lastTransferAt: expect.any(Number),
      }),
    );
  });

  test('releases a prepared retry reservation when upload fails', async () => {
    jest.useFakeTimers();
    const portfolioSyncResultSpy = jest
      .spyOn(defaultLogger.hardware.connection, 'portfolioSyncResult')
      .mockImplementation((params) => params);
    const { service, serviceInternals, uploadPortfolioPackage } =
      prepareHardwareSync({ busyResults: [false, true, false] });
    uploadPortfolioPackage.mockRejectedValueOnce(new Error('Device unplugged'));

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());
    await jest.advanceTimersByTimeAsync(1000);

    const inFlightReservations = (
      service as unknown as {
        inFlightReservationByTargetKey: Map<
          string,
          { contentHash: string; generation: number }
        >;
      }
    ).inFlightReservationByTargetKey;
    expect(inFlightReservations.size).toBe(0);
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({
        errorMessage: 'Device unplugged',
        status: 'error',
      }),
    );
    expect(portfolioSyncResultSpy).toHaveBeenCalledTimes(1);
    expect(portfolioSyncResultSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        failureStage: 'device-sync',
        hardwareDurationMs: expect.any(Number),
        packageBytes: 3,
        status: 'failed',
        syncMode: 'silent',
        transportType: EHardwareTransportType.WEBUSB,
      }),
    );
    expect(portfolioSyncResultSpy.mock.calls[0][0]).not.toHaveProperty(
      'effectiveTransferRateBytesPerSecond',
    );
    jest.useRealTimers();
  });

  test('keeps a newer same-hash reservation when a stale generation finishes', () => {
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });
    const serviceInternals = service as unknown as {
      inFlightReservationByTargetKey: Map<
        string,
        { contentHash: string; generation: number }
      >;
      releaseInFlightReservation: (params: {
        contentHash: string;
        generation: number;
        targetKey: string;
      }) => void;
    };
    serviceInternals.inFlightReservationByTargetKey.set('db-device-1', {
      contentHash: 'same-hash',
      generation: 2,
    });

    serviceInternals.releaseInFlightReservation({
      contentHash: 'same-hash',
      generation: 1,
      targetKey: 'db-device-1',
    });

    expect(
      serviceInternals.inFlightReservationByTargetKey.get('db-device-1'),
    ).toEqual({
      contentHash: 'same-hash',
      generation: 2,
    });
  });
});
