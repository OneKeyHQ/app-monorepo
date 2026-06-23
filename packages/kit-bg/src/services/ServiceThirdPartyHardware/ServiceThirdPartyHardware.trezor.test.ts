import ServiceThirdPartyHardware from '.';

import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDevice } from '../../dbs/local/types';
import type { IThirdPartyHardwareAdapter } from '../ServiceHardware/adapters/types';

type ILocalDbMock = {
  getDeviceByQuery: jest.Mock;
  updateDeviceConnectId: jest.Mock;
};

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
        thirdPartySearchDevicesResponse: jest.fn(),
      },
    },
  },
}));

function getLocalDbMock(): ILocalDbMock {
  return jest.requireMock<{ default: ILocalDbMock }>('../../dbs/local/localDb')
    .default;
}

describe('ServiceThirdPartyHardware Trezor BLE binding', () => {
  const originalIsDesktop = platformEnv.isDesktop;
  const originalIsSupportDesktopBle = platformEnv.isSupportDesktopBle;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    (platformEnv as { isDesktop: boolean | undefined }).isDesktop =
      originalIsDesktop;
    (
      platformEnv as { isSupportDesktopBle: boolean | undefined }
    ).isSupportDesktopBle = originalIsSupportDesktopBle;
  });

  it('matches the Trezor DB device before persisting bleConnectId', async () => {
    const dbDevice = {
      id: 'db-device-1',
      connectId: 'USB_CONNECT_ID',
      usbConnectId: 'USB_CONNECT_ID',
      deviceId: 'FEATURES_DEVICE_ID',
    } as IDBDevice;
    const beginBindingProbe = jest.fn();
    const endBindingProbe = jest.fn();
    const connectDevice = jest.fn().mockResolvedValue({
      success: true,
      payload: {
        deviceId: 'FEATURES_DEVICE_ID',
      },
    });
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const { getDeviceByQuery, updateDeviceConnectId } = getLocalDbMock();
    const adapter = {
      hw: { cancel: jest.fn() },
      beginBindingProbe,
      endBindingProbe,
      connectDevice,
      disconnect,
    } as unknown as IThirdPartyHardwareAdapter;
    getDeviceByQuery.mockResolvedValue(dbDevice);
    const emitSpy = jest
      .spyOn(appEventBus, 'emit')
      .mockReturnValue(true as never);

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

    // Binding probe suppresses the THP pairing dialog for the probed candidate,
    // then clears it when done.
    expect(beginBindingProbe).toHaveBeenCalledWith('BLE_CONNECT_ID');
    expect(endBindingProbe).toHaveBeenCalled();
    // Notifies the device-details UI so the bind row updates without a reopen.
    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.HardwareFeaturesUpdate,
      { deviceId: 'db-device-1' },
    );
    emitSpy.mockRestore();
    expect(getDeviceByQuery).toHaveBeenCalledWith({
      connectId: 'USB_CONNECT_ID',
      featuresDeviceId: 'FEATURES_DEVICE_ID',
      vendor: 'trezor',
    });
    expect(updateDeviceConnectId).toHaveBeenCalledWith({
      dbDeviceId: 'db-device-1',
      bleConnectId: 'BLE_CONNECT_ID',
    });
    expect(disconnect).toHaveBeenCalledWith('BLE_CONNECT_ID');
  });

  it('passes waitForAllTransports to Trezor adapter search', async () => {
    const searchDevices = jest.fn().mockResolvedValue([]);
    const adapter = {
      searchDevices,
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

    expect(searchDevices).toHaveBeenCalledWith({
      resetSession: undefined,
      waitForAllTransports: true,
    });
  });

  it('filters Trezor search results by requested transport type', async () => {
    const searchDevices = jest.fn().mockResolvedValue([
      {
        connectId: 'USB_CONNECT_ID',
        deviceId: 'USB_DEVICE_ID',
        name: 'Trezor USB',
        connectionType: 'usb',
      },
      {
        connectId: 'BLE_CONNECT_ID',
        deviceId: 'BLE_DEVICE_ID',
        name: 'Trezor BLE',
        connectionType: 'ble',
      },
    ]);
    const adapter = {
      searchDevices,
    } as unknown as IThirdPartyHardwareAdapter;
    const service = new ServiceThirdPartyHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    (
      service as unknown as {
        thirdPartyAdapters: Map<string, IThirdPartyHardwareAdapter>;
      }
    ).thirdPartyAdapters.set('trezor', adapter);

    const response = await service.searchDevices({
      vendor: EHardwareVendor.trezor,
      transportType: 'ble',
    });

    expect(response.success).toBe(true);
    expect(response.payload).toEqual([
      expect.objectContaining({
        connectId: 'BLE_CONNECT_ID',
        name: 'Trezor BLE',
        raw: expect.objectContaining({ connectionType: 'ble' }),
      }),
    ]);
  });

  it('does not request a Trezor BLE binding on platforms without desktop BLE support', async () => {
    (platformEnv as { isDesktop: boolean }).isDesktop = false;
    (platformEnv as { isSupportDesktopBle: boolean }).isSupportDesktopBle =
      false;
    const service = new ServiceThirdPartyHardware({
      backgroundApi: {} as IBackgroundApi,
    });

    await expect(
      service.requestTrezorBleConnectIdForDevice({
        device: {
          id: 'db-device-1',
          connectId: 'USB_CONNECT_ID',
          usbConnectId: 'USB_CONNECT_ID',
          deviceId: 'FEATURES_DEVICE_ID',
        } as IDBDevice,
      }),
    ).resolves.toBeNull();
  });

  it('delegates Trezor passphraseState resolution to the HWK wallet', async () => {
    const getPassphraseState = jest.fn().mockResolvedValue({
      success: true,
      payload: 'PASSPHRASE_STATE',
    });
    const adapter = {
      hw: {
        getPassphraseState,
      },
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

    expect(getPassphraseState).toHaveBeenCalledWith('TREZOR-USB', undefined);
  });

  it('falls back to bound BLE when the primary connectId is unreachable', async () => {
    // A BLE-only Trezor: the USB primary fails transport-down, so passphrase
    // state resolution must retry over the bound bleConnectId (same as signing).
    (platformEnv as { isDesktop: boolean }).isDesktop = true;
    (platformEnv as { isSupportDesktopBle: boolean }).isSupportDesktopBle =
      true;

    const getPassphraseState = jest
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
        payload: 'PASSPHRASE_STATE_BLE',
      });
    const adapter = {
      hw: { getPassphraseState },
    } as unknown as IThirdPartyHardwareAdapter;
    const service = new ServiceThirdPartyHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    (
      service as unknown as {
        thirdPartyAdapters: Map<string, IThirdPartyHardwareAdapter>;
      }
    ).thirdPartyAdapters.set('trezor', adapter);

    const dbDevice = {
      vendor: EHardwareVendor.trezor,
      deviceId: 'device-1',
      connectId: 'TREZOR-USB',
      usbConnectId: 'TREZOR-USB',
      bleConnectId: 'TREZOR-BLE',
    } as unknown as IDBDevice;

    await expect(
      service.getTrezorPassphraseState({ connectId: 'TREZOR-USB', dbDevice }),
    ).resolves.toBe('PASSPHRASE_STATE_BLE');

    expect(getPassphraseState).toHaveBeenNthCalledWith(
      1,
      'TREZOR-USB',
      undefined,
    );
    expect(getPassphraseState).toHaveBeenNthCalledWith(
      2,
      'TREZOR-BLE',
      undefined,
    );
  });

  it('throws converted SDK failures when resolving Trezor passphraseState', async () => {
    const getPassphraseState = jest.fn().mockResolvedValue({
      success: false,
      payload: {
        code: HardwareErrorCode.PinCancelled,
        error: 'Trezor device still locked after PIN attempt',
      },
    });
    const adapter = {
      hw: {
        getPassphraseState,
      },
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
    ).rejects.toMatchObject({
      code: HardwareErrorCode.PinCancelled,
      name: 'ThirdPartyHardwareError',
      autoToast: false,
    });
  });

  it('forwards passphraseState when deriving a third-party EVM address', async () => {
    const evmGetAddress = jest.fn().mockResolvedValue({
      success: true,
      payload: { address: '0xHiddenWalletAddress' },
    });
    const adapter = {
      hw: {
        evmGetAddress,
      },
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
      service.getEvmAddressByWalletState({
        vendor: EHardwareVendor.trezor,
        connectId: 'TREZOR-USB',
        deviceId: 'TREZOR-DEVICE-ID',
        path: "m/44'/60'/0'/0/0",
        passphraseState: 'PASSPHRASE_STATE',
      }),
    ).resolves.toBe('0xHiddenWalletAddress');

    expect(evmGetAddress).toHaveBeenCalledWith(
      'TREZOR-USB',
      'TREZOR-DEVICE-ID',
      {
        path: "m/44'/60'/0'/0/0",
        showOnDevice: false,
        passphraseState: 'PASSPHRASE_STATE',
        useEmptyPassphrase: undefined,
      },
    );
  });

  it('throws converted SDK failures when deriving a third-party EVM address', async () => {
    const evmGetAddress = jest.fn().mockResolvedValue({
      success: false,
      payload: {
        code: HardwareErrorCode.PassphraseStateMismatch,
        error: 'passphraseState mismatch',
      },
    });
    const adapter = {
      hw: {
        evmGetAddress,
      },
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
      service.getEvmAddressByWalletState({
        vendor: EHardwareVendor.trezor,
        connectId: 'TREZOR-USB',
        deviceId: 'TREZOR-DEVICE-ID',
        path: "m/44'/60'/0'/0/0",
        passphraseState: 'PASSPHRASE_STATE',
      }),
    ).rejects.toThrow('passphraseState mismatch');
  });
});
