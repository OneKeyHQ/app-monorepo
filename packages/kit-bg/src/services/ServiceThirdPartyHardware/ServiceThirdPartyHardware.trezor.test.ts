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
  getDevice: jest.Mock;
  getDeviceByQuery: jest.Mock;
  getAllWallets: jest.Mock;
  getWalletDeviceSafe: jest.Mock;
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
    getDevice: jest.fn(),
    getDeviceByQuery: jest.fn(),
    getAllWallets: jest.fn(),
    getWalletDeviceSafe: jest.fn(),
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

// getWallets() does not carry dbAccounts for hardware wallets, so the service
// reads the account tables directly.
function buildBackgroundApi(wallet: {
  id: string;
  name: string;
  dbIndexedAccounts: unknown[];
  dbAccounts: unknown[];
}): IBackgroundApi {
  return {
    serviceAccount: {
      getWallets: jest.fn().mockResolvedValue({
        wallets: [{ id: wallet.id, name: wallet.name }],
      }),
      getAllAccounts: jest
        .fn()
        .mockResolvedValue({ accounts: wallet.dbAccounts }),
      getAllIndexedAccounts: jest
        .fn()
        .mockResolvedValue({ indexedAccounts: wallet.dbIndexedAccounts }),
    },
  } as unknown as IBackgroundApi;
}

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
    const flushThpCredentials = jest.fn().mockResolvedValue(undefined);
    const { getDeviceByQuery, updateDeviceConnectId } = getLocalDbMock();
    const adapter = {
      hw: { cancel: jest.fn() },
      beginBindingProbe,
      endBindingProbe,
      connectDevice,
      disconnect,
      flushThpCredentials,
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

    expect(beginBindingProbe).toHaveBeenCalledWith('BLE_CONNECT_ID');
    expect(endBindingProbe).toHaveBeenCalled();
    // Binding can mint fresh THP credentials; without this drain the user
    // re-enters the pairing code on every later connect. Must run before the
    // finally-block disconnect.
    expect(flushThpCredentials).toHaveBeenCalledWith('FEATURES_DEVICE_ID', {
      connectId: 'BLE_CONNECT_ID',
    });
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

  // An unreadable identity is "could not verify", not "different device":
  // reporting a mismatch would grey the user's own device out in the dialog.
  it('throws instead of reporting a mismatch when the candidate returns no device_id', async () => {
    const connectDevice = jest.fn().mockResolvedValue({
      success: true,
      payload: { connectId: 'BLE_CONNECT_ID', deviceId: '' },
    });
    const { updateDeviceConnectId } = getLocalDbMock();
    const adapter = {
      beginBindingProbe: jest.fn(),
      endBindingProbe: jest.fn(),
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
    ).rejects.toThrow();

    expect(updateDeviceConnectId).not.toHaveBeenCalled();
  });

  // A pairing request no longer counts as "not this device" — identity is
  // settled by the post-handshake device_id comparison. A user-aborted pairing
  // is a real failure and must surface, not resolve to a silent null.
  it('throws when the probe connect is aborted during pairing', async () => {
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
    ).rejects.toThrow();

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
    let connectDevice: jest.Mock;
    let disconnect: jest.Mock;

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
      connectDevice = jest.fn().mockResolvedValue({
        success: true,
        payload: {
          connectId: 'RECOVERED_CONNECT_ID',
          deviceId: deviceA.deviceId,
        },
      });
      disconnect = jest.fn().mockResolvedValue(undefined);
      (
        service as unknown as {
          thirdPartyAdapters: Map<string, IThirdPartyHardwareAdapter>;
        }
      ).thirdPartyAdapters.set('trezor', {
        connectDevice,
        disconnect,
      } as unknown as IThirdPartyHardwareAdapter);
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
      expect(connectDevice).toHaveBeenCalledTimes(1);
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

    it('rejects a recovered transport whose live features device_id does not match', async () => {
      connectDevice.mockResolvedValueOnce({
        success: true,
        payload: {
          connectId: 'WRONG_USB',
          deviceId: 'DIFFERENT_DEVICE_ID',
        },
      });
      const request = service.requestTrezorBleConnectIdForDevice({
        device: deviceA,
      });

      capturedResolves[0]('WRONG_USB');

      await expect(request).rejects.toThrow('does not match');
      expect(disconnect).toHaveBeenCalledWith('WRONG_USB');
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

describe('ServiceThirdPartyHardware authenticity and account name sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getLocalDbMock().getAllWallets.mockReset();
    getLocalDbMock().getAllWallets.mockResolvedValue({ wallets: [] });
  });

  it('rejects an unknown selected device before running authenticity', async () => {
    const verifyDeviceAuthenticity = jest.fn();
    getLocalDbMock().getDevice.mockResolvedValue(undefined);
    const adapter = {
      hw: { verifyDeviceAuthenticity },
    } as unknown as IThirdPartyHardwareAdapter;
    const service = new ServiceThirdPartyHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    (
      service as unknown as {
        thirdPartyAdapters: Map<string, IThirdPartyHardwareAdapter>;
      }
    ).thirdPartyAdapters.set('ledger', adapter);

    await expect(
      service.thirdPartyHardwareVerifyDeviceAuthenticity({
        vendor: EHardwareVendor.ledger,
        connectId: 'LEDGER-CONNECT-ID',
        dbDeviceId: 'missing-ledger',
      }),
    ).rejects.toThrow('The selected device could not be found');
    expect(verifyDeviceAuthenticity).not.toHaveBeenCalled();
  });

  it('rejects a selected device owned by another vendor', async () => {
    const verifyDeviceAuthenticity = jest.fn();
    getLocalDbMock().getDevice.mockResolvedValue({
      id: 'db-trezor',
      vendor: EHardwareVendor.trezor,
    } as IDBDevice);
    const adapter = {
      hw: { verifyDeviceAuthenticity },
    } as unknown as IThirdPartyHardwareAdapter;
    const service = new ServiceThirdPartyHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    (
      service as unknown as {
        thirdPartyAdapters: Map<string, IThirdPartyHardwareAdapter>;
      }
    ).thirdPartyAdapters.set('ledger', adapter);

    await expect(
      service.thirdPartyHardwareVerifyDeviceAuthenticity({
        vendor: EHardwareVendor.ledger,
        connectId: 'LEDGER-CONNECT-ID',
        dbDeviceId: 'db-trezor',
      }),
    ).rejects.toThrow(
      'The selected device vendor does not match the verification vendor',
    );
    expect(verifyDeviceAuthenticity).not.toHaveBeenCalled();
  });

  it('recovers over the bound Trezor transport before running a device authenticity check', async () => {
    const originalIsDesktop = platformEnv.isDesktop;
    const originalIsSupportDesktopBle = platformEnv.isSupportDesktopBle;
    (platformEnv as { isDesktop: boolean }).isDesktop = true;
    (platformEnv as { isSupportDesktopBle: boolean }).isSupportDesktopBle =
      true;
    try {
      const verifyDeviceAuthenticity = jest.fn().mockResolvedValueOnce({
        success: true,
        payload: {
          vendor: 'trezor',
          verified: true,
          deviceId: 'ab'.repeat(32),
        },
      });
      getLocalDbMock().getDevice.mockResolvedValue({
        id: 'db-trezor',
        vendor: EHardwareVendor.trezor,
        connectId: 'STALE-USB',
        usbConnectId: 'STALE-USB',
        bleConnectId: 'BOUND-BLE',
        deviceId: 'FEATURES-DEVICE-ID',
      } as IDBDevice);
      const connectDevice = jest
        .fn()
        .mockResolvedValueOnce({
          success: false,
          payload: {
            code: HardwareErrorCode.DeviceNotFound,
            error: 'Trezor device not found',
          },
        })
        .mockResolvedValueOnce({
          success: true,
          payload: { deviceId: 'FEATURES-DEVICE-ID' },
        });
      const adapter = {
        hw: { verifyDeviceAuthenticity },
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
        service.thirdPartyHardwareVerifyDeviceAuthenticity({
          vendor: EHardwareVendor.trezor,
          connectId: 'STALE-USB',
          dbDeviceId: 'db-trezor',
        }),
      ).resolves.toMatchObject({
        success: true,
        payload: { verified: true },
      });
      expect(verifyDeviceAuthenticity).toHaveBeenCalledTimes(1);
      expect(verifyDeviceAuthenticity).toHaveBeenCalledWith(
        'BOUND-BLE',
        expect.any(Object),
      );
      expect(connectDevice).toHaveBeenNthCalledWith(1, 'STALE-USB');
      expect(connectDevice).toHaveBeenNthCalledWith(2, 'BOUND-BLE');
    } finally {
      (platformEnv as { isDesktop: boolean | undefined }).isDesktop =
        originalIsDesktop;
      (
        platformEnv as { isSupportDesktopBle: boolean | undefined }
      ).isSupportDesktopBle = originalIsSupportDesktopBle;
    }
  });

  it('rejects a reused primary connectId before authenticating the wrong Trezor', async () => {
    const verifyDeviceAuthenticity = jest.fn();
    getLocalDbMock().getDevice.mockResolvedValue({
      id: 'db-trezor',
      vendor: EHardwareVendor.trezor,
      connectId: 'REUSED-USB',
      usbConnectId: 'REUSED-USB',
      deviceId: 'EXPECTED-FEATURES-DEVICE-ID',
    } as IDBDevice);
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const adapter = {
      hw: { verifyDeviceAuthenticity },
      connectDevice: jest.fn().mockResolvedValue({
        success: true,
        payload: { deviceId: 'OTHER-TREZOR-DEVICE-ID' },
      }),
      disconnect,
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
      service.thirdPartyHardwareVerifyDeviceAuthenticity({
        vendor: EHardwareVendor.trezor,
        connectId: 'REUSED-USB',
        dbDeviceId: 'db-trezor',
      }),
    ).rejects.toThrow(
      'The recovered Trezor device does not match the selected device',
    );
    expect(verifyDeviceAuthenticity).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledWith('REUSED-USB');
  });

  it('reads Trezor Suite accounts locally and associates them by deviceId without hardware calls', async () => {
    const originalIsDesktop = platformEnv.isDesktop;
    const originalDesktopApiProxy = globalThis.desktopApiProxy;
    const matchedAddress = 'bc1q-device-native-segwit-account-zero';
    const readTrezorSuiteAccountNames = jest.fn().mockResolvedValue({
      status: 'available',
      accounts: [
        {
          deviceId: 'TREZOR-DEVICE',
          name: 'Bitcoin #1',
          address: matchedAddress,
          path: "m/84'/0'/0'/0/0",
          accountType: 'normal',
          visible: true,
        },
        {
          deviceId: 'OTHER-TREZOR',
          name: 'Bitcoin #2',
          address: 'bc1q-other-suite-account-address',
          path: "m/84'/0'/1'/0/0",
          accountType: 'normal',
          visible: true,
        },
      ],
    });
    const backgroundApi = {
      serviceAccount: {
        getAllAccounts: jest.fn().mockResolvedValue({
          accounts: [
            {
              id: 'btc-account',
              indexedAccountId: 'hw-1--0',
              impl: 'btc',
              address: matchedAddress,
              addresses: null,
              path: "m/84'/0'/0'",
            },
          ],
        }),
        getAllIndexedAccounts: jest.fn().mockResolvedValue({
          indexedAccounts: [
            {
              id: 'hw-1--0',
              name: 'OneKey BTC Account',
              walletId: 'hw-1',
              index: 0,
              idHash: 'hash',
            },
          ],
        }),
      },
    } as unknown as IBackgroundApi;
    getLocalDbMock().getDevice.mockResolvedValue({
      id: 'db-trezor',
      vendor: EHardwareVendor.trezor,
      connectId: 'TREZOR-USB',
      deviceId: 'TREZOR-DEVICE',
    } as IDBDevice);
    getLocalDbMock().getAllWallets.mockResolvedValue({
      wallets: [
        {
          id: 'hw-1',
          name: 'Trezor Wallet',
          associatedDevice: 'db-trezor',
        },
      ],
    });
    (platformEnv as { isDesktop: boolean }).isDesktop = true;
    globalThis.desktopApiProxy = {
      system: { readTrezorSuiteAccountNames },
    } as never;
    const service = new ServiceThirdPartyHardware({ backgroundApi });
    jest.spyOn(service, 'isDevModeEnabled').mockResolvedValue(true);
    try {
      const inventory =
        await service.getThirdPartyGlobalAccountNameSourceInventory({
          vendor: EHardwareVendor.trezor,
          dbDeviceId: 'db-trezor',
        });

      expect(readTrezorSuiteAccountNames).toHaveBeenCalledTimes(1);
      expect(inventory.status).toBe('available');
      expect(inventory.accounts).toHaveLength(1);
      expect(inventory.accounts).toContainEqual(
        expect.objectContaining({
          sourceName: 'Bitcoin #1',
          address: matchedAddress,
          path: "m/84'/0'/0'/0/0",
          source: 'trezor-suite',
          sourceDeviceId: 'TREZOR-DEVICE',
          sourceAccountType: 'normal',
          selectedDeviceMatch: true,
          matchedOneKeyAccounts: [
            {
              indexedAccountId: 'hw-1--0',
              accountId: 'btc-account',
              walletId: 'hw-1',
              walletName: 'Trezor Wallet',
              currentName: 'OneKey BTC Account',
              networkId: 'btc',
              networkName: 'Bitcoin',
              networkImpl: 'btc',
              address: matchedAddress,
              path: "m/84'/0'/0'",
            },
          ],
        }),
      );
      expect(inventory.accounts).not.toContainEqual(
        expect.objectContaining({ sourceDeviceId: 'OTHER-TREZOR' }),
      );
      expect(inventory.selectedDevice).toEqual({
        dbDeviceId: 'db-trezor',
        deviceId: 'TREZOR-DEVICE',
        featuresDeviceId: undefined,
        connectId: 'TREZOR-USB',
        usbConnectId: undefined,
        bleConnectId: undefined,
      });
      expect(inventory.localAccounts).toEqual([
        {
          indexedAccountId: 'hw-1--0',
          accountId: 'btc-account',
          walletId: 'hw-1',
          walletName: 'Trezor Wallet',
          currentName: 'OneKey BTC Account',
          networkId: 'btc',
          networkName: 'Bitcoin',
          networkImpl: 'btc',
          address: matchedAddress,
          path: "m/84'/0'/0'",
        },
      ]);
    } finally {
      (platformEnv as { isDesktop: boolean | undefined }).isDesktop =
        originalIsDesktop;
      globalThis.desktopApiProxy = originalDesktopApiProxy;
    }
  });

  it('lists every parsed Ledger Live source account before filtering matches', async () => {
    const originalIsDesktop = platformEnv.isDesktop;
    const originalDesktopApiProxy = globalThis.desktopApiProxy;
    const readLedgerLiveAccountNames = jest.fn().mockResolvedValue({
      status: 'available',
      accounts: [
        {
          name: 'Ledger Main',
          address: '0x1111111111111111111111111111111111111111',
        },
        {
          name: 'Ledger Unmatched',
          address: '0x2222222222222222222222222222222222222222',
        },
      ],
    });
    (platformEnv as { isDesktop: boolean }).isDesktop = true;
    globalThis.desktopApiProxy = {
      system: {
        readLedgerLiveAccountNames,
      },
    } as never;
    try {
      const backgroundApi = {
        serviceAccount: {
          getAllAccounts: jest.fn().mockResolvedValue({
            accounts: [
              {
                id: 'evm-account',
                indexedAccountId: 'hw-1--0',
                impl: 'evm',
                address: '0x1111111111111111111111111111111111111111',
                addresses: {
                  'evm--1': '0x1111111111111111111111111111111111111111',
                  'evm--137': '0x1111111111111111111111111111111111111111',
                },
                createAtNetwork: 'evm--1',
                path: "m/44'/60'/0'/0/0",
              },
            ],
          }),
          getAllIndexedAccounts: jest.fn().mockResolvedValue({
            indexedAccounts: [
              {
                id: 'hw-1--0',
                name: 'OneKey EVM',
                walletId: 'hw-1',
                index: 0,
                idHash: 'hash',
              },
            ],
          }),
        },
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({
            networks: [
              { id: 'evm--1', name: 'Ethereum' },
              { id: 'evm--137', name: 'Polygon' },
            ],
          }),
        },
      } as unknown as IBackgroundApi;
      const service = new ServiceThirdPartyHardware({ backgroundApi });
      jest.spyOn(service, 'isDevModeEnabled').mockResolvedValue(true);

      const inventory =
        await service.getThirdPartyGlobalAccountNameSourceInventory({
          vendor: EHardwareVendor.ledger,
        });

      expect(inventory.status).toBe('available');
      expect(inventory.accounts).toEqual([
        {
          sourceName: 'Ledger Main',
          address: '0x1111111111111111111111111111111111111111',
          path: undefined,
          source: 'ledger-live',
          matchedOneKeyAccounts: [
            {
              indexedAccountId: 'hw-1--0',
              accountId: 'evm-account',
              walletId: 'hw-1',
              walletName: 'hw-1',
              currentName: 'OneKey EVM',
              networkId: 'evm--1',
              networkName: 'Ethereum',
              networkImpl: 'evm',
              address: '0x1111111111111111111111111111111111111111',
              path: "m/44'/60'/0'/0/0",
            },
            {
              indexedAccountId: 'hw-1--0',
              accountId: 'evm-account',
              walletId: 'hw-1',
              walletName: 'hw-1',
              currentName: 'OneKey EVM',
              networkId: 'evm--137',
              networkName: 'Polygon',
              networkImpl: 'evm',
              address: '0x1111111111111111111111111111111111111111',
              path: "m/44'/60'/0'/0/0",
            },
          ],
        },
        {
          sourceName: 'Ledger Unmatched',
          address: '0x2222222222222222222222222222222222222222',
          path: undefined,
          source: 'ledger-live',
          matchedOneKeyAccounts: [],
        },
      ]);
      expect(inventory.localAccounts).toEqual([
        {
          indexedAccountId: 'hw-1--0',
          accountId: 'evm-account',
          walletId: 'hw-1',
          walletName: 'hw-1',
          currentName: 'OneKey EVM',
          networkId: 'evm--1',
          networkName: 'Ethereum',
          networkImpl: 'evm',
          address: '0x1111111111111111111111111111111111111111',
          path: "m/44'/60'/0'/0/0",
        },
        {
          indexedAccountId: 'hw-1--0',
          accountId: 'evm-account',
          walletId: 'hw-1',
          walletName: 'hw-1',
          currentName: 'OneKey EVM',
          networkId: 'evm--137',
          networkName: 'Polygon',
          networkImpl: 'evm',
          address: '0x1111111111111111111111111111111111111111',
          path: "m/44'/60'/0'/0/0",
        },
      ]);

      readLedgerLiveAccountNames.mockResolvedValueOnce({
        status: 'source_not_found',
        accounts: [],
      });
      const localOnlyInventory =
        await service.getThirdPartyGlobalAccountNameSourceInventory({
          vendor: EHardwareVendor.ledger,
        });
      expect(localOnlyInventory).toEqual(
        expect.objectContaining({
          status: 'source_not_found',
          accounts: [],
          localAccounts: inventory.localAccounts,
        }),
      );
    } finally {
      (platformEnv as { isDesktop: boolean | undefined }).isDesktop =
        originalIsDesktop;
      globalThis.desktopApiProxy = originalDesktopApiProxy;
    }
  });

  it('rejects global name source reads when Developer Mode is disabled', async () => {
    const service = new ServiceThirdPartyHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    jest.spyOn(service, 'isDevModeEnabled').mockResolvedValue(false);

    await expect(
      service.getThirdPartyGlobalAccountNameSourceInventory({
        vendor: EHardwareVendor.ledger,
      }),
    ).rejects.toThrow('require Developer Mode');
  });
});

