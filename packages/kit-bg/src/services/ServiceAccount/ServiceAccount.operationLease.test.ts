import {
  InvoiceExpiredError,
  OneKeyErrorScanQrCodeCancel,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';

import localDb from '../../dbs/local/localDb';
import ServiceBatchCreateAccount from '../ServiceBatchCreateAccount/ServiceBatchCreateAccount';
import {
  HardwareProcessingManager,
  type IOneKeyHardwareOperationLease,
} from '../ServiceHardwareUI/HardwareProcessingManager';
import {
  assertPublicAccountCreationCanContinue,
  isPublicAccountCreationContext,
} from '../ServicePrimeCloudSync/publicAccountCreationContext';

import ServiceAccount from './ServiceAccount';

describe('explicit account creation capability entry', () => {
  test('does not dispatch a scan-owned creation after its dialog settles', async () => {
    const hasCallback = jest.fn(() => false);
    const service = Object.assign(Object.create(ServiceAccount.prototype), {
      backgroundApi: { servicePromise: { hasCallback } },
    }) as ServiceAccount;
    const inner = jest
      .spyOn(service, 'addHDOrHWAccountsFn')
      .mockResolvedValue(undefined);
    await expect(
      service.addHDOrHWAccountsForUserCreation({
        walletId: 'hd-1',
        networkId: 'lightning--0',
        indexedAccountId: 'hd-1--0',
        deriveType: 'default',
        addressCreationPromiseId: 42,
      }),
    ).rejects.toBeInstanceOf(OneKeyErrorScanQrCodeCancel);
    expect(hasCallback).toHaveBeenCalledWith(42);
    expect(inner).not.toHaveBeenCalled();
  });

  test('only the user entry mints a live background capability', async () => {
    const service = Object.create(ServiceAccount.prototype) as ServiceAccount;
    let captured: object | undefined;
    const active: boolean[] = [];
    const inner = jest
      .spyOn(service, 'addHDOrHWAccountsFn')
      .mockImplementation(async (params) => {
        captured = params.publicAccountCreationContext;
        active.push(isPublicAccountCreationContext(captured));
        return undefined;
      });
    const params = {
      walletId: 'hd-1',
      networkId: 'evm--1',
      indexedAccountId: undefined,
      indexes: [0],
      deriveType: 'default' as const,
    };
    await service.addHDOrHWAccountsForUserCreation(params);
    expect(active).toEqual([true]);
    expect(isPublicAccountCreationContext(captured)).toBe(false);
    await service.addHDOrHWAccounts(params);
    expect(active).toEqual([true, false]);
    inner.mockRestore();
  });

  test('stops QR import and skips wallet update when its callback settles during background work', async () => {
    const hasCallback = jest.fn(() => true);
    const service = Object.assign(Object.create(ServiceAccount.prototype), {
      backgroundApi: { servicePromise: { hasCallback } },
    }) as ServiceAccount;
    const create = jest.spyOn(localDb, 'createQrWallet');
    create.mockImplementationOnce(async ({ publicAccountCreationContext }) => {
      await Promise.resolve();
      hasCallback.mockReturnValue(false);
      assertPublicAccountCreationCanContinue(publicAccountCreationContext);
      throw new OneKeyLocalError('QR import continued after cancellation');
    });
    const walletUpdate = jest.spyOn(appEventBus, 'emit');
    walletUpdate.mockClear();

    await expect(
      service.createQrWallet({
        qrDevice: {
          deviceId: 'fixture-device',
          name: 'OneKey Pro',
          version: '1.0.0',
          xfp: '12345678',
          buildBy: 'multiAccounts',
        },
        airGapAccounts: [],
        addressCreationPromiseId: 42,
      }),
    ).rejects.toBeInstanceOf(OneKeyErrorScanQrCodeCancel);
    expect(create).toHaveBeenCalledTimes(1);
    expect(hasCallback).toHaveBeenCalledWith(42);
    expect(walletUpdate).not.toHaveBeenCalled();
  });

  test('checks Lightning expiry after the address lookup misses before creating a dialog', async () => {
    const lookupStarted = Promise.withResolvers<void>();
    const lookup = Promise.withResolvers<never>();
    const getNetworkAccount = jest.fn(() => {
      lookupStarted.resolve();
      return lookup.promise;
    });
    const createCallback = jest.fn(
      ({ resolve }: { resolve: (value: boolean) => void }) => {
        resolve(false);
        return 42;
      },
    );
    const service = new ServiceAccount({
      backgroundApi: {
        serviceAccount: { getNetworkAccount },
        serviceNetwork: { getGlobalDeriveTypeOfNetwork: async () => 'default' },
        servicePromise: { createCallback },
      },
    });
    const expiresAt = 1_900_000_000;
    const serverTime = jest
      .spyOn(systemTimeUtils, 'getFreshEstimatedServerTime')
      .mockResolvedValue((expiresAt - 1) * 1000);
    try {
      const options = {
        lightningInvoiceExpiresAt: expiresAt,
        allowWatchAccount: false,
      };
      const result = service.createAddressIfNotExists(
        {
          walletId: 'hd-1',
          indexedAccountId: 'hd-1--0',
          networkId: 'lightning--0',
        },
        options,
      );
      await lookupStarted.promise;
      serverTime.mockResolvedValue(expiresAt * 1000);
      lookup.reject(new OneKeyLocalError('Missing test account'));
      await expect(result).rejects.toBeInstanceOf(InvoiceExpiredError);
      expect(createCallback).not.toHaveBeenCalled();
    } finally {
      serverTime.mockRestore();
    }
  });
});

const mockPrepareAccounts = jest.fn(async () => []);
const mockBatchGetAddresses = jest.fn(
  async (): Promise<{ address: string }[]> => [],
);

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    AccountUpdate: 'AccountUpdate',
    WalletUpdate: 'WalletUpdate',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: { createQrWallet: jest.fn() },
}));

