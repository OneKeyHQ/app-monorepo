import ServiceThirdPartyHardware from '.';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import {
  EThirdPartyHardwareUiAction,
  publishThirdPartyHardwareUiState,
  thirdPartyHardwareUiStateAtom,
} from '../../states/jotai/atoms';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDevice } from '../../dbs/local/types';
import type { IThirdPartyHardwareUiState } from '../../states/jotai/atoms';
import type { IThirdPartyHardwareAdapter } from '../ServiceHardware/adapters/types';

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
    getDevice: jest.fn(),
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

describe('ServiceThirdPartyHardware Trezor BLE binding', () => {
  const db = jest.mocked(localDb);
  it.each([EHardwareVendor.ledger, EHardwareVendor.trezor])(
    'sends the existing %s identity to explicit binding without clearing the saved locator',
    async (vendor) => {
      db.getDevice.mockResolvedValueOnce({
        id: 'db-device',
        name: 'Device',
        uuid: 'test-device',
        deviceType: EDeviceType.Unknown,
        features: '{}',
        settingsRaw: '{}',
        createdAt: 1,
        updatedAt: 1,
        vendor,
        deviceId: 'trezor-identity',
        connectId: 'old-ble',
        bleConnectId: 'old-ble',
        settings: { chainFingerprints: { sol: 'ledger-identity' } },
      });
      const bindBleDevice = jest
        .fn()
        .mockResolvedValue({ success: true, payload: 'new-ble' });
      const service = new ServiceThirdPartyHardware({
        backgroundApi: {} as IBackgroundApi,
      });
      const adapterLookup = jest
        .spyOn(service, 'getAdapterForVendor')
        .mockResolvedValue({
          hw: { bindBleDevice },
        } as unknown as IThirdPartyHardwareAdapter);
      try {
        await service.rebindBleDevice({ dbDeviceId: 'db-device' });
        expect(bindBleDevice).toHaveBeenCalledWith({
          identity:
            vendor === EHardwareVendor.ledger
              ? {
                  vendor,
                  type: 'chainFingerprint',
                  chain: 'sol',
                  value: 'ledger-identity',
                }
              : { vendor, type: 'deviceId', value: 'trezor-identity' },
          extra: { dbDeviceId: 'db-device' },
        });
        expect(db.updateDeviceConnectId.mock.calls).toHaveLength(0);
      } finally {
        adapterLookup.mockRestore();
      }
    },
  );

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

  it.each([true, false])(
    'keeps binding cancellation scoped across adapter initialization (handler=%s)',
    async (hasHandler) => {
      const cancel = jest.fn();
      const cancelBleBinding = jest.fn();
      const adapter = {
        cancel,
        ...(hasHandler ? { cancelBleBinding } : {}),
      } as unknown as IThirdPartyHardwareAdapter;
      const service = new ServiceThirdPartyHardware({
        backgroundApi: {} as IBackgroundApi,
      });
      let finishInitialization: (() => void) | undefined;
      const initialized = new Promise<void>((resolve) => {
        finishInitialization = resolve;
      });
      const internals = service as unknown as {
        ensureAdaptersInitialized: () => Promise<void>;
        getThirdPartyAdapter: () => IThirdPartyHardwareAdapter;
      };
      internals.ensureAdaptersInitialized = () => initialized;
      internals.getThirdPartyAdapter = () => adapter;
      const result = service.thirdPartyHardwareCancel({
        vendor: EHardwareVendor.trezor,
        bindingSessionId: 'old-session',
      });
      expect(cancelBleBinding).not.toHaveBeenCalled();
      finishInitialization?.();
      await result;
      expect(cancel).not.toHaveBeenCalled();
      if (hasHandler)
        expect(cancelBleBinding).toHaveBeenCalledWith('old-session');
    },
  );

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
