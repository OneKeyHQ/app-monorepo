/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import { EDeviceType } from '@onekeyfe/hd-shared';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EHardwareCallContext,
  EHardwareVendor,
} from '@onekeyhq/shared/types/device';

import localDb from '../../../dbs/local/localDb';

import ServiceHardwarePortfolioSync, {
  decodePortfolioPackageBase64,
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
  default: { isDev: false, isJest: true },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isHwWallet: jest.fn(),
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
    getIndexedAccountSafe: jest.fn(),
    getWalletDeviceSafe: jest.fn(),
    getWalletSafe: jest.fn(),
  },
}));

jest.mock('../../../states/jotai/atoms', () => ({
  currencyPersistAtom: { get: jest.fn() },
  settingsPersistAtom: { get: jest.fn() },
}));

describe('decodePortfolioPackageBase64', () => {
  test('returns a standalone buffer for a valid package', () => {
    expect(
      Array.from(new Uint8Array(decodePortfolioPackageBase64('AQID'))),
    ).toEqual([1, 2, 3]);
  });

  test.each(['not-base64', 'AQI', 'AQID\n'])(
    'rejects an invalid package response: %s',
    (packageBase64) => {
      expect(() => decodePortfolioPackageBase64(packageBase64)).toThrow(
        'response is invalid',
      );
    },
  );

  test('rejects a package larger than the signed envelope limit', () => {
    const oversizedPackage = Buffer.alloc(128 * 1024 + 1).toString('base64');
    expect(() => decodePortfolioPackageBase64(oversizedPackage)).toThrow(
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
    jest.mocked(localDb.getWalletSafe).mockResolvedValue({
      id: 'hw-1',
      name: 'OneKey Wallet',
      type: 'hw',
    } as never);
    jest.mocked(localDb.getWalletDeviceSafe).mockResolvedValue({
      id: 'db-device-1',
      connectId: 'PRO2_CONNECT_ID',
      connectProtocol: 'V2',
      deviceType: EDeviceType.Pro2,
      vendor: EHardwareVendor.onekey,
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
    targetState,
  }: {
    busyResults: boolean[];
    targetState?: {
      lastContentHash?: string;
      lastTransferAt?: number;
      lastWalletId?: string;
    };
  }) {
    let operationLeaseHeld = false;
    const getDeviceState = jest.fn().mockResolvedValue({ protocol: 'V2' });
    const uploadPortfolioPackage = jest.fn(
      async (_params: { connectId: string; packageBytes: ArrayBuffer }) => {
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
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {
        serviceHardware: { getDeviceState, uploadPortfolioPackage },
        serviceHardwareUI: {
          isHardwareChannelBusy,
          runExclusiveOneKeyOperation,
        },
        simpleDb: {
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
      serverPackageBytes: new Uint8Array([1, 2, 3]).buffer,
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
      isHardwareChannelBusy,
      runExclusiveOneKeyOperation,
      service,
      serviceInternals,
      updateTargetState,
      uploadPortfolioPackage,
    };
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

  test('does not submit portfolio data when the device is unreachable', async () => {
    const {
      getDeviceState,
      service,
      serviceInternals,
      uploadPortfolioPackage,
    } = prepareHardwareSync({ busyResults: [false] });
    getDeviceState.mockRejectedValueOnce(new Error('Device not found'));

    await serviceInternals.syncSettledPortfolio(buildHardwarePayload());

    expect(getDeviceState).toHaveBeenCalledWith({
      connectId: 'PRO2_CONNECT_ID',
      hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
      params: { scope: 'runtime' },
      silentMode: true,
    });
    expect(serviceInternals.submitPortfolioJsonToServer).not.toHaveBeenCalled();
    expect(uploadPortfolioPackage).not.toHaveBeenCalled();
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({
        errorMessage: 'Device not found',
        status: 'error',
      }),
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
    const firstState = first.updateTargetState.mock.calls[0][1] as {
      lastContentHash: string;
    };

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
    ['non-Pro2', { deviceType: EDeviceType.Pro }],
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

  test('uses the real upload result instead of a cached connection flag', async () => {
    const uploadPortfolioPackage = jest
      .fn()
      .mockResolvedValue({ portfolioUpdated: true });
    const updateTargetState = jest.fn().mockResolvedValue(undefined);
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {
        serviceHardware: {
          getDeviceState: jest.fn().mockResolvedValue({ protocol: 'V2' }),
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
        serverPackageBytes: ArrayBuffer;
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
      serverPackageBytes: new Uint8Array([1, 2, 3]).buffer,
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
      packageBytes: expect.any(ArrayBuffer),
    });
    expect(updateTargetState).toHaveBeenCalled();
    expect((service as unknown as { lastResult: unknown }).lastResult).toEqual(
      expect.objectContaining({
        status: 'uploaded',
        upload: { portfolioUpdated: true },
      }),
    );
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
    expect(updateTargetState).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('uploads only the latest snapshot for the same physical device', async () => {
    const { serviceInternals, updateTargetState, uploadPortfolioPackage } =
      prepareHardwareSync({ busyResults: [false, false, false] });
    let resolveOlderSubmit:
      | ((value: {
          serverPackageBytes: ArrayBuffer;
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
      serverPackageBytes: ArrayBuffer;
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
        serverPackageBytes: new Uint8Array([2]).buffer,
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
      serverPackageBytes: new Uint8Array([1]).buffer,
      serverSubmit: {
        bytesLength: 1,
        contentHash: 'older-hash',
        serverPackageBase64Length: 4,
        serverPackageBytesLength: 1,
      },
    });
    await olderTask;

    expect(uploadPortfolioPackage).toHaveBeenCalledTimes(1);
    expect(
      Array.from(
        new Uint8Array(uploadPortfolioPackage.mock.calls[0][0].packageBytes),
      ),
    ).toEqual([2]);
    expect(updateTargetState).toHaveBeenCalledTimes(1);
    expect(updateTargetState).toHaveBeenCalledWith(
      'db-device-1',
      expect.objectContaining({ lastContentHash: expect.any(String) }),
    );
  });

  test('releases a prepared retry reservation when upload fails', async () => {
    jest.useFakeTimers();
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
