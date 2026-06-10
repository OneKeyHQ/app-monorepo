import { OffscreenHardwareBridgeClient } from './offscreenHardwareBridgeClient';

import offscreenApiProxy from '../../../offscreens/instance/offscreenApiProxy';
import { onOffscreenEvent } from '../../../offscreens/offscreenEventBus';

import type { IOffscreenEventMap } from '../../../offscreens/offscreenEventBus';

jest.mock('../../../offscreens/instance/offscreenApiProxy', () => ({
  __esModule: true,
  default: {
    thirdPartyHardware: {
      searchDevices: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      call: jest.fn(),
      cancel: jest.fn(),
      uiResponse: jest.fn(),
      reset: jest.fn(),
      setKnownCredentials: jest.fn(),
    },
  },
}));

const offscreenHandlers: Partial<{
  [K in keyof IOffscreenEventMap]: (payload: IOffscreenEventMap[K]) => void;
}> = {};

jest.mock('../../../offscreens/offscreenEventBus', () => ({
  onOffscreenEvent: jest.fn((type, handler) => {
    offscreenHandlers[type as keyof IOffscreenEventMap] = handler as never;
    return jest.fn();
  }),
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

const mockedOffscreenApiProxy = jest.mocked(offscreenApiProxy);
const mockedOnOffscreenEvent = jest.mocked(onOffscreenEvent);

describe('OffscreenHardwareBridgeClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(offscreenHandlers).forEach((key) => {
      delete offscreenHandlers[key as keyof IOffscreenEventMap];
    });
    mockedOffscreenApiProxy.thirdPartyHardware.searchDevices.mockResolvedValue(
      [],
    );
    mockedOffscreenApiProxy.thirdPartyHardware.connect.mockResolvedValue({
      sessionId: 'session-1',
      deviceInfo: {
        vendor: 'trezor',
        model: 'T3W1',
        firmwareVersion: 'unknown',
        connectId: 'device-1',
        deviceId: 'device-1',
        label: 'Trezor',
        connectionType: 'usb',
      },
    });
    mockedOffscreenApiProxy.thirdPartyHardware.disconnect.mockResolvedValue(
      undefined,
    );
    mockedOffscreenApiProxy.thirdPartyHardware.call.mockResolvedValue({
      success: true,
      payload: {},
    });
    mockedOffscreenApiProxy.thirdPartyHardware.cancel.mockResolvedValue(
      undefined,
    );
    mockedOffscreenApiProxy.thirdPartyHardware.setKnownCredentials.mockResolvedValue(
      undefined,
    );
  });

  it('waits for offscreen setKnownCredentials to finish', async () => {
    let resolveCredentials: (() => void) | undefined;
    let completed = false;
    mockedOffscreenApiProxy.thirdPartyHardware.setKnownCredentials.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveCredentials = () => {
          completed = true;
          resolve();
        };
      }),
    );
    const client = new OffscreenHardwareBridgeClient();

    const loadPromise = client.setKnownCredentials({
      vendor: 'trezor',
      credentials: [{ credential: 'cred-1' }],
    });

    await Promise.resolve();
    expect(completed).toBe(false);
    resolveCredentials?.();
    await loadPromise;

    expect(completed).toBe(true);
  });

  it('replays cached credentials before searching after offscreen reload', async () => {
    const order: string[] = [];
    mockedOffscreenApiProxy.thirdPartyHardware.setKnownCredentials.mockImplementation(
      async () => {
        order.push('credentials');
      },
    );
    mockedOffscreenApiProxy.thirdPartyHardware.searchDevices.mockImplementation(
      async () => {
        order.push('search');
        return [];
      },
    );
    const client = new OffscreenHardwareBridgeClient();
    await client.setKnownCredentials({
      vendor: 'trezor',
      credentials: [{ credential: 'cred-1' }],
    });
    order.length = 0;

    await client.searchDevices({ vendor: 'trezor' });

    expect(order).toEqual(['credentials', 'search']);
    expect(
      mockedOffscreenApiProxy.thirdPartyHardware.setKnownCredentials,
    ).toHaveBeenLastCalledWith({
      vendor: 'trezor',
      credentials: [{ credential: 'cred-1' }],
    });
  });

  it('merges credentials from offscreen events for later replay', async () => {
    const client = new OffscreenHardwareBridgeClient();
    client.onEvent({ vendor: 'trezor' }, jest.fn());

    offscreenHandlers.thirdPartyHardwareConnectorEvent?.({
      vendor: 'trezor',
      type: 'device-trezor-thp-credentials-changed',
      data: {
        credentials: [{ credential: 'cred-from-event' }],
      },
    });
    await client.searchDevices({ vendor: 'trezor' });

    expect(mockedOnOffscreenEvent).toHaveBeenCalledWith(
      'thirdPartyHardwareConnectorEvent',
      expect.any(Function),
    );
    expect(
      mockedOffscreenApiProxy.thirdPartyHardware.setKnownCredentials,
    ).toHaveBeenCalledWith({
      vendor: 'trezor',
      credentials: [{ credential: 'cred-from-event' }],
    });
  });
});
