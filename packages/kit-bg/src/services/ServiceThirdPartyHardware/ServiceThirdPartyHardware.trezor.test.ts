import ServiceThirdPartyHardware from '.';

import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  EThirdPartyHardwareUiAction,
  publishThirdPartyHardwareUiState,
  thirdPartyHardwareUiStateAtom,
} from '../../states/jotai/atoms';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDevice } from '../../dbs/local/types';
import type { IThirdPartyHardwareUiState } from '../../states/jotai/atoms';
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
  toastIfError:
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
  it('assigns a distinct publication id to otherwise identical prompts', async () => {
    const atomSet = jest
      .spyOn(thirdPartyHardwareUiStateAtom, 'set')
      .mockResolvedValue(undefined);
    try {
      const prompt = {
        vendor: EHardwareVendor.trezor,
        action: EThirdPartyHardwareUiAction.requestTrezorPin,
      };
      await publishThirdPartyHardwareUiState(prompt);
      await publishThirdPartyHardwareUiState(prompt);
      const first = atomSet.mock.calls[0][0] as IThirdPartyHardwareUiState;
      const second = atomSet.mock.calls[1][0] as IThirdPartyHardwareUiState;
      expect(first.uiRequestId).toEqual(expect.any(String));
      expect(second.uiRequestId).toEqual(expect.any(String));
      expect(first.uiRequestId).not.toBe(second.uiRequestId);
    } finally {
      atomSet.mockRestore();
    }
  });

  it.each([false, true])(
    'compares the serialized UI request in bg (current=%s)',
    async (matches) => {
      const service = new ServiceThirdPartyHardware({
        backgroundApi: {} as IBackgroundApi,
      });
      const makeRequest = (
        requestId: string,
      ): IThirdPartyHardwareUiState & { uiRequestId: string } => ({
        uiRequestId: requestId,
        vendor: EHardwareVendor.trezor,
        action: EThirdPartyHardwareUiAction.requestDeviceSelection,
        payload: {
          reason: undefined,
          message: undefined,
          deviceSelection: {
            requestId,
            context: {
              kind: 'bind-connection',
              transport: 'ble',
              reason: 'missing-binding',
            },
          },
        },
      });
      const bgState = makeRequest(matches ? 'request-A' : 'request-B');
      let currentState: IThirdPartyHardwareUiState | undefined = bgState;
      const atomSet = jest
        .spyOn(thirdPartyHardwareUiStateAtom, 'set')
        .mockImplementation(async (update) => {
          currentState =
            typeof update === 'function' ? update(currentState) : update;
        });
      try {
        const mainSnapshot = JSON.parse(
          JSON.stringify(makeRequest('request-A')),
        ) as ReturnType<typeof makeRequest>;
        const cleared = await service.clearThirdPartyHardwareUiStateIfCurrent({
          expectedRequestId: mainSnapshot.uiRequestId,
        });
        expect(cleared).toBe(matches);
        expect(currentState).toEqual(matches ? undefined : bgState);
      } finally {
        atomSet.mockRestore();
      }
    },
  );

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
    const connectDevice = jest.fn().mockResolvedValue({
      success: true,
      payload: {
        interactionId: 'hwk-trezor-probe',
        deviceId: 'FEATURES_DEVICE_ID',
      },
    });
    const releaseInteraction = jest.fn().mockResolvedValue(undefined);
    const flushThpCredentials = jest.fn().mockResolvedValue(undefined);
    const { getDeviceByQuery, updateDeviceConnectId } = getLocalDbMock();
    const adapter = {
      hw: { cancel: jest.fn() },
      connectDevice,
      releaseInteraction,
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
    expect(releaseInteraction).toHaveBeenCalledWith('hwk-trezor-probe');
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
      connectDevice,
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
    const { updateDeviceConnectId } = getLocalDbMock();
    const adapter = {
      connectDevice,
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

  it('throws the real hardware error when the probe connect fails without a probe cancel', async () => {
    const connectDevice = jest.fn().mockResolvedValue({
      success: false,
      payload: {
        code: HardwareErrorCode.DeviceNotInitialized,
        error: 'Device not initialized',
      },
    });
    const adapter = {
      connectDevice,
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
      connectDevice,
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

  it('filters search targets by transport even when the vendor SDK leaks another channel', async () => {
    const searchDeviceTargets = jest.fn().mockResolvedValue([
      {
        searchTargetId: 'keystone-usb:temporary',
        vendor: EHardwareVendor.keystone,
        connectionType: 'usb',
        kind: 'physical',
      },
      {
        searchTargetId: 'keystone-qr:connect',
        vendor: EHardwareVendor.keystone,
        connectionType: 'qr',
        kind: 'interactive',
      },
    ]);
    const adapter = {
      searchDeviceTargets,
    } as unknown as IThirdPartyHardwareAdapter;
    const service = new ServiceThirdPartyHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    (
      service as unknown as {
        thirdPartyAdapters: Map<string, IThirdPartyHardwareAdapter>;
      }
    ).thirdPartyAdapters.set('keystone', adapter);

    const response = await service.searchDeviceTargets({
      vendor: EHardwareVendor.keystone,
      transportType: 'usb',
    });

    expect(searchDeviceTargets).toHaveBeenCalledWith({
      resetSession: undefined,
      waitForAllTransports: undefined,
      transportType: 'usb',
    });
    expect(response).toEqual({
      success: true,
      payload: [
        {
          searchTargetId: 'keystone-usb:temporary',
          vendor: EHardwareVendor.keystone,
          connectionType: 'usb',
          kind: 'physical',
        },
      ],
    });
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

  it('delegates passphrase transport resolution and never replays an SDK failure in App', async () => {
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
    ).rejects.toThrow('DeviceNotFound');

    expect(getPassphraseState).toHaveBeenNthCalledWith(
      1,
      'TREZOR-USB',
      undefined,
      {
        knownConnections: [
          { transport: 'usb', connectId: 'TREZOR-USB' },
          { transport: 'ble', connectId: 'TREZOR-BLE' },
        ],
        expectedDeviceIdentity: {
          vendor: 'trezor',
          type: 'deviceId',
          value: 'device-1',
        },
      },
    );
    expect(getPassphraseState).toHaveBeenCalledTimes(1);
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

describe('ServiceThirdPartyHardware Keystone lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates cancellation without independently clearing global UI state', async () => {
    const cancel = jest.fn();
    const adapter = { cancel } as unknown as IThirdPartyHardwareAdapter;
    const service = new ServiceThirdPartyHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    (
      service as unknown as {
        thirdPartyAdapters: Map<string, IThirdPartyHardwareAdapter>;
      }
    ).thirdPartyAdapters.set('keystone', adapter);
    const atomSetSpy = jest.spyOn(thirdPartyHardwareUiStateAtom, 'set');

    await service.thirdPartyHardwareCancel({
      vendor: EHardwareVendor.keystone,
    });

    expect(cancel).toHaveBeenCalledWith(undefined);
    expect(atomSetSpy).not.toHaveBeenCalled();
    atomSetSpy.mockRestore();
  });

  it('tracks only completed physical interactions by stable wallet identity', async () => {
    const service = new ServiceThirdPartyHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    const testService = service as unknown as {
      handleThirdPartyConnectionStateChange: (
        vendor: 'keystone',
        event:
          | {
              type: 'connected';
              device: {
                interactionId: string;
                connectId: string;
                deviceId: string;
                connectionType: 'usb' | 'qr';
              };
            }
          | { type: 'disconnected'; interactionId: string },
      ) => void;
    };
    const walletId = 'ab'.repeat(32);

    testService.handleThirdPartyConnectionStateChange('keystone', {
      type: 'connected',
      device: {
        interactionId: 'keystone-qr-interaction',
        connectId: `keystone-wallet:${walletId}`,
        deviceId: walletId,
        connectionType: 'qr',
      },
    });
    await expect(
      service.getConnectedHardwareDeviceIdentityKeys(),
    ).resolves.toEqual([]);

    testService.handleThirdPartyConnectionStateChange('keystone', {
      type: 'connected',
      device: {
        interactionId: 'keystone-usb-interaction',
        connectId: `keystone-wallet:${walletId}`,
        deviceId: walletId,
        connectionType: 'usb',
      },
    });
    await expect(
      service.getConnectedHardwareDeviceIdentityKeys(),
    ).resolves.toEqual(
      expect.arrayContaining([walletId, `keystone-wallet:${walletId}`]),
    );

    testService.handleThirdPartyConnectionStateChange('keystone', {
      type: 'disconnected',
      interactionId: 'keystone-usb-interaction',
    });
    await expect(
      service.getConnectedHardwareDeviceIdentityKeys(),
    ).resolves.toEqual([]);
  });
});
