import ServiceThirdPartyHardware from '.';

import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { thirdPartyHardwareUiStateAtom } from '../../states/jotai/atoms';

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

  it('treats a probe-suppressed pairing cancel as not-this-device', async () => {
    const connectDevice = jest.fn().mockResolvedValue({
      success: false,
      payload: {
        code: HardwareErrorCode.UserAborted,
        error: 'User aborted operation',
      },
    });
    const endBindingProbe = jest.fn();
    const { updateDeviceConnectId } = getLocalDbMock();
    const adapter = {
      beginBindingProbe: jest.fn(),
      endBindingProbe,
      wasBindingProbeCancelled: jest.fn().mockReturnValue(true),
      connectDevice,
      disconnect: jest.fn().mockResolvedValue(undefined),
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
      service.bindTrezorBleConnectId({
        usbConnectId: 'USB_CONNECT_ID',
        featuresDeviceId: 'FEATURES_DEVICE_ID',
        bleConnectId: 'BLE_CONNECT_ID',
      }),
    ).resolves.toBeNull();

    expect(updateDeviceConnectId).not.toHaveBeenCalled();
    expect(endBindingProbe).toHaveBeenCalled();
  });

  it('throws the real hardware error when the probe connect fails without a probe cancel', async () => {
    const connectDevice = jest.fn().mockResolvedValue({
      success: false,
      payload: {
        code: HardwareErrorCode.DeviceNotInitialized,
        error: 'Device not initialized',
      },
    });
    const adapter = {
      beginBindingProbe: jest.fn(),
      endBindingProbe: jest.fn(),
      wasBindingProbeCancelled: jest.fn().mockReturnValue(false),
      connectDevice,
      disconnect: jest.fn().mockResolvedValue(undefined),
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
      service.bindTrezorBleConnectId({
        usbConnectId: 'USB_CONNECT_ID',
        featuresDeviceId: 'FEATURES_DEVICE_ID',
        bleConnectId: 'BLE_CONNECT_ID',
      }),
    ).rejects.toMatchObject({
      code: HardwareErrorCode.DeviceNotInitialized,
      autoToast: true,
    });
  });

  it('does not mask a genuine user abort as device mismatch', async () => {
    // User cancel without the probe flag must throw, not read as mismatch.
    const connectDevice = jest.fn().mockResolvedValue({
      success: false,
      payload: {
        code: HardwareErrorCode.UserAborted,
        error: 'User aborted operation',
      },
    });
    const adapter = {
      beginBindingProbe: jest.fn(),
      endBindingProbe: jest.fn(),
      wasBindingProbeCancelled: jest.fn().mockReturnValue(false),
      connectDevice,
      disconnect: jest.fn().mockResolvedValue(undefined),
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
      service.bindTrezorBleConnectId({
        usbConnectId: 'USB_CONNECT_ID',
        featuresDeviceId: 'FEATURES_DEVICE_ID',
        bleConnectId: 'BLE_CONNECT_ID',
      }),
    ).rejects.toMatchObject({
      code: HardwareErrorCode.UserAborted,
      autoToast: false,
    });
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

  describe('requestTrezorBleConnectIdForDevice coalescing', () => {
    const deviceA = {
      id: 'db-device-1',
      connectId: 'USB_A',
      usbConnectId: 'USB_A',
      deviceId: 'DEVICE_A',
    } as IDBDevice;
    const deviceB = {
      id: 'db-device-2',
      connectId: 'USB_B',
      usbConnectId: 'USB_B',
      deviceId: 'DEVICE_B',
    } as IDBDevice;

    let atomSetSpy: jest.SpyInstance;
    let capturedResolves: Array<(value: string | null) => void>;
    let createCallback: jest.Mock;
    let service: ServiceThirdPartyHardware;

    beforeEach(() => {
      (platformEnv as { isSupportDesktopBle: boolean }).isSupportDesktopBle =
        true;
      atomSetSpy = jest
        .spyOn(thirdPartyHardwareUiStateAtom, 'set')
        .mockResolvedValue(undefined as never);
      capturedResolves = [];
      createCallback = jest.fn(
        ({ resolve }: { resolve: (value: string | null) => void }) => {
          capturedResolves.push(resolve);
          return capturedResolves.length;
        },
      );
      service = new ServiceThirdPartyHardware({
        backgroundApi: {
          servicePromise: { createCallback },
        } as unknown as IBackgroundApi,
      });
    });

    afterEach(() => {
      atomSetSpy.mockRestore();
    });

    it('coalesces concurrent binding requests for the same device onto one dialog', async () => {
      const first = service.requestTrezorBleConnectIdForDevice({
        device: deviceA,
      });
      const second = service.requestTrezorBleConnectIdForDevice({
        device: deviceA,
      });

      capturedResolves[0]('BLE_NEW');

      await expect(first).resolves.toBe('BLE_NEW');
      await expect(second).resolves.toBe('BLE_NEW');
      expect(createCallback).toHaveBeenCalledTimes(1);
      expect(atomSetSpy).toHaveBeenCalledTimes(1);
    });

    it('answers null immediately for a different device while a binding is in flight', async () => {
      const first = service.requestTrezorBleConnectIdForDevice({
        device: deviceA,
      });
      const second = service.requestTrezorBleConnectIdForDevice({
        device: deviceB,
      });

      await expect(second).resolves.toBeNull();
      expect(createCallback).toHaveBeenCalledTimes(1);

      capturedResolves[0](null);
      await expect(first).resolves.toBeNull();
    });

    it('allows a fresh binding request after the previous one settles', async () => {
      const first = service.requestTrezorBleConnectIdForDevice({
        device: deviceA,
      });
      capturedResolves[0](null);
      await expect(first).resolves.toBeNull();

      const second = service.requestTrezorBleConnectIdForDevice({
        device: deviceA,
      });
      capturedResolves[1]('BLE_RETRY');

      await expect(second).resolves.toBe('BLE_RETRY');
      expect(createCallback).toHaveBeenCalledTimes(2);
    });
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