describe('getThirdPartyAccountNameCandidates', () => {
  const originalIsDesktop = platformEnv.isDesktop;
  const originalDesktopApiProxy = globalThis.desktopApiProxy;

  afterEach(() => {
    (platformEnv as { isDesktop: boolean }).isDesktop =
      Boolean(originalIsDesktop);
    globalThis.desktopApiProxy = originalDesktopApiProxy;
  });

  it('filters Trezor Suite accounts by the wallet deviceId', async () => {
    const mine = 'bc1qmine';
    const theirs = 'bc1qtheirs';
    (platformEnv as { isDesktop: boolean }).isDesktop = true;
    globalThis.desktopApiProxy = {
      system: {
        readTrezorSuiteAccountNames: jest.fn().mockResolvedValue({
          status: 'available',
          accounts: [
            { deviceId: 'DEV-A', name: 'Savings', address: mine },
            { deviceId: 'DEV-B', name: 'Other Device', address: theirs },
          ],
        }),
      },
    } as never;
    getLocalDbMock().getWalletDeviceSafe.mockResolvedValue({
      deviceId: 'dev-a',
      vendor: EHardwareVendor.trezor,
    } as IDBDevice);

    const service = new ServiceThirdPartyHardware({
      backgroundApi: buildBackgroundApi({
        id: 'hw-1',
        name: 'Trezor',
        dbIndexedAccounts: [
          { id: 'hw-1--0', name: 'Account 1', walletId: 'hw-1' },
        ],
        dbAccounts: [
          {
            id: 'a',
            indexedAccountId: 'hw-1--0',
            impl: 'btc',
            address: mine,
            path: "m/84'/0'/0'",
          },
        ],
      }),
    });

    const result = await service.getThirdPartyAccountNameCandidates({
      vendor: EHardwareVendor.trezor,
      walletId: 'hw-1',
    });
    expect(result.status).toBe('available');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].sourceNames).toEqual(['Savings']);
    expect(result.candidates[0].source).toBe('trezor-suite');
  });

  it('offers every Suite name when one indexed account has several derivations', async () => {
    (platformEnv as { isDesktop: boolean }).isDesktop = true;
    globalThis.desktopApiProxy = {
      system: {
        readTrezorSuiteAccountNames: jest.fn().mockResolvedValue({
          status: 'available',
          accounts: [
            { deviceId: 'DEV-A', name: 'Taproot Stash', address: 'bc1ptap' },
            { deviceId: 'DEV-A', name: 'SegWit Daily', address: 'bc1qseg' },
          ],
        }),
      },
    } as never;
    getLocalDbMock().getWalletDeviceSafe.mockResolvedValue({
      deviceId: 'DEV-A',
      vendor: EHardwareVendor.trezor,
    } as IDBDevice);

    const service = new ServiceThirdPartyHardware({
      backgroundApi: buildBackgroundApi({
        id: 'hw-1',
        name: 'Trezor',
        dbIndexedAccounts: [
          { id: 'hw-1--0', name: 'Account 1', walletId: 'hw-1' },
        ],
        dbAccounts: [
          {
            id: 'taproot',
            indexedAccountId: 'hw-1--0',
            impl: 'btc',
            address: 'bc1ptap',
            path: "m/86'/0'/0'",
          },
          {
            id: 'segwit',
            indexedAccountId: 'hw-1--0',
            impl: 'btc',
            address: 'bc1qseg',
            path: "m/84'/0'/0'",
          },
        ],
      }),
    });

    const result = await service.getThirdPartyAccountNameCandidates({
      vendor: EHardwareVendor.trezor,
      walletId: 'hw-1',
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].sourceNames.sort()).toEqual([
      'SegWit Daily',
      'Taproot Stash',
    ]);
  });

  it('matches Ledger accounts beyond the first one and beyond EVM', async () => {
    (platformEnv as { isDesktop: boolean }).isDesktop = true;
    globalThis.desktopApiProxy = {
      system: {
        readLedgerLiveAccountNames: jest.fn().mockResolvedValue({
          status: 'available',
          accounts: [
            { name: 'Ethereum 1', address: `0x${'ab'.repeat(20)}` },
            { name: 'Bitcoin 2', address: 'bc1qsecond' },
          ],
        }),
      },
    } as never;
    getLocalDbMock().getWalletDeviceSafe.mockResolvedValue({
      deviceId: 'ledger-device',
      vendor: EHardwareVendor.ledger,
    } as IDBDevice);

    const service = new ServiceThirdPartyHardware({
      backgroundApi: buildBackgroundApi({
        id: 'hw-1',
        name: 'Ledger',
        dbIndexedAccounts: [
          { id: 'hw-1--0', name: 'Account 1', walletId: 'hw-1' },
          { id: 'hw-1--1', name: 'Account 2', walletId: 'hw-1' },
        ],
        dbAccounts: [
          {
            id: 'evm',
            indexedAccountId: 'hw-1--0',
            impl: 'evm',
            address: `0x${'AB'.repeat(20)}`,
            path: "m/44'/60'/0'/0/0",
          },
          // Non-EVM second account: the old code ignored both.
          {
            id: 'btc',
            indexedAccountId: 'hw-1--1',
            impl: 'btc',
            address: 'bc1qsecond',
            path: "m/84'/0'/1'",
          },
        ],
      }),
    });

    const result = await service.getThirdPartyAccountNameCandidates({
      vendor: EHardwareVendor.ledger,
      walletId: 'hw-1',
    });
    expect(result.status).toBe('available');
    expect(
      result.candidates
        .map((item) => `${item.indexedAccountId}:${item.sourceName}`)
        .sort(),
    ).toEqual(['hw-1--0:Ethereum 1', 'hw-1--1:Bitcoin 2']);
  });
});