jest.mock('../../states/jotai/atoms/prime', () => ({
  primeTransferAtom: {
    set: jest.fn(async () => undefined),
  },
}));

jest.mock('../../vaults/factory', () => ({
  vaultFactory: {
    getWalletOnlyVault: jest.fn(async () => ({
      keyring: {
        prepareAccounts: mockPrepareAccounts,
        batchGetAddresses: mockBatchGetAddresses,
      },
      getNetworkInfo: jest.fn(async () => ({})),
    })),
  },
}));

describe('ServiceAccount hardware operation lease', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchGetAddresses.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes the displayed local-wallet address to the hardware keyring', async () => {
    jest.spyOn(appLocale.intl, 'formatMessage').mockReturnValue('Address');
    const expectedAddress = 'u1-on-screen';
    mockBatchGetAddresses.mockResolvedValue([{ address: expectedAddress }]);
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardwareUI: {
          withHardwareProcessing: async (operation: () => Promise<unknown>) =>
            operation(),
        },
        serviceNetwork: {
          getVaultSettings: async () => ({ accountType: 'simple' }),
        },
      },
    });
    service.getPrepareHDOrHWAccountsParams = jest.fn().mockResolvedValue({
      prepareParams: { indexes: [0], deviceParams: {} },
      deviceParams: { dbDevice: { id: 'device-1' } },
      networkId: 'zec--0',
      walletId: 'hw-1',
    });

    await expect(
      service.verifyHWAccountAddresses({
        walletId: 'hw-1',
        networkId: 'zec--0',
        indexedAccountId: undefined,
        deriveType: 'default',
        expectedAddress,
        localWalletAddressForm: 'private',
      }),
    ).resolves.toEqual([expectedAddress]);
    expect(mockBatchGetAddresses).toHaveBeenCalledWith(
      expect.objectContaining({
        chainExtraParams: expect.objectContaining({
          localWalletAddressForm: 'private',
          expectedAddress,
        }),
      }),
    );
  });

  it('复用真实外层 lease，避免 prepareAccounts 重入时等待自己持有的硬件锁', async () => {
    const manager = new HardwareProcessingManager();
    const withHardwareProcessing = jest.fn(
      async (
        operation: () => Promise<unknown>,
        options: { oneKeyOperationLease?: IOneKeyHardwareOperationLease },
      ) =>
        manager.runExclusiveOneKeyOperation({
          deviceKey: 'device-1',
          lease: options.oneKeyOperationLease,
          operation: () => operation(),
        }),
    );
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardwareUI: {
          withHardwareProcessing,
        },
      },
    });
    service.getPrepareHDOrHWAccountsParams = jest.fn(async () => ({
      prepareParams: {},
      deviceParams: {
        dbDevice: {
          id: 'device-1',
        },
      },
      networkId: 'evm--1',
      walletId: 'hw-1',
    })) as unknown as typeof service.getPrepareHDOrHWAccountsParams;

    const nestedFlow = manager.runExclusiveOneKeyOperation({
      deviceKey: 'device-1',
      operation: (oneKeyOperationLease) =>
        service.prepareHdOrHwAccounts({
          walletId: 'hw-1',
          networkId: 'evm--1',
          deriveType: 'default',
          indexedAccountId: undefined,
          oneKeyOperationLease,
        } as Parameters<typeof service.prepareHdOrHwAccounts>[0]),
    });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('nested hardware operation deadlocked')),
        500,
      );
    });

    await expect(Promise.race([nestedFlow, timeout])).resolves.toMatchObject({
      accounts: [],
    });
    clearTimeout(timeoutId);

    expect(withHardwareProcessing).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        oneKeyOperationLease: expect.objectContaining({
          deviceKey: 'device-1',
        }),
      }),
    );
    expect(mockPrepareAccounts).toHaveBeenCalledTimes(1);
  });

  it('复用真实外层 lease，避免验证地址进入 previewBatchBuildAccounts 时死锁', async () => {
    const manager = new HardwareProcessingManager();
    const withHardwareProcessing = jest.fn(
      async (
        operation: (lease: IOneKeyHardwareOperationLease) => Promise<unknown>,
        options: { oneKeyOperationLease?: IOneKeyHardwareOperationLease },
      ) =>
        manager.runExclusiveOneKeyOperation({
          deviceKey: 'device-1',
          lease: options.oneKeyOperationLease,
          operation,
        }),
    );
    const deviceParams = {
      dbDevice: {
        id: 'device-1',
      },
    };
    const backgroundApi = {
      serviceAccount: {
        getWalletDeviceParams: jest.fn(async () => deviceParams),
      },
      serviceHardwareUI: {
        closeHardwareUiStateDialog: jest.fn(async () => undefined),
        withHardwareProcessing,
      },
      serviceNetwork: {
        getVaultSettings: jest.fn(async () => ({ accountType: 'simple' })),
      },
    } as Record<string, unknown>;
    const serviceBatchCreateAccount = new ServiceBatchCreateAccount({
      backgroundApi,
    });
    Object.assign(serviceBatchCreateAccount, {
      buildBatchCreateAccountsNetworksParams: jest.fn(async () => []),
      getHwAllNetworkPrepareAccountsResponse: jest.fn(async () => ({
        destroy: jest.fn(),
      })),
      batchBuildAccounts: jest.fn(async () => ({
        accountsForCreate: [{ address: '0x1234' }],
      })),
    });
    Object.assign(backgroundApi, { serviceBatchCreateAccount });

    const service = new ServiceAccount({ backgroundApi });
    service.getPrepareHDOrHWAccountsParams = jest.fn(async () => ({
      prepareParams: { indexes: [0] },
      deviceParams,
      networkId: 'evm--1',
      walletId: 'hw-1',
    })) as unknown as typeof service.getPrepareHDOrHWAccountsParams;

    const verifyFlow = service.verifyHWAccountAddresses({
      walletId: 'hw-1',
      networkId: 'evm--1',
      indexes: [0],
      indexedAccountId: undefined,
      deriveType: 'default',
    });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('verify address hardware operation deadlocked')),
        500,
      );
    });

    await expect(Promise.race([verifyFlow, timeout])).resolves.toEqual([
      '0x1234',
    ]);
    clearTimeout(timeoutId);

    expect(withHardwareProcessing).toHaveBeenCalledTimes(2);
    expect(withHardwareProcessing).toHaveBeenLastCalledWith(
      expect.any(Function),
      expect.objectContaining({
        oneKeyOperationLease: expect.objectContaining({
          deviceKey: 'device-1',
        }),
      }),
    );
  });

  it('从批量建账号入口透传 lease 到 prepareHdOrHwAccounts', async () => {
    const manager = new HardwareProcessingManager();
    const withHardwareProcessing = jest.fn(
      async (
        operation: (lease: IOneKeyHardwareOperationLease) => Promise<unknown>,
        options: { oneKeyOperationLease?: IOneKeyHardwareOperationLease },
      ) =>
        manager.runExclusiveOneKeyOperation({
          deviceKey: 'device-1',
          lease: options.oneKeyOperationLease,
          operation,
        }),
    );
    const deviceParams = {
      dbDevice: {
        id: 'device-1',
      },
    };
    const backgroundApi = {
      serviceHardwareUI: {
        withHardwareProcessing,
      },
      serviceNetwork: {
        getVaultSettings: jest.fn(async () => ({
          mergeDeriveAssetsEnabled: false,
        })),
      },
      servicePrimeTransfer: {
        isInTransferImportOrBackupRestoreFlow: jest.fn(async () => false),
      },
    } as Record<string, unknown>;
    const serviceAccount = new ServiceAccount({ backgroundApi });
    serviceAccount.getPrepareHDOrHWAccountsParams = jest.fn(async () => ({
      prepareParams: {},
      deviceParams,
      networkId: 'evm--1',
      walletId: 'hw-1',
    })) as unknown as typeof serviceAccount.getPrepareHDOrHWAccountsParams;
    Object.assign(serviceAccount, {
      getWalletDeviceParams: jest.fn(async () => deviceParams),
    });
    Object.assign(backgroundApi, { serviceAccount });

    const serviceBatchCreateAccount = new ServiceBatchCreateAccount({
      backgroundApi,
    });
    const buildBatchCreateAccountsNetworksParams = jest.fn(async () => [
      {
        walletId: 'hw-1',
        networkId: 'evm--1',
        deriveType: 'default',
        indexes: [0],
      },
    ]);
    const getHwAllNetworkPrepareAccountsResponse = jest.fn(
      async () => undefined,
    );
    Object.assign(serviceBatchCreateAccount, {
      buildBatchCreateAccountsNetworksParams,
      getHwAllNetworkPrepareAccountsResponse,
    });
    const batchBuildAccounts = jest.spyOn(
      serviceBatchCreateAccount,
      'batchBuildAccounts',
    );
    const prepareHdOrHwAccounts = jest.spyOn(
      serviceAccount,
      'prepareHdOrHwAccounts',
    );

    const batchFlow = serviceBatchCreateAccount.startBatchCreateAccountsFlow({
      mode: 'normal',
      params: {
        walletId: 'hw-1',
        networkId: 'evm--1',
        deriveType: 'default',
        indexes: [0],
        saveToDb: false,
      },
    });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('batch account hardware operation deadlocked')),
        500,
      );
    });

    await expect(Promise.race([batchFlow, timeout])).resolves.toMatchObject({
      accountsForCreate: [],
    });
    clearTimeout(timeoutId);

    expect(withHardwareProcessing).toHaveBeenCalledTimes(2);
    expect(withHardwareProcessing).toHaveBeenLastCalledWith(
      expect.any(Function),
      expect.objectContaining({
        oneKeyOperationLease: expect.objectContaining({
          deviceKey: 'device-1',
        }),
      }),
    );
    expect(buildBatchCreateAccountsNetworksParams).toHaveBeenCalledTimes(1);
    expect(getHwAllNetworkPrepareAccountsResponse).toHaveBeenCalledTimes(1);
    expect(batchBuildAccounts).toHaveBeenCalledTimes(1);
    expect(prepareHdOrHwAccounts).toHaveBeenCalledTimes(1);
  });
});
