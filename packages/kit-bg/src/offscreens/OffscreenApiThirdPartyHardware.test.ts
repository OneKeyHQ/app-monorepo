import { createKeystoneWebUsbConnector } from '@onekeyfe/hwk-keystone-connector-usb/webusb';
import { createTrezorWebUsbConnector } from '@onekeyfe/hwk-trezor-connector-webusb';

import OffscreenApiThirdPartyHardware from './OffscreenApiThirdPartyHardware';
import { emitOffscreenEventToBackground } from './offscreenEventBus';

jest.mock('./offscreenEventBus', () => ({
  emitOffscreenEventToBackground: jest.fn(),
}));

jest.mock('@onekeyfe/hwk-keystone-connector-usb/webusb', () => ({
  createKeystoneWebUsbConnector: jest.fn(() => ({
    searchDevices: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue({ sessionId: 'keystone-session' }),
    call: jest
      .fn()
      .mockResolvedValue({ success: true, payload: 'ur:response' }),
    on: jest.fn(),
    reset: jest.fn(),
  })),
}));

describe('OffscreenApiThirdPartyHardware Keystone bridge', () => {
  it('lazily creates one USB connector and forwards discovery, connection and calls', async () => {
    const api = new OffscreenApiThirdPartyHardware();
    const options = {
      purpose: 'availability' as const,
      transportType: 'usb' as const,
    };
    await api.searchDevices({ vendor: 'keystone', options });
    const connector = jest.mocked(createKeystoneWebUsbConnector).mock.results[0]
      .value;
    expect(connector.searchDevices).toHaveBeenCalledWith(options);
    await api.connect({
      vendor: 'keystone',
      deviceId: 'selected-target',
      options: { transportType: 'usb' },
    });
    expect(connector.connect).toHaveBeenCalledWith('selected-target', {
      transportType: 'usb',
    });
    await expect(
      api.call({
        vendor: 'keystone',
        sessionId: 'keystone-session',
        method: 'exchange',
        callParams: { ur: 'ur:request' },
      }),
    ).resolves.toEqual({ success: true, payload: 'ur:response' });
    expect(connector.call).toHaveBeenCalledWith(
      'keystone-session',
      'exchange',
      { ur: 'ur:request' },
    );
    expect(createKeystoneWebUsbConnector).toHaveBeenCalledTimes(1);
  });

  it('rebuilds and resubscribes the connector after a reset', async () => {
    jest.mocked(createKeystoneWebUsbConnector).mockClear();
    const api = new OffscreenApiThirdPartyHardware();
    await api.searchDevices({ vendor: 'keystone' });
    const first = jest.mocked(createKeystoneWebUsbConnector).mock.results[0]
      .value;
    expect(first.on).toHaveBeenCalled();

    // `reset()` clears the connector's own event handlers. This runtime is the
    // only one that keeps a connector alive across adapter lifetimes, so
    // without dropping it here the next call reuses a connector nobody is
    // subscribed to and device events stop reaching the service worker.
    api.reset({ vendor: 'keystone' });
    expect(first.reset).toHaveBeenCalled();

    await api.searchDevices({ vendor: 'keystone' });
    expect(createKeystoneWebUsbConnector).toHaveBeenCalledTimes(2);
    const second = jest.mocked(createKeystoneWebUsbConnector).mock.results[1]
      .value;
    expect(second).not.toBe(first);
    expect(second.on).toHaveBeenCalled();
  });
});

jest.mock('@onekeyfe/hwk-trezor-connector-webusb', () => ({
  createTrezorWebUsbConnector: jest.fn(() => ({
    searchDevices: jest.fn().mockResolvedValue([]),
    on: jest.fn(),
    setKnownCredentials: jest.fn(),
  })),
}));

const mockedCreateTrezorWebUsbConnector = jest.mocked(
  createTrezorWebUsbConnector,
);
const mockedEmitOffscreenEventToBackground = jest.mocked(
  emitOffscreenEventToBackground,
);

describe('OffscreenApiThirdPartyHardware Trezor logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards Trezor HWK core and transport logs through hwkSdkEvent', async () => {
    const api = new OffscreenApiThirdPartyHardware();

    await api.searchDevices({ vendor: 'trezor' });

    const options = mockedCreateTrezorWebUsbConnector.mock.calls[0]?.[0];
    expect(options?.thp).toEqual(
      expect.objectContaining({
        appName: 'OneKey Wallet',
        hostName: expect.not.stringMatching(/^OneKey$/),
      }),
    );
    expect(options?.thp?.logger).toEqual(expect.any(Function));
    expect(options?.transportOptions?.logger).toEqual(expect.any(Function));

    options?.thp?.logger?.({
      level: 'info',
      scope: 'trezor-core',
      event: 'session.method.response',
      data: {
        name: 'btcSignMessage',
        responseType: 'Failure',
        message: 'Failure_ActionCancelled',
      },
    });
    options?.transportOptions?.logger?.({
      level: 'error',
      scope: 'trezor-webusb',
      event: 'webusb.transferIn.error',
      data: {
        error: 'Device disconnected',
      },
    });

    expect(mockedEmitOffscreenEventToBackground).toHaveBeenCalledWith(
      'hwkSdkEvent',
      expect.objectContaining({
        type: 'log',
        message:
          '[trezor-core] session.method.response {"name":"btcSignMessage","responseType":"Failure","message":"Failure_ActionCancelled"}',
      }),
    );
    expect(mockedEmitOffscreenEventToBackground).toHaveBeenCalledWith(
      'hwkSdkEvent',
      expect.objectContaining({
        type: 'log',
        message:
          '[trezor-webusb] webusb.transferIn.error {"error":"Device disconnected"}',
      }),
    );
  });
});
