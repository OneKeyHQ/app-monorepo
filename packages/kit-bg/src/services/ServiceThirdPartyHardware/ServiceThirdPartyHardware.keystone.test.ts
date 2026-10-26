import ServiceThirdPartyHardware from '.';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { INDEX_PLACEHOLDER } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import localDb from '../../dbs/local/localDb';
import ServiceBatchCreateAccount from '../ServiceBatchCreateAccount/ServiceBatchCreateAccount';
import { HardwareAllNetworkGetAddressResponse } from '../ServiceHardware/HardwareAllNetworkGetAddressResponse';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IAccountDeriveTypes } from '../../vaults/types';

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

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    account: { batchCreatePerf: new Proxy({}, { get: () => jest.fn() }) },
  },
}));

function buildService({ realAccountPlan = false } = {}) {
  jest.spyOn(localDb, 'getExistingDevice').mockResolvedValue(undefined);
  const walletIdentity = 'ab'.repeat(32);
  const created = { wallet: { id: 'hw-keystone-test', isTemp: true } };
  const createHWWallet = jest.fn().mockResolvedValue(created);
  const networkIds = getNetworkIdsMap();
  const backgroundApi = {
    serviceAccount: {
      createHWWallet,
      getWalletDeviceParams: jest.fn().mockResolvedValue(undefined),
    },
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: jest.fn().mockResolvedValue(undefined),
      getDeriveInfoOfNetwork: jest.fn(
        async ({
          networkId,
          deriveType,
        }: {
          networkId: string;
          deriveType: IAccountDeriveTypes;
        }) => {
          const btcPurpose = { default: 49, BIP44: 44, BIP84: 84, BIP86: 86 };
          const templates = {
            [networkIds.eth]: `m/44'/60'/0'/0/${INDEX_PLACEHOLDER}`,
            [networkIds.trx]: `m/44'/195'/0'/0/${INDEX_PLACEHOLDER}`,
            [networkIds.sol]: `m/44'/501'/${INDEX_PLACEHOLDER}'/0'`,
          };
          return {
            template:
              networkId === networkIds.btc
                ? `m/${btcPurpose[deriveType as keyof typeof btcPurpose]}'/0'/${INDEX_PLACEHOLDER}'/0/0`
                : templates[networkId],
          };
        },
      ),
    },
    serviceHardwareUI: {
      withHardwareProcessing: async (
        operation: () => Promise<unknown>,
        options: { onFinally?: () => void },
      ) => {
        try {
          return await operation();
        } finally {
          options.onFinally?.();
        }
      },
    },
  };
  const batchService = new ServiceBatchCreateAccount({ backgroundApi });
  const batchBuildAccounts = jest
    .fn()
    .mockResolvedValue({ accountsForCreate: [] });
  const buildBatchNetworks = jest.fn(
    async (params: {
      walletId: string;
      customNetworks: { networkId: string; deriveType: IAccountDeriveTypes }[];
    }) =>
      params.customNetworks.map((item) => ({
        ...item,
        walletId: params.walletId,
      })),
  );
  Object.assign(batchService, {
    buildBatchCreateAccountsNetworksParams: buildBatchNetworks,
    batchBuildAccounts,
    recordPrimeTransferImportBatchCreateTrace: jest.fn(),
    emitBatchCreateDoneEvents: jest.fn(),
    clearHdCredentialCacheScope: jest.fn(),
  });
  const service = new ServiceThirdPartyHardware({
    backgroundApi: {
      ...backgroundApi,
      serviceBatchCreateAccount: batchService,
    } as unknown as IBackgroundApi,
  });
  const path = "m/44'/60'/0'/0/0";
  const allNetworkGetAddress = jest.fn().mockResolvedValue({
    success: true,
    payload: [
      {
        network: 'evm',
        path,
        success: true,
        payload: {
          address: `0x${'11'.repeat(20)}`,
          deviceIdentity: { type: 'walletId', value: walletIdentity },
        },
      },
    ],
  });
  const getDeviceInfo = jest.fn().mockResolvedValue({
    success: true,
    payload: {
      vendor: 'keystone',
      model: 'Keystone',
      deviceId: walletIdentity,
      connectId: 'keystone-connection',
      connectionType: 'usb',
      firmwareVersion: '3.1.4',
    },
  });
  Object.assign(service, {
    ...(!realAccountPlan
      ? {
          buildKeystoneDefaultAccountPlan: jest.fn().mockResolvedValue({
            bundle: [{ network: 'evm', path }],
            networks: [
              { networkId: networkIds.eth, deriveType: 'default' },
              { networkId: networkIds.btc, deriveType: 'default' },
            ],
          }),
        }
      : {}),
    getAdapterForVendor: jest.fn().mockResolvedValue({
      hw: {
        allNetworkGetAddress,
        getDeviceInfo,
      },
    }),
  });
  return {
    service,
    created,
    createHWWallet,
    batchBuildAccounts,
    buildBatchNetworks,
    allNetworkGetAddress,
    getDeviceInfo,
    walletIdentity,
  };
}