describe('getThirdPartyAccountNameCandidates guards', () => {
  const originalIsDesktop = platformEnv.isDesktop;
  const originalDesktopApiProxy = globalThis.desktopApiProxy;

  afterEach(() => {
    (platformEnv as { isDesktop: boolean }).isDesktop =
      Boolean(originalIsDesktop);
    globalThis.desktopApiProxy = originalDesktopApiProxy;
  });

  const wallet = {
    id: 'hw-1',
    name: 'W',
    dbIndexedAccounts: [{ id: 'hw-1--0', name: 'Account 1', walletId: 'hw-1' }],
    dbAccounts: [
      {
        id: 'evm',
        indexedAccountId: 'hw-1--0',
        impl: 'evm',
        address: `0x${'ab'.repeat(20)}`,
        path: "m/44'/60'/0'/0/0",
      },
    ],
  };

  const buildService = (readLedgerLiveAccountNames: jest.Mock) => {
    (platformEnv as { isDesktop: boolean }).isDesktop = true;
    globalThis.desktopApiProxy = {
      system: { readLedgerLiveAccountNames },
    } as never;
    getLocalDbMock().getWalletDeviceSafe.mockResolvedValue({
      deviceId: 'ledger-device',
      vendor: EHardwareVendor.ledger,
    } as IDBDevice);
    return new ServiceThirdPartyHardware({
      backgroundApi: {
        serviceAccount: {
          getWallets: jest.fn().mockResolvedValue({
            wallets: [{ id: wallet.id, name: wallet.name }],
          }),
          getAllAccounts: jest
            .fn()
            .mockResolvedValue({ accounts: wallet.dbAccounts }),
          getAllIndexedAccounts: jest
            .fn()
            .mockResolvedValue({ indexedAccounts: wallet.dbIndexedAccounts }),
        },
      } as unknown as IBackgroundApi,
    });
  };

  it('reports unsupported_source off desktop without touching the source', async () => {
    const read = jest.fn();
    const service = buildService(read);
    (platformEnv as { isDesktop: boolean }).isDesktop = false;
    await expect(
      service.getThirdPartyAccountNameCandidates({
        vendor: EHardwareVendor.ledger,
        walletId: 'hw-1',
      }),
    ).resolves.toEqual({ status: 'unsupported_source', candidates: [] });
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects a vendor that has no local source', async () => {
    const service = buildService(jest.fn());
    await expect(
      service.getThirdPartyAccountNameCandidates({
        vendor: EHardwareVendor.onekey,
        walletId: 'hw-1',
      }),
    ).resolves.toEqual({ status: 'unsupported_source', candidates: [] });
  });

  it('does not read a local source for a wallet owned by another vendor', async () => {
    const read = jest.fn().mockResolvedValue({
      status: 'available',
      accounts: [],
    });
    const service = buildService(read);
    getLocalDbMock().getWalletDeviceSafe.mockResolvedValue({
      deviceId: 'trezor-device',
      vendor: EHardwareVendor.trezor,
    } as IDBDevice);

    await expect(
      service.getThirdPartyAccountNameCandidates({
        vendor: EHardwareVendor.ledger,
        walletId: 'hw-1',
      }),
    ).resolves.toEqual({ status: 'no_matches', candidates: [] });
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    ['source_not_found', 'source_not_found'],
    ['invalid_source', 'invalid_source'],
    ['no_accounts', 'no_matches'],
  ])('maps source status %s to %s', async (sourceStatus, expected) => {
    const service = buildService(
      jest.fn().mockResolvedValue({ status: sourceStatus, accounts: [] }),
    );
    const result = await service.getThirdPartyAccountNameCandidates({
      vendor: EHardwareVendor.ledger,
      walletId: 'hw-1',
    });
    expect(result.status).toBe(expected);
    expect(result.candidates).toEqual([]);
  });

  it('does not offer a rename that would be a no-op', async () => {
    const service = buildService(
      jest.fn().mockResolvedValue({
        status: 'available',
        accounts: [{ name: 'Account 1', address: `0x${'ab'.repeat(20)}` }],
      }),
    );
    await expect(
      service.getThirdPartyAccountNameCandidates({
        vendor: EHardwareVendor.ledger,
        walletId: 'hw-1',
      }),
    ).resolves.toEqual({ status: 'no_matches', candidates: [] });
  });

  it('skips Trezor entirely when the wallet has no device', async () => {
    (platformEnv as { isDesktop: boolean }).isDesktop = true;
    const readTrezorSuiteAccountNames = jest.fn().mockResolvedValue({
      status: 'available',
      accounts: [{ deviceId: 'DEV-A', name: 'X', address: 'bc1q' }],
    });
    globalThis.desktopApiProxy = {
      system: { readTrezorSuiteAccountNames },
    } as never;
    getLocalDbMock().getWalletDeviceSafe.mockResolvedValue(undefined);
    const service = new ServiceThirdPartyHardware({
      backgroundApi: {
        serviceAccount: {
          getWallets: jest.fn().mockResolvedValue({
            wallets: [{ id: wallet.id, name: wallet.name }],
          }),
          getAllAccounts: jest
            .fn()
            .mockResolvedValue({ accounts: wallet.dbAccounts }),
          getAllIndexedAccounts: jest
            .fn()
            .mockResolvedValue({ indexedAccounts: wallet.dbIndexedAccounts }),
        },
      } as unknown as IBackgroundApi,
    });
    await expect(
      service.getThirdPartyAccountNameCandidates({
        vendor: EHardwareVendor.trezor,
        walletId: 'hw-1',
      }),
    ).resolves.toEqual({ status: 'no_matches', candidates: [] });
  });
});

