import { EDeviceType } from '@onekeyfe/hd-shared';
import {
  DEVICE,
  EConnectorInteraction,
  UI_REQUEST,
  UI_RESPONSE,
} from '@onekeyfe/hwk-adapter-core';

import localDb from '@onekeyhq/kit-bg/src/dbs/local/localDb';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { thirdPartyHardwareUiStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { TrezorAdapter } from './TrezorAdapter';

jest.mock('@onekeyhq/kit-bg/src/dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getAllDevices: jest.fn(),
    getDevice: jest.fn(),
    getDeviceByQuery: jest.fn(),
    updateThirdPartyDeviceFeatures: jest.fn(),
    updateDeviceThpCredentials: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EThirdPartyHardwareUiAction: {
    searching: 'searching',
    requestDeviceNotFound: 'requestDeviceNotFound',
    requestTrezorThpPairing: 'requestTrezorThpPairing',
    requestTrezorPassphrase: 'requestTrezorPassphrase',
    unlockDevice: 'unlockDevice',
    confirmOnDevice: 'confirmOnDevice',
    connecting: 'connecting',
    processing: 'processing',
  },
  thirdPartyHardwareUiStateAtom: {
    set: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: {
      sdkLog: {
        log: jest.fn(),
        uiEvent: jest.fn(),
      },
    },
  },
}));

const mockedLocalDb = jest.mocked(localDb);
const mockedThirdPartyHardwareUiStateAtom = jest.mocked(
  thirdPartyHardwareUiStateAtom,
);

