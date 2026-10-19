import ServiceThirdPartyHardware from '.';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import localDb from '../../dbs/local/localDb';
import ServiceBatchCreateAccount from '../ServiceBatchCreateAccount/ServiceBatchCreateAccount';
import { HardwareAllNetworkGetAddressResponse } from '../ServiceHardware/HardwareAllNetworkGetAddressResponse';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

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

function buildService() {
  jest.spyOn(localDb, 'getExistingDevice').mockResolvedValue(undefined);
  const walletIdentity = 'ab'.repeat(32);
  const created = { wallet: { id: 'hw-keystone-test', isTemp: true } };
  const createHWWallet = jest.fn().mockResolvedValue(created);
  const backgroundApi = {
    serviceAccount: {
      createHWWallet,
      getWalletDeviceParams: jest.fn().mockResolvedValue(undefined),
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
  Object.assign(batchService, {
    buildBatchCreateAccountsNetworksParams: jest.fn().mockResolvedValue([
      { networkId: 'evm--1', deriveType: 'default' },
      { networkId: 'btc--0', deriveType: 'default' },
    ]),
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
  Object.assign(service, {
    buildThirdPartyDefaultNetworkBundle: jest
      .fn()
      .mockResolvedValue([{ network: 'evm', path }]),
    getAdapterForVendor: jest.fn().mockResolvedValue({
      hw: {
        allNetworkGetAddress,
        getDeviceInfo: jest.fn().mockResolvedValue({
          success: true,
          payload: { model: 'Keystone' },
        }),
      },
    }),
  });
  return {
    service,
    created,
    createHWWallet,
    batchBuildAccounts,
    allNetworkGetAddress,
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
