import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import ServiceBatchCreateAccount, {
  bindThirdPartyAllNetworkGetAddress,
  getLedgerAllNetworkDeviceIdentity,
} from './ServiceBatchCreateAccount';

import type { IDBDevice } from '../../dbs/local/types';

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
    hardware: {
      sdkLog: {
        consoleLog: jest.fn(),
        log: jest.fn(),
      },
    },
    account: {
      batchCreatePerf: new Proxy(
        {},
        {
          get: () => jest.fn(),
        },
      ),
    },
  },
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

describe('ServiceBatchCreateAccount Trezor all-network', () => {
  const originalIsDesktop = platformEnv.isDesktop;
  const originalIsSupportDesktopBle = platformEnv.isSupportDesktopBle;

  afterEach(() => {
    (platformEnv as { isDesktop: boolean | undefined }).isDesktop =
      originalIsDesktop;
    (
      platformEnv as { isSupportDesktopBle: boolean | undefined }
    ).isSupportDesktopBle = originalIsSupportDesktopBle;
  });

  it('reads Ledger chain fingerprint from deviceIdentity before legacy fields', () => {
    expect(
      getLedgerAllNetworkDeviceIdentity({
        deviceIdentity: {
          vendor: 'ledger',
          type: 'chainFingerprint',
          chain: 'evm',
          value: 'new-fingerprint',
        },
        chainFingerprint: 'legacy-fingerprint',
        chainFingerprintChain: 'evm',
      }),
    ).toEqual({
      chain: 'evm',
      fingerprint: 'new-fingerprint',
    });
  });

  it('does not treat Trezor deviceIdentity as a Ledger chain fingerprint', () => {
    expect(
      getLedgerAllNetworkDeviceIdentity({
        deviceIdentity: {
          vendor: 'trezor',
          type: 'deviceId',
          value: 'trezor-device-id',
        },
      }),
    ).toBeUndefined();
  });

  it('binds third-party all-network get-address to preserve SDK adapter this context', async () => {
    const thirdPartyHw = {
      deviceId: 'FEATURES_DEVICE_ID',
      async allNetworkGetAddress(connectId: string) {
        return {
          success: false as const,
          payload: {
            code: HardwareErrorCode.DeviceNotFound,
            error: this.deviceId,
            errorCode: HardwareErrorCode.DeviceNotFound,
            connectId,
            deviceId: this.deviceId,
          },
        };
      },
    };

    const allNetworkGetAddress =
      bindThirdPartyAllNetworkGetAddress(thirdPartyHw);

    await expect(
      allNetworkGetAddress?.('USB_CONNECT_ID', 'FEATURES_DEVICE_ID', {
        bundle: [],
      }),
    ).resolves.toMatchObject({
      success: false,
      payload: {
        connectId: 'USB_CONNECT_ID',
        deviceId: 'FEATURES_DEVICE_ID',
        error: 'FEATURES_DEVICE_ID',
      },
    });
  });

  it('requests BLE binding and retries all-network get-address when USB transport is down', async () => {
    (platformEnv as { isDesktop: boolean }).isDesktop = true;
    (platformEnv as { isSupportDesktopBle: boolean }).isSupportDesktopBle =
      true;
    const dbDevice = {
      id: 'db-device-1',
      connectId: 'USB_CONNECT_ID',
      usbConnectId: 'USB_CONNECT_ID',
      deviceId: 'FEATURES_DEVICE_ID',
      vendor: EHardwareVendor.trezor,
      settingsRaw: JSON.stringify({
        vendor: 'trezor',
        vendorModel: 'T3W1',
        vendorModelName: 'Safe 7',
      }),
    } as IDBDevice;
    const allNetworkGetAddress = jest
      .fn()
      .mockResolvedValueOnce({
        success: false,
        payload: {
          code: HardwareErrorCode.DeviceNotFound,
          error: 'DeviceNotFound',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        payload: [
          {
            success: true,
            network: 'evm',
            path: "m/44'/60'/0'/0/0",
            payload: {
              address: '0x1234',
            },
          },
        ],
      });
    const requestTrezorBleConnectIdForDevice = jest.fn(async () => 'BLE_ID');
    const service = new ServiceBatchCreateAccount({
      backgroundApi: {
        serviceThirdPartyHardware: {
          requestTrezorBleConnectIdForDevice,
        },
      },
    });

    const result = await (
      service as unknown as {
        callThirdPartyAllNetworkGetAddress: (
          params: unknown,
        ) => Promise<unknown>;
      }
    ).callThirdPartyAllNetworkGetAddress({
      allNetworkGetAddress,
      connectId: dbDevice.connectId,
      deviceId: dbDevice.deviceId,
      dbDeviceId: dbDevice.id,
      dbDevice,
      vendor: EHardwareVendor.trezor,
      createSceneParams: {},
      bundleParams: [
        {
          network: 'evm',
          path: "m/44'/60'/0'/0/0",
          showOnOneKey: false,
        },
      ],
      vendorName: 'Trezor',
    });

    expect(result).toEqual([
      {
        success: true,
        network: 'evm',
        path: "m/44'/60'/0'/0/0",
        payload: {
          address: '0x1234',
        },
      },
    ]);
    expect(allNetworkGetAddress).toHaveBeenCalledTimes(2);
    expect(allNetworkGetAddress.mock.calls[0][0]).toBe('USB_CONNECT_ID');
    expect(allNetworkGetAddress.mock.calls[1][0]).toBe('BLE_ID');
    expect(requestTrezorBleConnectIdForDevice).toHaveBeenCalledWith({
      device: dbDevice,
    });
  });
});