describe('TrezorAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLocalDb.getAllDevices.mockResolvedValue({ devices: [] });
    mockedLocalDb.getDevice.mockRejectedValue(new Error('not found'));
  });

  it('shows a reconnect request when Trezor asks for device connection', () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const hw = {
      on: jest.fn((eventName: string, listener: (event: unknown) => void) => {
        listeners.set(eventName, listener);
      }),
      uiResponse: jest.fn(),
    };

    const adapter = new TrezorAdapter(hw as never);
    expect(adapter.vendor).toBe('trezor');
    expect(adapter.supportsAllNetworkGetAddress).toBe(true);
    listeners.get(UI_REQUEST.REQUEST_DEVICE_CONNECT)?.({
      payload: {
        vendor: 'trezor',
        reason: 'device-not-found',
        message: 'Please connect and unlock your Trezor device',
      },
    });

    expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'requestDeviceNotFound',
        vendor: 'trezor',
        payload: expect.objectContaining({
          reason: 'device-not-found',
          message: 'Please connect and unlock your Trezor device',
        }),
      }),
    );
    expect(hw.uiResponse).not.toHaveBeenCalled();
  });

  it('cleans up registry-owned SDK event subscription on reset', () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const disposeSdkEvents = jest.fn();
    const hw = {
      on: jest.fn((eventName: string, listener: (event: unknown) => void) => {
        listeners.set(eventName, listener);
      }),
      uiResponse: jest.fn(),
      dispose: jest.fn(),
    };

    const adapter = new TrezorAdapter(hw as never, disposeSdkEvents);
    adapter.reset();

    expect(disposeSdkEvents).toHaveBeenCalledTimes(1);
    expect(hw.dispose).toHaveBeenCalledTimes(1);
  });

  it('updates Trezor features when the SDK emits features', async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const hw = {
      on: jest.fn((eventName: string, listener: (event: unknown) => void) => {
        listeners.set(eventName, listener);
      }),
      uiResponse: jest.fn(),
    };
    const features = {
      vendor: 'trezor.io',
      device_id: 'TREZOR-FEATURES-DEVICE-ID',
      model: 'Safe 7',
      internal_model: 'T3W1',
    };
    const adapter = new TrezorAdapter(hw as never);
    expect(adapter.vendor).toBe('trezor');

    listeners.get('features')?.({
      device: {
        connectId: 'A37803C61D8DCB1542D7AEE7',
        deviceId: 'TREZOR-FEATURES-DEVICE-ID',
        features,
      },
    });
    await Promise.resolve();

    expect(
      mockedLocalDb.updateThirdPartyDeviceFeatures.mock.calls,
    ).toContainEqual([
      {
        vendor: 'trezor',
        features,
      },
    ]);
  });

  it('keeps explicit empty-passphrase requests on the auto-empty path', () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const hw = {
      on: jest.fn((eventName: string, listener: (event: unknown) => void) => {
        listeners.set(eventName, listener);
      }),
      uiResponse: jest.fn(),
    };
    const adapter = new TrezorAdapter(hw as never);
    expect(adapter.vendor).toBe('trezor');

    listeners.get(UI_REQUEST.REQUEST_PASSPHRASE)?.({
      payload: {
        connectId: 'TREZOR-USB',
        useEmptyPassphrase: true,
      },
    });

    expect(hw.uiResponse).toHaveBeenCalledWith({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: { value: '' },
    });
    expect(mockedThirdPartyHardwareUiStateAtom.set).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'requestTrezorPassphrase',
      }),
    );
  });

  it('routes passphrase requests to UI unless useEmptyPassphrase is explicit', () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const hw = {
      on: jest.fn((eventName: string, listener: (event: unknown) => void) => {
        listeners.set(eventName, listener);
      }),
      uiResponse: jest.fn(),
    };
    const adapter = new TrezorAdapter(hw as never);
    expect(adapter.vendor).toBe('trezor');

    listeners.get(UI_REQUEST.REQUEST_PASSPHRASE)?.({
      payload: {
        connectId: 'TREZOR-USB',
      },
    });

    expect(hw.uiResponse).not.toHaveBeenCalledWith({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: { value: '' },
    });
    expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenCalledWith({
      action: 'requestTrezorPassphrase',
      vendor: 'trezor',
      payload: {
        connectId: 'TREZOR-USB',
      },
    });
  });

  it('passes passphraseState from passphrase requests to Trezor passphrase UI', () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const hw = {
      on: jest.fn((eventName: string, listener: (event: unknown) => void) => {
        listeners.set(eventName, listener);
      }),
      uiResponse: jest.fn(),
    };
    const adapter = new TrezorAdapter(hw as never);
    expect(adapter.vendor).toBe('trezor');

    listeners.get(UI_REQUEST.REQUEST_PASSPHRASE)?.({
      payload: {
        connectId: 'TREZOR-USB',
        passphraseState: 'PASSPHRASE_STATE',
      },
    });

    expect(hw.uiResponse).not.toHaveBeenCalledWith({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: { value: '' },
    });
    expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenCalledWith({
      action: 'requestTrezorPassphrase',
      vendor: 'trezor',
      payload: {
        connectId: 'TREZOR-USB',
        passphraseState: 'PASSPHRASE_STATE',
      },
    });
  });

  it('maps generic Trezor confirm-on-device ui-events to the confirm toast', () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const hw = {
      on: jest.fn((eventName: string, listener: (event: unknown) => void) => {
        listeners.set(eventName, listener);
      }),
      uiResponse: jest.fn(),
    };

    const adapter = new TrezorAdapter(hw as never);
    expect(adapter.vendor).toBe('trezor');
    mockedThirdPartyHardwareUiStateAtom.set.mockClear();

    listeners.get('ui-event')?.({
      type: EConnectorInteraction.ConfirmOnDevice,
    });

    expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenCalledWith({
      action: 'confirmOnDevice',
      vendor: 'trezor',
    });
  });

  it('promotes post-connect device info into connectDevice payload', async () => {
    const features = {
      device_id: 'DEVICE-1',
      vendor: 'trezor',
      internal_model: 'T3W1',
      model: 'Safe 7',
    };
    const hw = {
      on: jest.fn(),
      connectDevice: jest.fn().mockResolvedValue({
        success: true,
        payload: { sessionId: 'session-1' },
      }),
      getDeviceInfo: jest.fn().mockResolvedValue({
        success: true,
        payload: {
          connectId: 'USB-1',
          deviceId: 'DEVICE-1',
          model: 'Safe 7',
          modelName: 'Trezor Safe 7',
          label: 'Trezor Safe 7',
          firmwareVersion: '2.8.0',
          raw: {
            features,
          },
        },
      }),
    };
    const adapter = new TrezorAdapter(hw as never);

    const result = await adapter.connectDevice('USB-1');

    expect(result).toMatchObject({
      success: true,
      payload: {
        connectId: 'USB-1',
        deviceId: 'DEVICE-1',
        model: 'T3W1',
        modelName: 'Trezor Safe 7',
        label: 'Trezor Safe 7',
        firmwareVersion: '2.8.0',
        features,
      },
    });
  });

  it('does not expose Trezor transport id as connected firmware deviceId', async () => {
    const hw = {
      on: jest.fn(),
      connectDevice: jest.fn().mockResolvedValue({
        success: true,
        payload: { sessionId: 'session-1' },
      }),
      getDeviceInfo: jest.fn().mockResolvedValue({
        success: true,
        payload: {
          connectId: 'A37803C61D8DCB1542D7AEE7',
          deviceId: 'A37803C61D8DCB1542D7AEE7',
          model: 'T3W1',
          modelName: 'Trezor Safe 7',
          raw: {
            features: {
              vendor: 'trezor',
              internal_model: 'T3W1',
            },
          },
        },
      }),
    };
    const adapter = new TrezorAdapter(hw as never);

    const result = await adapter.connectDevice('A37803C61D8DCB1542D7AEE7');

    expect(result).toMatchObject({
      success: true,
      payload: {
        connectId: 'A37803C61D8DCB1542D7AEE7',
        deviceId: '',
      },
    });
  });

  it('buffers THP credentials from SDK event by firmware device id', async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const features = {
      device_id: 'TREZOR-FEATURES-DEVICE-ID',
      vendor: 'trezor',
      internal_model: 'T3W1',
    };
    const credentials = [{ credential: 'credential-1' }];
    const hw = {
      on: jest.fn((eventName: string, listener: (event: unknown) => void) => {
        listeners.set(eventName, listener);
      }),
      connectDevice: jest.fn().mockResolvedValue({
        success: true,
        payload: { sessionId: 'session-1' },
      }),
      getDeviceInfo: jest.fn().mockResolvedValue({
        success: true,
        payload: {
          connectId: 'BLE-EPHEMERAL-CONNECT-ID',
          deviceId: 'TREZOR-FEATURES-DEVICE-ID',
          model: 'T3W1',
          modelName: 'Trezor Safe 7',
          raw: { features },
        },
      }),
    };
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-device-1',
      name: 'Trezor Safe 7',
      features: '{}',
      connectId: 'BLE-EPHEMERAL-CONNECT-ID',
      uuid: 'device-uuid-1',
      deviceId: 'TREZOR-FEATURES-DEVICE-ID',
      deviceType: EDeviceType.Unknown,
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } satisfies IDBDevice);
    const adapter = new TrezorAdapter(hw as never);

    await adapter.connectDevice('BLE-EPHEMERAL-CONNECT-ID');
    listeners.get(DEVICE.TREZOR_THP_CREDENTIALS_CHANGED)?.({
      payload: {
        connectId: 'BLE-EPHEMERAL-CONNECT-ID',
        deviceId: 'TREZOR-FEATURES-DEVICE-ID',
        credentials,
      },
    });
    await adapter.flushThpCredentials('TREZOR-FEATURES-DEVICE-ID');

    expect(mockedLocalDb.getDeviceByQuery.mock.calls).toContainEqual([
      {
        featuresDeviceId: 'TREZOR-FEATURES-DEVICE-ID',
        vendor: 'trezor',
      },
    ]);
    expect(mockedLocalDb.updateDeviceThpCredentials.mock.calls).toContainEqual([
      {
        dbDeviceId: 'db-device-1',
        credentials,
      },
    ]);
  });

  it('persists THP credentials by connectId when SDK event deviceId is the scan id', async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const credentials = [{ credential: 'credential-1' }];
    let dbRecordExists = false;
    const dbDevice = {
      id: 'db-device-1',
      name: 'Trezor Safe 7',
      features: '{"vendor":"trezor"}',
      connectId: 'A37803C61D8DCB1542D7AEE7',
      uuid: '',
      deviceId: 'A37803C61D8DCB1542D7AEE7',
      deviceType: EDeviceType.Unknown,
      settingsRaw:
        '{"inputPinOnSoftware":false,"vendor":"trezor","vendorModel":"Safe 7","vendorModelName":"Safe 7"}',
      createdAt: 0,
      updatedAt: 0,
      usbConnectId: 'A37803C61D8DCB1542D7AEE7',
    } satisfies IDBDevice;
    const hw = {
      on: jest.fn((eventName: string, listener: (event: unknown) => void) => {
        listeners.set(eventName, listener);
      }),
    };
    mockedLocalDb.getDeviceByQuery.mockImplementation(async (query) => {
      if (
        dbRecordExists &&
        'connectId' in query &&
        query.connectId === 'A37803C61D8DCB1542D7AEE7'
      ) {
        return dbDevice;
      }
      return undefined;
    });
    const adapter = new TrezorAdapter(hw as never);

    listeners.get(DEVICE.TREZOR_THP_CREDENTIALS_CHANGED)?.({
      payload: {
        connectId: 'A37803C61D8DCB1542D7AEE7',
        deviceId: 'A37803C61D8DCB1542D7AEE7',
        credentials,
      },
    });
    await Promise.resolve();
    expect(mockedLocalDb.updateDeviceThpCredentials.mock.calls).toHaveLength(0);

    dbRecordExists = true;
    await adapter.flushThpCredentials('TREZOR-FEATURES-DEVICE-ID', {
      connectId: 'A37803C61D8DCB1542D7AEE7',
    });

    expect(mockedLocalDb.getDeviceByQuery.mock.calls).toContainEqual([
      {
        featuresDeviceId: 'TREZOR-FEATURES-DEVICE-ID',
        vendor: 'trezor',
      },
    ]);
    expect(mockedLocalDb.getDeviceByQuery.mock.calls).toContainEqual([
      {
        connectId: 'A37803C61D8DCB1542D7AEE7',
        vendor: 'trezor',
      },
    ]);
    expect(mockedLocalDb.updateDeviceThpCredentials.mock.calls).toContainEqual([
      {
        dbDeviceId: 'db-device-1',
        credentials,
      },
    ]);
  });

  it('maps THP credentials buffered by connectId to the post-features device id', async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const credentials = [{ credential: 'credential-1' }];
    let dbRecordExists = false;
    const features = {
      device_id: 'TREZOR-FEATURES-DEVICE-ID',
      vendor: 'trezor',
      internal_model: 'T3W1',
    };
    const hw = {
      on: jest.fn((eventName: string, listener: (event: unknown) => void) => {
        listeners.set(eventName, listener);
      }),
      connectDevice: jest.fn().mockResolvedValue({
        success: true,
        payload: { sessionId: 'session-1' },
      }),
      getDeviceInfo: jest.fn().mockResolvedValue({
        success: true,
        payload: {
          connectId: 'A37803C61D8DCB1542D7AEE7',
          deviceId: 'A37803C61D8DCB1542D7AEE7',
          model: 'T3W1',
          modelName: 'Trezor Safe 7',
          raw: { features },
        },
      }),
    };
    mockedLocalDb.getDeviceByQuery.mockImplementation(async (query) => {
      if (
        dbRecordExists &&
        'featuresDeviceId' in query &&
        query.featuresDeviceId === 'TREZOR-FEATURES-DEVICE-ID'
      ) {
        return {
          id: 'db-device-1',
          name: 'Trezor Safe 7',
          features: JSON.stringify(features),
          connectId: 'A37803C61D8DCB1542D7AEE7',
          uuid: '',
          deviceId: 'TREZOR-FEATURES-DEVICE-ID',
          deviceType: EDeviceType.Unknown,
          settingsRaw: '{}',
          createdAt: 0,
          updatedAt: 0,
          usbConnectId: 'A37803C61D8DCB1542D7AEE7',
        } satisfies IDBDevice;
      }
      return undefined;
    });
    const adapter = new TrezorAdapter(hw as never);

    listeners.get(DEVICE.TREZOR_THP_CREDENTIALS_CHANGED)?.({
      payload: {
        connectId: 'A37803C61D8DCB1542D7AEE7',
        deviceId: 'A37803C61D8DCB1542D7AEE7',
        credentials,
      },
    });
    await adapter.connectDevice('A37803C61D8DCB1542D7AEE7');
    dbRecordExists = true;
    await adapter.flushThpCredentials('TREZOR-FEATURES-DEVICE-ID');

    expect(mockedLocalDb.getDeviceByQuery.mock.calls).toContainEqual([
      {
        featuresDeviceId: 'TREZOR-FEATURES-DEVICE-ID',
        vendor: 'trezor',
      },
    ]);
    expect(mockedLocalDb.updateDeviceThpCredentials.mock.calls).toContainEqual([
      {
        dbDeviceId: 'db-device-1',
        credentials,
      },
    ]);
  });

  it('resets Trezor adapter state when search requests resetSession', async () => {
    const hw = {
      on: jest.fn(),
      searchDevices: jest.fn().mockResolvedValue([]),
      resetState: jest.fn(),
    };
    const adapter = new TrezorAdapter(hw as never);

    await adapter.searchDevices({ resetSession: true });

    expect(hw.resetState).toHaveBeenCalledTimes(1);
    expect(hw.searchDevices).toHaveBeenCalledWith({ resetSession: true });
  });

  it('passes waitForAllTransports to the HWK Trezor search call', async () => {
    const hw = {
      on: jest.fn(),
      searchDevices: jest.fn().mockResolvedValue([]),
    };
    const adapter = new TrezorAdapter(hw as never);

    await adapter.searchDevices({ waitForAllTransports: true });

    expect(hw.searchDevices).toHaveBeenCalledWith({
      waitForAllTransports: true,
    });
  });

  it('does not show global searching UI while Trezor searchDevices is pending', async () => {
    let resolveSearch: (devices: unknown[]) => void = () => undefined;
    const searchPromise = new Promise<unknown[]>((resolve) => {
      resolveSearch = resolve;
    });
    const hw = {
      on: jest.fn(),
      searchDevices: jest.fn().mockReturnValue(searchPromise),
    };
    const adapter = new TrezorAdapter(hw as never);

    const promise = adapter.searchDevices();

    expect(mockedThirdPartyHardwareUiStateAtom.set).not.toHaveBeenCalled();

    resolveSearch([]);
    await promise;

    expect(mockedThirdPartyHardwareUiStateAtom.set).not.toHaveBeenCalled();
  });

  it('filters Trezor searchDevices by requested transport type', async () => {
    const hw = {
      on: jest.fn(),
      searchDevices: jest.fn().mockResolvedValue([
        { connectId: 'usb-1', connectionType: 'usb' },
        { connectId: 'ble-1', connectionType: 'ble' },
      ]),
    };
    const adapter = new TrezorAdapter(hw as never);

    const devices = await adapter.searchDevices({ transportType: 'ble' });

    expect(devices).toEqual([{ connectId: 'ble-1', connectionType: 'ble' }]);
  });

  it('shows connecting UI while Trezor connectDevice is pending', async () => {
    let resolveConnect: (result: unknown) => void = () => undefined;
    const connectPromise = new Promise<unknown>((resolve) => {
      resolveConnect = resolve;
    });
    const hw = {
      on: jest.fn(),
      connectDevice: jest.fn().mockReturnValue(connectPromise),
    };
    const adapter = new TrezorAdapter(hw as never);

    const promise = adapter.connectDevice('USB-1');

    expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenCalledWith({
      action: 'connecting',
      vendor: 'trezor',
    });

    resolveConnect({
      success: false,
      payload: { code: 10_100, error: 'Device not found' },
    });
    await promise;

    expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenLastCalledWith(
      undefined,
    );
  });

  it('shows processing UI while direct Trezor SDK calls are pending', async () => {
    let resolveMethod: (result: unknown) => void = () => undefined;
    const methodPromise = new Promise<unknown>((resolve) => {
      resolveMethod = resolve;
    });
    const hw = {
      on: jest.fn(),
      evmGetAddress: jest.fn().mockReturnValue(methodPromise),
    };
    const adapter = new TrezorAdapter(hw as never);
    mockedThirdPartyHardwareUiStateAtom.set.mockClear();

    const promise = adapter.hw.evmGetAddress('USB-1', 'DEVICE-1', {
      path: "m/44'/60'/0'/0/0",
      showOnDevice: false,
    });

    expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenCalledWith({
      action: 'processing',
      vendor: 'trezor',
    });

    resolveMethod({
      success: true,
      payload: {
        address: '0x1',
      },
    });
    await promise;

    expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenLastCalledWith(
      undefined,
    );
  });

  it('restores processing after a Trezor confirm-on-device interaction completes while the SDK call is still pending', async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    let resolveMethod: (result: unknown) => void = () => undefined;
    const methodPromise = new Promise<unknown>((resolve) => {
      resolveMethod = resolve;
    });
    const hw = {
      on: jest.fn((eventName: string, listener: (event: unknown) => void) => {
        listeners.set(eventName, listener);
      }),
      evmGetAddress: jest.fn().mockReturnValue(methodPromise),
    };
    const adapter = new TrezorAdapter(hw as never);
    mockedThirdPartyHardwareUiStateAtom.set.mockClear();

    const promise = adapter.hw.evmGetAddress('USB-1', 'DEVICE-1', {
      path: "m/44'/60'/0'/0/0",
      showOnDevice: true,
    });

    listeners.get('ui-event')?.({
      type: EConnectorInteraction.ConfirmOnDevice,
    });
    expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenLastCalledWith({
      action: 'confirmOnDevice',
      vendor: 'trezor',
    });

    listeners.get('ui-event')?.({
      type: EConnectorInteraction.InteractionComplete,
    });
    expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenLastCalledWith({
      action: 'processing',
      vendor: 'trezor',
    });

    resolveMethod({
      success: true,
      payload: {
        address: '0x1',
      },
    });
    await promise;

    expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenLastCalledWith(
      undefined,
    );
  });

  it.each([
    {
      methodName: 'deviceSettings',
      call: (adapter: TrezorAdapter) =>
        adapter.deviceSettings('USB-1', { label: 'New label' }),
    },
    {
      methodName: 'setBrightness',
      call: (adapter: TrezorAdapter) =>
        adapter.setBrightness('USB-1', { value: 75 }),
    },
    {
      methodName: 'changePin',
      call: (adapter: TrezorAdapter) =>
        adapter.changePin('USB-1', { remove: false }),
    },
    {
      methodName: 'wipeDevice',
      call: (adapter: TrezorAdapter) => adapter.wipeDevice('USB-1'),
    },
  ] as const)(
    'shows processing UI while Trezor $methodName is pending',
    async ({ methodName, call }) => {
      let resolveMethod: (result: unknown) => void = () => undefined;
      const methodPromise = new Promise<unknown>((resolve) => {
        resolveMethod = resolve;
      });
      const hw = {
        on: jest.fn(),
        [methodName]: jest.fn().mockReturnValue(methodPromise),
      };
      const adapter = new TrezorAdapter(hw as never);

      const promise = call(adapter);

      expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenCalledWith({
        action: 'processing',
        vendor: 'trezor',
      });

      resolveMethod({
        success: true,
        payload: {},
      });
      await promise;

      expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenLastCalledWith(
        undefined,
      );
    },
  );
});