describe('applyThirdPartyAccountNames', () => {
  function buildService() {
    const setAccountName = jest.fn().mockResolvedValue(undefined);
    const service = new ServiceThirdPartyHardware({
      backgroundApi: {
        serviceAccount: {
          setAccountName,
          getWallets: jest.fn().mockResolvedValue({
            wallets: [
              {
                id: 'hw-1',
                dbIndexedAccounts: [{ id: 'hw-1--0' }, { id: 'hw-1--1' }],
              },
            ],
          }),
        },
      } as unknown as IBackgroundApi,
    });
    return { service, setAccountName };
  }

  it('renames every requested account', async () => {
    const { service, setAccountName } = buildService();
    await service.applyThirdPartyAccountNames({
      walletId: 'hw-1',
      renames: [
        { indexedAccountId: 'hw-1--0', name: 'Ethereum 1' },
        { indexedAccountId: 'hw-1--1', name: '  Bitcoin 2  ' },
      ],
    });
    expect(setAccountName).toHaveBeenCalledTimes(2);
    expect(setAccountName).toHaveBeenLastCalledWith({
      indexedAccountId: 'hw-1--1',
      name: 'Bitcoin 2',
    });
  });

  it('refuses to rename an account that belongs to another wallet', async () => {
    const { service, setAccountName } = buildService();
    await expect(
      service.applyThirdPartyAccountNames({
        walletId: 'hw-1',
        renames: [{ indexedAccountId: 'hw-OTHER--0', name: 'Nope' }],
      }),
    ).rejects.toThrow('Invalid third-party account rename');
    expect(setAccountName).not.toHaveBeenCalled();
  });

  it.each([['   '], ['a'.repeat(81)]])(
    'rejects the invalid name %p',
    async (name) => {
      const { service, setAccountName } = buildService();
      await expect(
        service.applyThirdPartyAccountNames({
          walletId: 'hw-1',
          renames: [{ indexedAccountId: 'hw-1--0', name }],
        }),
      ).rejects.toThrow('Invalid third-party account rename');
      expect(setAccountName).not.toHaveBeenCalled();
    },
  );

  it('writes nothing when a later entry in the batch is invalid', async () => {
    const { service, setAccountName } = buildService();
    await expect(
      service.applyThirdPartyAccountNames({
        walletId: 'hw-1',
        renames: [
          { indexedAccountId: 'hw-1--0', name: 'Valid' },
          { indexedAccountId: 'hw-OTHER--0', name: 'Invalid' },
        ],
      }),
    ).rejects.toThrow('Invalid third-party account rename');
    expect(setAccountName).not.toHaveBeenCalled();
  });
});