describe('Keystone default account creation', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([false, true])(
    'returns the wallet after success, USB=%s',
    async (usb) => {
      const fixture = buildService();
      const destroy = jest.spyOn(
        HardwareAllNetworkGetAddressResponse.prototype,
        'destroy',
      );
      const params = usb
        ? {
            usb: {
              operationId: 'keystone-operation',
              device: {
                connectId: 'keystone-connection',
                deviceId: fixture.walletIdentity,
                usbConnectId: 'keystone-usb-serial',
                name: 'Keystone',
                deviceType: EDeviceType.Unknown,
                uuid: '',
              },
            },
          }
        : {};
      await expect(
        fixture.service.createKeystoneWalletWithDefaultAccounts(params),
      ).resolves.toMatchObject(fixture.created);
      expect(fixture.batchBuildAccounts).toHaveBeenCalledTimes(2);
      expect(fixture.allNetworkGetAddress).toHaveBeenCalledTimes(1);
      expect(fixture.createHWWallet).toHaveBeenCalledWith(
        expect.objectContaining({ defaultIsTemp: true }),
      );
      if (usb) {
        expect(fixture.createHWWallet).toHaveBeenCalledWith(
          expect.objectContaining({
            device: expect.objectContaining({
              connectId: null,
              deviceId: fixture.walletIdentity,
              usbConnectId: 'keystone-usb-serial',
            }),
          }),
        );
      }
      expect(destroy).toHaveBeenCalled();
    },
  );

  it('keys a QR wallet by deviceId and leaves connectId empty', async () => {
    const fixture = buildService();
    await fixture.service.createKeystoneWalletWithDefaultAccounts({});
    expect(fixture.createHWWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        device: expect.objectContaining({
          connectId: null,
          deviceId: fixture.walletIdentity,
        }),
      }),
    );
  });

  function withDeviceExport(
    accountExport = true,
    failureCode = HardwareErrorCode.DevicePathForbidden,
  ) {
    const fixture = buildService({ realAccountPlan: true });
    const path = "m/84'/0'/0'";
    Object.assign(fixture.created.wallet, {
      associatedDevice: 'export-device',
    });
    const pin = jest
      .spyOn(localDb, 'pinDeviceKeystoneAccountKeys')
      .mockResolvedValue([]);
    fixture.allNetworkGetAddress.mockImplementation(
      async (
        _operation: string,
        _device: string,
        params: { bundle: { network: string; path: string }[] },
      ) => ({
        success: true,
        payload: params.bundle.map((item) =>
          item.network === 'btc' && item.path === path
            ? {
                ...item,
                success: true,
                payload: {
                  accountExport,
                  deviceIdentity: {
                    type: 'walletId',
                    value: fixture.walletIdentity,
                  },
                  accountKey: { path, publicKey: '02aa', chainCode: 'cc' },
                },
              }
            : {
                ...item,
                success: false,
                payload: {
                  code: failureCode,
                  error: 'Account not exported',
                  params: { reason: 'account-not-exported' },
                },
              },
        ),
      }),
    );
    return { ...fixture, pin };
  }

  it('creates only exported QR accounts and pins keys without saving a scan preference', async () => {
    const fixture = withDeviceExport();
    await expect(
      fixture.service.createKeystoneWalletWithDefaultAccounts({}),
    ).resolves.toMatchObject(fixture.created);
    expect(fixture.batchBuildAccounts).toHaveBeenCalledTimes(1);
    expect(fixture.buildBatchNetworks).toHaveBeenCalledWith(
      expect.objectContaining({
        customNetworks: [
          { networkId: getNetworkIdsMap().btc, deriveType: 'BIP84' },
        ],
        includingDefaultNetworks: false,
      }),
    );
    expect(fixture.pin).toHaveBeenCalledWith({
      dbDeviceId: 'export-device',
      keys: { "btc:m/84'/0'/0'": '02aa:cc' },
    });
  });

  it('retains complete-response validation without explicit export selection', async () => {
    const fixture = withDeviceExport(false);
    await expect(
      fixture.service.createKeystoneWalletWithDefaultAccounts({}),
    ).rejects.toBeDefined();
    expect(fixture.createHWWallet).not.toHaveBeenCalled();
  });

  it('does not skip wallet mismatch errors in an account-export response', async () => {
    const fixture = withDeviceExport(true, HardwareErrorCode.DeviceMismatch);
    await expect(
      fixture.service.createKeystoneWalletWithDefaultAccounts({}),
    ).rejects.toMatchObject({ code: HardwareErrorCode.DeviceMismatch });
    expect(fixture.createHWWallet).not.toHaveBeenCalled();
    expect(fixture.pin).not.toHaveBeenCalled();
  });

  it('creates the default multi-network account plan for a USB connection', async () => {
    const fixture = buildService({ realAccountPlan: true });
    fixture.allNetworkGetAddress.mockImplementation(
      async (
        _operationId: string,
        _deviceId: string,
        params: { bundle: { network: string; path: string }[] },
      ) => ({
        success: true,
        payload: params.bundle.map(
          (item: { network: string; path: string }) => ({
            ...item,
            success: true,
            payload: {
              deviceIdentity: {
                type: 'walletId',
                value: fixture.walletIdentity,
              },
            },
          }),
        ),
      }),
    );
    await fixture.service.createKeystoneWalletWithDefaultAccounts({
      usb: {
        operationId: 'keystone-operation',
        device: {
          deviceId: fixture.walletIdentity,
          connectId: 'keystone-connection',
          name: 'Keystone',
          deviceType: EDeviceType.Unknown,
          uuid: '',
        },
      },
    });
    expect(fixture.getDeviceInfo).toHaveBeenCalledWith(
      'keystone-operation',
      fixture.walletIdentity,
    );
    const bundle = fixture.allNetworkGetAddress.mock.calls[0][2].bundle as {
      network: string;
    }[];
    expect(bundle).toHaveLength(7);
    expect(new Set(bundle.map((item) => item.network))).toEqual(
      new Set(['btc', 'evm', 'tron', 'sol']),
    );
    expect(fixture.buildBatchNetworks).toHaveBeenCalledWith(
      expect.objectContaining({
        includingDefaultNetworks: false,
        customNetworks: expect.arrayContaining([
          { networkId: getNetworkIdsMap().btc, deriveType: 'default' },
          { networkId: getNetworkIdsMap().btc, deriveType: 'BIP86' },
          { networkId: getNetworkIdsMap().btc, deriveType: 'BIP84' },
          { networkId: getNetworkIdsMap().btc, deriveType: 'BIP44' },
          { networkId: getNetworkIdsMap().eth, deriveType: 'default' },
          { networkId: getNetworkIdsMap().trx, deriveType: 'default' },
          { networkId: getNetworkIdsMap().sol, deriveType: 'default' },
        ]),
      }),
    );
    expect(fixture.batchBuildAccounts).toHaveBeenCalledTimes(7);
  });

  it('stops before exporting when the USB operation has ended', async () => {
    const fixture = buildService();
    fixture.getDeviceInfo.mockResolvedValue({
      success: false,
      payload: {
        code: HardwareErrorCode.OperationEnded,
        error: 'Operation ended',
      },
    });
    await expect(
      fixture.service.createKeystoneWalletWithDefaultAccounts({
        usb: {
          operationId: 'keystone-operation',
          device: {
            deviceId: fixture.walletIdentity,
            connectId: 'keystone-connection',
            name: 'Keystone',
            deviceType: EDeviceType.Unknown,
            uuid: '',
          },
        },
      }),
    ).rejects.toBeDefined();
    expect(fixture.allNetworkGetAddress).not.toHaveBeenCalled();
    expect(fixture.createHWWallet).not.toHaveBeenCalled();
  });

  it.each([0, 1])(
    'propagates a local failure at network index %s',
    async (index) => {
      const fixture = buildService();
      const error = new OneKeyLocalError('Account persistence failed');
      const destroy = jest.spyOn(
        HardwareAllNetworkGetAddressResponse.prototype,
        'destroy',
      );
      if (index === 1) {
        fixture.batchBuildAccounts.mockResolvedValueOnce({
          accountsForCreate: [],
        });
      }
      fixture.batchBuildAccounts.mockRejectedValueOnce(error);
      await expect(
        fixture.service.createKeystoneWalletWithDefaultAccounts({}),
      ).rejects.toBe(error);
      expect(fixture.batchBuildAccounts).toHaveBeenCalledTimes(index + 1);
      expect(destroy).toHaveBeenCalled();
    },
  );

  describe('account key pinning on import', () => {
    const ACCOUNT_PATH = "m/44'/60'/0'";

    function withExport(fixture: ReturnType<typeof buildService>) {
      Object.assign(fixture.created.wallet, {
        associatedDevice: 'keystone-db-device',
      });
      fixture.allNetworkGetAddress.mockResolvedValueOnce({
        success: true,
        payload: [
          {
            network: 'evm',
            path: `${ACCOUNT_PATH}/0/0`,
            success: true,
            payload: {
              address: `0x${'11'.repeat(20)}`,
              deviceIdentity: {
                type: 'walletId',
                value: fixture.walletIdentity,
              },
              accountKey: {
                path: ACCOUNT_PATH,
                publicKey: '02aa',
                chainCode: 'cc',
              },
            },
          },
        ],
      });
    }

    function withPinnedDevice(fixture: ReturnType<typeof buildService>) {
      withExport(fixture);
      jest
        .spyOn(localDb, 'getExistingDevice')
        .mockResolvedValue({ id: 'keystone-db-device' } as Awaited<
          ReturnType<typeof localDb.getExistingDevice>
        >);
    }

    it('refuses a re-import with another account key before writing the wallet', async () => {
      const fixture = buildService();
      withPinnedDevice(fixture);
      const pin = jest
        .spyOn(localDb, 'pinDeviceKeystoneAccountKeys')
        .mockResolvedValue([`evm:${ACCOUNT_PATH}`]);

      await expect(
        fixture.service.createKeystoneWalletWithDefaultAccounts({}),
      ).rejects.toMatchObject({ code: HardwareErrorCode.DeviceMismatch });
      expect(pin).toHaveBeenCalledWith({
        dbDeviceId: 'keystone-db-device',
        keys: { [`evm:${ACCOUNT_PATH}`]: '02aa:cc' },
      });
      expect(fixture.createHWWallet).not.toHaveBeenCalled();
      expect(fixture.batchBuildAccounts).not.toHaveBeenCalled();
    });

    it('pins a re-import once and creates the accounts when they match', async () => {
      const fixture = buildService();
      withPinnedDevice(fixture);
      const pin = jest
        .spyOn(localDb, 'pinDeviceKeystoneAccountKeys')
        .mockResolvedValue([]);

      await expect(
        fixture.service.createKeystoneWalletWithDefaultAccounts({}),
      ).resolves.toMatchObject(fixture.created);
      expect(pin).toHaveBeenCalledTimes(1);
      expect(pin.mock.invocationCallOrder[0]).toBeLessThan(
        fixture.createHWWallet.mock.invocationCallOrder[0],
      );
      expect(fixture.batchBuildAccounts).toHaveBeenCalled();
    });

    it('pins a first import on the record just created', async () => {
      const fixture = buildService();
      withExport(fixture);
      const pin = jest
        .spyOn(localDb, 'pinDeviceKeystoneAccountKeys')
        .mockResolvedValue([]);

      await expect(
        fixture.service.createKeystoneWalletWithDefaultAccounts({}),
      ).resolves.toMatchObject(fixture.created);
      expect(pin).toHaveBeenCalledTimes(1);
      expect(pin).toHaveBeenCalledWith({
        dbDeviceId: 'keystone-db-device',
        keys: { [`evm:${ACCOUNT_PATH}`]: '02aa:cc' },
      });
    });

    it('refuses an export that disagrees with itself before writing the wallet', async () => {
      const fixture = buildService();
      const item = (publicKey: string) => ({
        network: 'evm',
        path: `${ACCOUNT_PATH}/0/0`,
        success: true,
        payload: {
          address: `0x${'11'.repeat(20)}`,
          deviceIdentity: { type: 'walletId', value: fixture.walletIdentity },
          accountKey: { path: ACCOUNT_PATH, publicKey, chainCode: 'cc' },
        },
      });
      fixture.allNetworkGetAddress.mockResolvedValueOnce({
        success: true,
        payload: [item('02aa'), item('02bb')],
      });
      const pin = jest.spyOn(localDb, 'pinDeviceKeystoneAccountKeys');

      await expect(
        fixture.service.createKeystoneWalletWithDefaultAccounts({}),
      ).rejects.toMatchObject({ code: HardwareErrorCode.DeviceMismatch });
      expect(pin).not.toHaveBeenCalled();
      expect(fixture.createHWWallet).not.toHaveBeenCalled();
    });
  });

  it('does not create a wallet when device interaction rejects', async () => {
    const fixture = buildService();
    const error = new OneKeyLocalError('Device interaction cancelled');
    fixture.allNetworkGetAddress.mockRejectedValueOnce(error);
    await expect(
      fixture.service.createKeystoneWalletWithDefaultAccounts({}),
    ).rejects.toBe(error);
    expect(fixture.createHWWallet).not.toHaveBeenCalled();
    expect(fixture.batchBuildAccounts).not.toHaveBeenCalled();
  });
});
