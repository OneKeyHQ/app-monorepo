import ServiceThirdPartyHardware from '.';

import { UI_REQUEST } from '@onekeyfe/hwk-adapter-core';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDevice } from '../../dbs/local/types';
import type { IThirdPartyHardwareAdapter } from '../ServiceHardware/adapters/types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getDeviceByQuery: jest.fn(),
    updateDeviceConnectId: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: {
      sdkLog: {
        log: jest.fn(),
      },
    },
  },
}));

const mockedLocalDb = jest.mocked(localDb);

describe('ServiceThirdPartyHardware Trezor BLE binding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('matches the Trezor DB device before persisting bleConnectId', async () => {
    const dbDevice = {
      id: 'db-device-1',
      connectId: 'USB_CONNECT_ID',
      usbConnectId: 'USB_CONNECT_ID',
      deviceId: 'FEATURES_DEVICE_ID',
    } as IDBDevice;
    const adapter = {
      hw: {
        on: jest.fn(),
        off: jest.fn(),
        cancel: jest.fn(),
      },
      connectDevice: jest.fn().mockResolvedValue({
        success: true,
        payload: {
          deviceId: 'FEATURES_DEVICE_ID',
        },
      }),
      disconnect: jest.fn().mockResolvedValue(undefined),
    } as unknown as IThirdPartyHardwareAdapter;
    mockedLocalDb.getDeviceByQuery.mockResolvedValue(dbDevice);

    const service = new ServiceThirdPartyHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    (
      service as unknown as {
        thirdPartyAdapters: Map<string, IThirdPartyHardwareAdapter>;
      }
    ).thirdPartyAdapters.set('trezor', adapter);

    await expect(
      service.bindTrezorBleConnectId({
        usbConnectId: 'USB_CONNECT_ID',
        featuresDeviceId: 'FEATURES_DEVICE_ID',
        bleConnectId: 'BLE_CONNECT_ID',
      }),
    ).resolves.toBe('BLE_CONNECT_ID');

    expect(adapter.hw.on).toHaveBeenCalledWith(
      UI_REQUEST.REQUEST_TREZOR_THP_PAIRING,
      expect.any(Function),
    );
    expect(mockedLocalDb.getDeviceByQuery).toHaveBeenCalledWith({
      connectId: 'USB_CONNECT_ID',
      featuresDeviceId: 'FEATURES_DEVICE_ID',
      vendor: 'trezor',
    });
    expect(mockedLocalDb.updateDeviceConnectId).toHaveBeenCalledWith({
      dbDeviceId: 'db-device-1',
      bleConnectId: 'BLE_CONNECT_ID',
    });
    expect(adapter.disconnect).toHaveBeenCalledWith('BLE_CONNECT_ID');
  });

  it('passes waitForAllTransports to Trezor adapter search', async () => {
    const adapter = {
      searchDevices: jest.fn().mockResolvedValue([]),
    } as unknown as IThirdPartyHardwareAdapter;
    const service = new ServiceThirdPartyHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    (
      service as unknown as {
        thirdPartyAdapters: Map<string, IThirdPartyHardwareAdapter>;
      }
    ).thirdPartyAdapters.set('trezor', adapter);

    await service.searchDevices({
      vendor: EHardwareVendor.trezor,
      waitForAllTransports: true,
    });

    expect(adapter.searchDevices).toHaveBeenCalledWith({
      resetSession: undefined,
      waitForAllTransports: true,
    });
  });

  it('delegates Trezor passphraseState resolution to the Trezor adapter', async () => {
    const adapter = {
      getPassphraseState: jest.fn().mockResolvedValue({
        success: true,
        payload: 'PASSPHRASE_STATE',
      }),
    } as unknown as IThirdPartyHardwareAdapter;
    const service = new ServiceThirdPartyHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    (
      service as unknown as {
        thirdPartyAdapters: Map<string, IThirdPartyHardwareAdapter>;
      }
    ).thirdPartyAdapters.set('trezor', adapter);

    await expect(
      service.getTrezorPassphraseState({
        connectId: 'TREZOR-USB',
      }),
    ).resolves.toBe('PASSPHRASE_STATE');

    expect(adapter.getPassphraseState).toHaveBeenCalledWith(
      'TREZOR-USB',
      undefined,
    );
  });
});