describe('Ledger cross-chain matching onto one indexed account', () => {
  const originalIsDesktop = platformEnv.isDesktop;
  const originalDesktopApiProxy = globalThis.desktopApiProxy;

  afterEach(() => {
    (platformEnv as { isDesktop: boolean }).isDesktop =
      Boolean(originalIsDesktop);
    globalThis.desktopApiProxy = originalDesktopApiProxy;
  });

  it('collects one name per chain into a single pick-one candidate', async () => {
    const evmAddress = `0x${'ab'.repeat(20)}`;
    const btcAddress = 'bc1qaccountone';
    const solAddress = 'SoLaNaAddress1111111111111111111111111111111';
    (platformEnv as { isDesktop: boolean }).isDesktop = true;
    globalThis.desktopApiProxy = {
      system: {
        readLedgerLiveAccountNames: jest.fn().mockResolvedValue({
          status: 'available',
          accounts: [
            { name: 'Ethereum 1', address: evmAddress },
            { name: 'Bitcoin 1', address: btcAddress },
            { name: 'Solana 1', address: solAddress },
          ],
        }),
      },
    } as never;
    getLocalDbMock().getWalletDeviceSafe.mockResolvedValue({
      deviceId: 'ledger-device',
      vendor: EHardwareVendor.ledger,
    } as IDBDevice);

    const service = new ServiceThirdPartyHardware({
      backgroundApi: buildBackgroundApi({
        id: 'hw-1',
        name: 'Ledger',
        dbIndexedAccounts: [
          { id: 'hw-1--0', name: 'Account 1', walletId: 'hw-1' },
        ],
        dbAccounts: [
          {
            id: 'evm',
            indexedAccountId: 'hw-1--0',
            impl: 'evm',
            address: evmAddress,
            path: "m/44'/60'/0'/0/0",
          },
          {
            id: 'btc',
            indexedAccountId: 'hw-1--0',
            impl: 'btc',
            address: btcAddress,
            path: "m/84'/0'/0'",
          },
          {
            id: 'sol',
            indexedAccountId: 'hw-1--0',
            impl: 'sol',
            address: solAddress,
            path: "m/44'/501'/0'/0'",
          },
        ],
      }),
    });

    const result = await service.getThirdPartyAccountNameCandidates({
      vendor: EHardwareVendor.ledger,
      walletId: 'hw-1',
    });

    expect(result.status).toBe('available');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].indexedAccountId).toBe('hw-1--0');
    expect(result.candidates[0].currentName).toBe('Account 1');
    expect([...result.candidates[0].sourceNames].sort()).toEqual([
      'Bitcoin 1',
      'Ethereum 1',
      'Solana 1',
    ]);
    expect(result.candidates[0].sourceName).toBe(
      result.candidates[0].sourceNames[0],
    );
  });
});

describe('Ledger real-world multi-chain fan-in', () => {
  const originalIsDesktop = platformEnv.isDesktop;
  const originalDesktopApiProxy = globalThis.desktopApiProxy;

  afterEach(() => {
    (platformEnv as { isDesktop: boolean }).isDesktop =
      Boolean(originalIsDesktop);
    globalThis.desktopApiProxy = originalDesktopApiProxy;
  });

  it('fans every chain name in, whether or not the address is shared', async () => {
    const sharedEvm = '0x1C38960Bea4E9a5cE2bc51DB3187023685c57b0b';
    const btc = 'bc1qcj6kf4d62sp373ex3l3fhrrs9kmjq5h6fgytdt';
    (platformEnv as { isDesktop: boolean }).isDesktop = true;
    globalThis.desktopApiProxy = {
      system: {
        readLedgerLiveAccountNames: jest.fn().mockResolvedValue({
          status: 'available',
          accounts: [
            { name: 'Ethereum 1', address: sharedEvm },
            { name: 'New Polygon 1', address: sharedEvm.toLowerCase() },
            { name: 'Bitcoin 1', address: btc },
          ],
        }),
      },
    } as never;
    getLocalDbMock().getWalletDeviceSafe.mockResolvedValue({
      deviceId: 'ledger-device',
      vendor: EHardwareVendor.ledger,
    } as IDBDevice);

    const service = new ServiceThirdPartyHardware({
      backgroundApi: buildBackgroundApi({
        id: 'hw-1',
        name: 'Ledger',
        dbIndexedAccounts: [
          { id: 'hw-1--0', name: 'Account 1', walletId: 'hw-1' },
        ],
        dbAccounts: [
          {
            id: 'evm',
            indexedAccountId: 'hw-1--0',
            impl: 'evm',
            address: sharedEvm.toUpperCase(),
            path: "m/44'/60'/0'/0/0",
          },
          {
            id: 'btc',
            indexedAccountId: 'hw-1--0',
            impl: 'btc',
            address: btc,
            path: "m/84'/0'/0'",
          },
        ],
      }),
    });

    const result = await service.getThirdPartyAccountNameCandidates({
      vendor: EHardwareVendor.ledger,
      walletId: 'hw-1',
    });

    expect(result.candidates).toHaveLength(1);
    // Case differences in the address must not split or drop a match.
    expect([...result.candidates[0].sourceNames].sort()).toEqual([
      'Bitcoin 1',
      'Ethereum 1',
      'New Polygon 1',
    ]);
  });
});
